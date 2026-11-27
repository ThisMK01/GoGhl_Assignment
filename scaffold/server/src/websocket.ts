import http from 'node:http';
import crypto from 'node:crypto';
import type { Duplex } from 'node:stream';
import { Redis } from 'ioredis';
import { config } from './config.js';
import { redis } from './db.js';
import type { SessionData } from './controllers/authController.js';

interface WsClient {
  socket: Duplex;
  workspace: string;
  lastSentSeq: number;
}

const clientsByWorkspace = new Map<string, Set<WsClient>>();

// Dedicated Redis subscriber so events from any server instance reach all connected sockets
const redisSub = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
redisSub.subscribe('ws:broadcast').catch((err) => {
  console.error('Failed to subscribe to ws:broadcast:', err);
});

redisSub.on('message', (_channel, message) => {
  try {
    const { workspace, json } = JSON.parse(message) as { workspace: string; json: string };
    const parsed = JSON.parse(json) as { seq?: number };
    const clients = clientsByWorkspace.get(workspace);
    if (!clients) return;

    for (const client of clients) {
      if (typeof parsed.seq === 'number' && parsed.seq <= client.lastSentSeq) {
        continue;
      }
      if (typeof parsed.seq === 'number') {
        client.lastSentSeq = parsed.seq;
      }
      sendTextFrame(client.socket, json);
    }
  } catch (err) {
    console.error('WebSocket pubsub error:', err);
  }
});

// Encode a WebSocket text frame (RFC 6455)
function sendTextFrame(socket: Duplex, text: string): void {
  if (socket.destroyed || !socket.writable) return;
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;

  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text opcode
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  socket.write(Buffer.concat([header, payload]));
}

function sendPongFrame(socket: Duplex, payload: Buffer): void {
  if (socket.destroyed || !socket.writable) return;
  const len = Math.min(payload.length, 125);
  const header = Buffer.from([0x8a, len]);
  socket.write(Buffer.concat([header, payload.subarray(0, len)]));
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      try {
        cookies[k] = decodeURIComponent(v);
      } catch {
        cookies[k] = v;
      }
    }
  }
  return cookies;
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  if (!socket.destroyed) {
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  }
}

export async function broadcastWorkspaceEvent(
  workspace: string,
  eventData: Record<string, unknown>
): Promise<void> {
  const seq = await redis.incr(`seq:${workspace}`);
  const payload = { seq, ...eventData };
  const json = JSON.stringify(payload);

  await redis.rpush(`events:${workspace}`, json);
  await redis.ltrim(`events:${workspace}`, -1000, -1);
  await redis.publish('ws:broadcast', JSON.stringify({ workspace, json }));
}

export function attachWebSocket(server: http.Server): void {
  server.on('upgrade', async (req, socket, _head) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname !== '/ws') {
        rejectUpgrade(socket, 404, 'Not Found');
        return;
      }

      const workspace = url.searchParams.get('workspace');
      const afterParam = url.searchParams.get('after');
      const afterSeq = afterParam !== null ? Number(afterParam) : undefined;

      const cookies = parseCookies(req.headers.cookie);
      const sessionId = cookies['sb_session'];
      if (!sessionId) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }

      const rawSession = await redis.get(`session:${sessionId}`);
      if (!rawSession) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }

      const session = JSON.parse(rawSession) as SessionData;
      if (!workspace || !session.workspaces.some((w) => w.id === workspace)) {
        rejectUpgrade(socket, 403, 'Forbidden');
        return;
      }

      const key = req.headers['sec-websocket-key'];
      if (!key || typeof key !== 'string') {
        rejectUpgrade(socket, 400, 'Bad Request');
        return;
      }

      const acceptKey = crypto
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');

      socket.write(
        [
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${acceptKey}`,
          '',
          '',
        ].join('\r\n')
      );

      const client: WsClient = {
        socket,
        workspace,
        lastSentSeq: afterSeq !== undefined && !isNaN(afterSeq) ? afterSeq : -1,
      };

      // Replay missed events if ?after=<seq> was supplied
      if (afterSeq !== undefined && !isNaN(afterSeq)) {
        const stored = await redis.lrange(`events:${workspace}`, 0, -1);
        for (const item of stored) {
          try {
            const evt = JSON.parse(item) as { seq?: number };
            if (typeof evt.seq === 'number' && evt.seq > afterSeq) {
              if (evt.seq > client.lastSentSeq) {
                client.lastSentSeq = evt.seq;
              }
              sendTextFrame(socket, item);
            }
          } catch {
            // ignore malformed entry
          }
        }
      }

      let set = clientsByWorkspace.get(workspace);
      if (!set) {
        set = new Set();
        clientsByWorkspace.set(workspace, set);
      }
      set.add(client);

      // Handle incoming client frames (close, ping)
      socket.on('data', (buf: Buffer) => {
        if (buf.length < 2) return;
        const opcode = buf[0] & 0x0f;
        if (opcode === 0x08) {
          // Close frame
          socket.end();
        } else if (opcode === 0x09) {
          // Ping frame -> reply with pong
          const masked = (buf[1] & 0x80) !== 0;
          const len = buf[1] & 0x7f;
          let offset = 2;
          let payload: Buffer = Buffer.alloc(0);
          if (len < 126) {
            if (masked && buf.length >= offset + 4 + len) {
              const mask = buf.subarray(offset, offset + 4);
              offset += 4;
              payload = Buffer.from(buf.subarray(offset, offset + len));
              for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
            } else if (!masked && buf.length >= offset + len) {
              payload = buf.subarray(offset, offset + len);
            }
          }
          sendPongFrame(socket, payload);
        }
      });

      const cleanup = () => {
        clientsByWorkspace.get(workspace)?.delete(client);
      };
      socket.on('close', cleanup);
      socket.on('error', cleanup);
    } catch (err) {
      console.error('WebSocket upgrade error:', err);
      rejectUpgrade(socket, 500, 'Internal Server Error');
    }
  });
}
