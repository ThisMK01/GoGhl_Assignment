import { Request, Response } from 'express';
import { getDb, redis } from '../db.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { broadcastWorkspaceEvent } from '../websocket.js';

export const reset = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const db = await getDb();
  // Delete all MongoDB application data
  await db.collection('messages').deleteMany({});
  await db.collection('conversations').deleteMany({});
  await db.collection('outbound').deleteMany({});

  // Flush Redis
  await redis.flushdb();

  res.status(200).json({ ok: true });
});

export const snapshot = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const db = await getDb();
  const result: {
    workspaces: Record<
      string,
      {
        contacts: Record<string, { inbound: string[]; assignee: string | null }>;
        outbound: Record<string, string>;
      }
    >;
  } = { workspaces: {} };

  // Initialize all known workspaces
  for (const ws of Object.keys(config.pigeon.apiKeys)) {
    result.workspaces[ws] = { contacts: {}, outbound: {} };
  }

  // Load conversations
  const conversations = await db.collection('conversations').find().toArray();
  for (const conv of conversations) {
    const ws = conv.workspace;
    if (!result.workspaces[ws]) {
      result.workspaces[ws] = { contacts: {}, outbound: {} };
    }
    result.workspaces[ws].contacts[conv.contact] = {
      inbound: [],
      assignee: conv.assignee ?? null,
    };
  }

  // Load inbound messages ordered by occurred_at asc
  const messages = await db
    .collection('messages')
    .find({ direction: 'inbound' })
    .sort({ occurred_at: 1, _id: 1 })
    .toArray();

  for (const msg of messages) {
    const ws = msg.workspace;
    const contact = msg.contact;
    if (!result.workspaces[ws]) {
      result.workspaces[ws] = { contacts: {}, outbound: {} };
    }
    if (!result.workspaces[ws].contacts[contact]) {
      result.workspaces[ws].contacts[contact] = { inbound: [], assignee: null };
    }
    result.workspaces[ws].contacts[contact].inbound.push(msg.message_id);
  }

  // Load outbound messages
  const outboundList = await db.collection('outbound').find().toArray();
  for (const out of outboundList) {
    const ws = out.workspace;
    if (!result.workspaces[ws]) {
      result.workspaces[ws] = { contacts: {}, outbound: {} };
    }
    result.workspaces[ws].outbound[out.client_ref] = out.status;
  }

  res.status(200).json(result);
});

export const claim = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { workspace, contact, agent } = req.body;
  if (!workspace || !contact || !agent) {
    throw new AppError('workspace, contact, and agent are required', 400);
  }

  const db = await getDb();
  try {
    // Atomic claim logic
    const updated = await db.collection('conversations').findOneAndUpdate(
      {
        workspace,
        contact,
        $or: [{ assignee: null }, { assignee: { $exists: false } }, { assignee: agent }],
      },
      {
        $set: { assignee: agent, updated_at: new Date() },
        $setOnInsert: { workspace, contact, created_at: new Date() },
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (updated) {
      await broadcastWorkspaceEvent(workspace, {
        type: 'conversation.assigned',
        contact,
        assignee: agent,
      });
      res.status(200).json({ ok: true, assignee: agent });
      return;
    }

    res.status(409).json({ error: 'Conversation held by another agent' });
  } catch (err: any) {
    // Mongo duplicate key error on upsert race -> check current holder
    if (err.code === 11000) {
      const current = await db.collection('conversations').findOne({ workspace, contact });
      if (current && current.assignee === agent) {
        res.status(200).json({ ok: true, assignee: agent });
        return;
      }
      res.status(409).json({ error: 'Conversation held by another agent' });
      return;
    }
    throw err;
  }
});

// Dispatches a message to Pigeon with retries / cooldown handling
export async function sendToPigeon(workspace: string, to: string, text: string, clientRef: string) {
  const apiKey = config.pigeon.apiKeys[workspace];
  if (!apiKey) return;

  const url = `${config.pigeon.url}/v1/messages`;
  let attempt = 0;

  while (attempt < 10) {
    attempt++;
    try {
      // Check workspace cool-off in Redis before attempting
      const coolOff = await redis.get(`pigeon:cooloff:${workspace}`);
      if (coolOff) {
        const waitMs = Math.max(0, parseInt(coolOff, 10) - Date.now());
        if (waitMs > 0) {
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Idempotency-Key': clientRef,
        },
        body: JSON.stringify({ to, text, client_ref: clientRef }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 200 || res.status === 201 || res.status === 202) {
        const db = await getDb();
        await db.collection('outbound').updateOne(
          { workspace, client_ref: clientRef },
          { $set: { status: 'sent', updated_at: new Date() } }
        );
        await broadcastWorkspaceEvent(workspace, {
          type: 'message.status',
          contact: to,
          client_ref: clientRef,
          status: 'sent',
        });
        return;
      }

      if (res.status === 429) {
        const retryAfterHeader = res.headers.get('retry-after');
        const seconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 1;
        const cooldownUntil = Date.now() + seconds * 1000;
        await redis.set(`pigeon:cooloff:${workspace}`, String(cooldownUntil), 'EX', seconds + 1);
        await new Promise((r) => setTimeout(r, seconds * 1000));
        continue;
      }

      if (res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000 * Math.min(attempt, 3)));
        continue;
      }

      // 4xx error (other than 429)
      break;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1000 * Math.min(attempt, 3)));
    }
  }
}

export const reply = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { workspace, contact, text, client_ref } = req.body;

  if (!workspace || !(workspace in config.pigeon.apiKeys)) {
    throw new AppError('Workspace not found', 404);
  }
  if (!contact || !text || !client_ref) {
    throw new AppError('Missing required parameters', 400);
  }

  // Idempotency: both requests for the same client_ref get 202
  const isNew = await redis.set(`seen:reply:${client_ref}`, '1', 'EX', 86400, 'NX');

  if (isNew) {
    const db = await getDb();
    // Save initial queued state in MongoDB
    await db.collection('outbound').updateOne(
      { workspace, client_ref },
      {
        $setOnInsert: {
          workspace,
          client_ref,
          contact,
          text,
          status: 'queued',
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    // Ensure conversation exists
    await db.collection('conversations').updateOne(
      { workspace, contact },
      {
        $set: { last_activity: new Date(), updated_at: new Date() },
        $setOnInsert: { workspace, contact, assignee: null, created_at: new Date() },
      },
      { upsert: true }
    );

    await broadcastWorkspaceEvent(workspace, {
      type: 'message.status',
      contact,
      client_ref,
      status: 'queued',
    });

    // Asynchronously dispatch to Pigeon
    setImmediate(() => {
      sendToPigeon(workspace, contact, text, client_ref).catch((err) => {
        console.error('Failed to send message to Pigeon:', err);
      });
    });
  }

  res.status(202).json({ ok: true, client_ref });
});
