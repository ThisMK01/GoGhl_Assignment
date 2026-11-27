import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDb, redis } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { broadcastWorkspaceEvent } from '../websocket.js';
import { sendToPigeon } from './graderController.js';
import type { SessionData } from './authController.js';

const SESSION_COOKIE = 'sb_session';

async function requireWorkspaceSession(
  req: Request,
  res: Response,
  workspaceInput: unknown
): Promise<{ session: SessionData; workspace: string } | null> {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (!sessionId) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  const rawSession = await redis.get(`session:${sessionId}`);
  if (!rawSession) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  const session = JSON.parse(rawSession) as SessionData;
  const workspace = typeof workspaceInput === 'string' ? workspaceInput : undefined;
  if (!workspace) {
    throw new AppError('workspace is required', 400);
  }

  if (!session.workspaces.some((w) => w.id === workspace)) {
    res.status(403).json({ error: 'forbidden' });
    return null;
  }

  return { session, workspace };
}

export const listConversations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const auth = await requireWorkspaceSession(req, res, req.query.workspace);
  if (!auth) return;

  const { workspace } = auth;
  const db = await getDb();
  const conversations = await db
    .collection('conversations')
    .find({ workspace })
    .sort({ last_activity: -1, updated_at: -1 })
    .toArray();

  const results = await Promise.all(
    conversations.map(async (conv) => {
      const [inboundMsgs, outboundMsgs] = await Promise.all([
        db
          .collection('messages')
          .find({ workspace, contact: conv.contact })
          .sort({ occurred_at: 1, _id: 1 })
          .limit(50)
          .toArray(),
        db
          .collection('outbound')
          .find({ workspace, contact: conv.contact })
          .sort({ created_at: 1, _id: 1 })
          .limit(50)
          .toArray(),
      ]);

      const merged = [
        ...inboundMsgs.map((m) => ({
          id: m.message_id || String(m._id),
          direction: 'inbound' as const,
          text: m.text || '',
          occurred_at: (m.occurred_at || m.created_at || new Date()).toISOString(),
        })),
        ...outboundMsgs.map((o) => ({
          id: o.client_ref || String(o._id),
          client_ref: o.client_ref,
          direction: 'outbound' as const,
          text: o.text || '',
          status: o.status || 'queued',
          occurred_at: (o.created_at || new Date()).toISOString(),
        })),
      ].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

      return {
        ...conv,
        status: conv.status || 'open',
        messages: merged,
      };
    })
  );

  res.status(200).json(results);
});

export const claimConversation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const auth = await requireWorkspaceSession(req, res, req.body?.workspace);
  if (!auth) return;

  const { session, workspace } = auth;
  const contact = decodeURIComponent(String(req.params.contact || ''));
  if (!contact) throw new AppError('contact is required', 400);

  const db = await getDb();
  try {
    const updated = await db.collection('conversations').findOneAndUpdate(
      {
        workspace,
        contact,
        $or: [{ assignee: null }, { assignee: { $exists: false } }, { assignee: session.sub }],
      },
      {
        $set: { assignee: session.sub, updated_at: new Date() },
        $setOnInsert: { workspace, contact, status: 'open', created_at: new Date() },
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (updated) {
      await broadcastWorkspaceEvent(workspace, {
        type: 'conversation.assigned',
        contact,
        assignee: session.sub,
      });
      res.status(200).json({ ok: true, assignee: session.sub });
      return;
    }

    res.status(409).json({ error: 'Conversation held by another agent' });
  } catch (err: any) {
    if (err.code === 11000) {
      const current = await db.collection('conversations').findOne({ workspace, contact });
      if (current && current.assignee === session.sub) {
        res.status(200).json({ ok: true, assignee: session.sub });
        return;
      }
      res.status(409).json({ error: 'Conversation held by another agent' });
      return;
    }
    throw err;
  }
});

export const releaseConversation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const auth = await requireWorkspaceSession(req, res, req.body?.workspace);
  if (!auth) return;

  const { workspace } = auth;
  const contact = decodeURIComponent(String(req.params.contact || ''));
  if (!contact) throw new AppError('contact is required', 400);

  const db = await getDb();
  await db.collection('conversations').updateOne(
    { workspace, contact },
    { $set: { assignee: null, updated_at: new Date() } }
  );

  await broadcastWorkspaceEvent(workspace, {
    type: 'conversation.assigned',
    contact,
    assignee: null,
  });

  res.status(200).json({ ok: true, assignee: null });
});

export const updateConversationStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const auth = await requireWorkspaceSession(req, res, req.body?.workspace);
  if (!auth) return;

  const { workspace } = auth;
  const contact = decodeURIComponent(String(req.params.contact || ''));
  const status = req.body?.status === 'closed' ? 'closed' : 'open';

  const db = await getDb();
  await db.collection('conversations').updateOne(
    { workspace, contact },
    { $set: { status, updated_at: new Date() } }
  );

  res.status(200).json({ ok: true, status });
});

export const replyConversation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const auth = await requireWorkspaceSession(req, res, req.body?.workspace);
  if (!auth) return;

  const { workspace } = auth;
  const contact = decodeURIComponent(String(req.params.contact || ''));
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const clientRef =
    typeof req.body?.client_ref === 'string' && req.body.client_ref
      ? req.body.client_ref
      : `ui_${crypto.randomUUID()}`;

  if (!contact || !text) {
    throw new AppError('contact and text are required', 400);
  }
  if (!(workspace in config.pigeon.apiKeys)) {
    throw new AppError('Workspace not found', 404);
  }

  const isNew = await redis.set(`seen:reply:${clientRef}`, '1', 'EX', 86400, 'NX');
  if (isNew) {
    const db = await getDb();
    await db.collection('outbound').updateOne(
      { workspace, client_ref: clientRef },
      {
        $setOnInsert: {
          workspace,
          client_ref: clientRef,
          contact,
          text,
          status: 'queued',
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    await db.collection('conversations').updateOne(
      { workspace, contact },
      {
        $set: { last_activity: new Date(), updated_at: new Date() },
        $setOnInsert: { workspace, contact, assignee: null, status: 'open', created_at: new Date() },
      },
      { upsert: true }
    );

    await broadcastWorkspaceEvent(workspace, {
      type: 'message.status',
      contact,
      client_ref: clientRef,
      status: 'queued',
      text,
    });

    setImmediate(() => {
      sendToPigeon(workspace, contact, text, clientRef).catch((err) => {
        console.error('Failed to send message to Pigeon:', err);
      });
    });
  }

  res.status(202).json({ ok: true, client_ref: clientRef, status: 'queued' });
});
