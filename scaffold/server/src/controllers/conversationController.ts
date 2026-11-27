import { Request, Response } from 'express';
import { getDb, redis } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import type { SessionData } from './authController.js';

const SESSION_COOKIE = 'sb_session';

export const listConversations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (!sessionId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const rawSession = await redis.get(`session:${sessionId}`);
  if (!rawSession) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const session = JSON.parse(rawSession) as SessionData;
  const workspace = typeof req.query.workspace === 'string' ? req.query.workspace : undefined;

  if (!workspace) {
    throw new AppError('workspace query parameter is required', 400);
  }

  const isMember = session.workspaces.some((w) => w.id === workspace);
  if (!isMember) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const db = await getDb();
  const conversations = await db
    .collection('conversations')
    .find({ workspace })
    .sort({ last_activity: -1, updated_at: -1 })
    .toArray();

  // Attach latest messages for each conversation
  const results = await Promise.all(
    conversations.map(async (conv) => {
      const messages = await db
        .collection('messages')
        .find({ workspace, contact: conv.contact })
        .sort({ occurred_at: 1, _id: 1 })
        .limit(50)
        .toArray();

      return {
        ...conv,
        messages,
      };
    })
  );

  res.status(200).json(results);
});
