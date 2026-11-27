import { Request, Response } from 'express';
import { getDb, redis } from '../db.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { broadcastWorkspaceEvent } from '../websocket.js';

export const handlePigeonWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const event = req.body;
  if (!event || typeof event !== 'object') {
    throw new AppError('Invalid payload', 400);
  }

  const workspace = event.workspace;
  // If unknown workspace, return 200 and ignore per Pigeon specification
  if (!workspace || !(workspace in config.pigeon.apiKeys)) {
    res.status(200).json({ ok: true, ignored: 'unknown workspace' });
    return;
  }

  const eventId = (req.headers['x-pigeon-event-id'] as string) || event.id;

  // Idempotency check via Redis
  if (eventId) {
    const isNew = await redis.set(`seen:evt:${eventId}`, '1', 'EX', 86400, 'NX');
    if (!isNew) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
  }

  const db = await getDb();
  const { type, data, occurred_at } = event;
  const occurredAtDate = occurred_at ? new Date(occurred_at) : new Date();

  if (type === 'message.inbound') {
    const { message_id, from, text } = data || {};
    if (message_id && from) {
      // Upsert message idempotently in MongoDB
      await db.collection('messages').updateOne(
        { workspace, message_id },
        {
          $setOnInsert: {
            workspace,
            message_id,
            contact: from,
            text,
            direction: 'inbound',
            occurred_at: occurredAtDate,
            created_at: new Date(),
          },
        },
        { upsert: true }
      );

      // Upsert conversation for (workspace, from)
      await db.collection('conversations').updateOne(
        { workspace, contact: from },
        {
          $set: { last_activity: occurredAtDate, updated_at: new Date() },
          $setOnInsert: {
            workspace,
            contact: from,
            assignee: null,
            created_at: new Date(),
          },
        },
        { upsert: true }
      );

      await broadcastWorkspaceEvent(workspace, {
        type: 'message.inbound',
        contact: from,
        message_id,
        text,
        occurred_at: occurredAtDate.toISOString(),
      });
    }
  } else if (type === 'message.status') {
    const { client_ref, status } = data || {};
    if (client_ref && status) {
      // Update outbound status
      const updated = await db.collection('outbound').findOneAndUpdate(
        { workspace, client_ref },
        {
          $set: {
            workspace,
            client_ref,
            status,
            updated_at: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after' }
      );

      await broadcastWorkspaceEvent(workspace, {
        type: 'message.status',
        contact: updated?.contact ?? data?.contact ?? null,
        client_ref,
        status,
      });
    }
  }
  // Unknown event types also return 200 per spec

  res.status(200).json({ ok: true });
});
