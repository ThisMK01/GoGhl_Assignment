import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';

export function verifyPigeonSignature(req: Request, res: Response, next: NextFunction): void {
  try {
    const sigHeader = req.headers['x-pigeon-signature'] as string | undefined;
    const rawBody = req.rawBody;

    if (!sigHeader || !rawBody) {
      res.status(401).json({ error: 'Missing signature or body' });
      return;
    }

    let tStr: string | undefined;
    let v1Hex: string | undefined;

    const parts = sigHeader.split(',');
    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === 't') tStr = v;
      if (k === 'v1') v1Hex = v;
    }

    if (!tStr || !v1Hex) {
      res.status(401).json({ error: 'Malformed signature header' });
      return;
    }

    const timestamp = parseInt(tStr, 10);
    if (isNaN(timestamp)) {
      res.status(401).json({ error: 'Invalid timestamp' });
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    // Reject if timestamp is more than 5 minutes old
    if (nowSeconds - timestamp > 300) {
      res.status(401).json({ error: 'Signature expired (older than 5 minutes)' });
      return;
    }

    // HMAC calculation: sha256 of "<t>.<rawBody>" with signing secret
    const payloadToSign = `${tStr}.${rawBody.toString('utf8')}`;
    const hmac = crypto.createHmac('sha256', config.pigeon.webhookSecret);
    hmac.update(payloadToSign);
    const expectedHex = hmac.digest('hex');

    const expectedBuf = Buffer.from(expectedHex, 'utf8');
    const actualBuf = Buffer.from(v1Hex, 'utf8');

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      res.status(401).json({ error: 'Signature mismatch' });
      return;
    }

    next();
  } catch (err) {
    // Contract: never return 500 on signature check
    res.status(401).json({ error: 'Signature verification failed' });
  }
}

export function requireGraderToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-grader-token'];
  if (!token || token !== config.graderToken) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing grader token' });
    return;
  }
  next();
}
