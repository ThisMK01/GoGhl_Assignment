import express, { Request } from 'express';
import { createServer } from 'node:http';
import { config } from './config.js';
import { cookieParser } from './middleware/cookieParser.js';
import { errorHandler } from './middleware/errorHandler.js';
import webhookRoutes from './routes/webhookRoutes.js';
import graderRoutes from './routes/graderRoutes.js';
import authRoutes from './routes/authRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import { me } from './controllers/authController.js';
import { attachWebSocket } from './websocket.js';

// Extend Express Request to hold rawBody buffer
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const app = express();

app.use(cookieParser());

// Parse JSON while keeping raw body buffer for HMAC signature verification
app.use(
  express.json({
    verify: (req: Request, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

// Mount Routes
app.use('/webhooks', webhookRoutes);
app.use('/__grader', graderRoutes);
app.use('/auth', authRoutes);
app.get('/api/me', me);
app.use('/api/conversations', conversationRoutes);

// Centralized error handling middleware (always mounted after routes)
app.use(errorHandler);

// Plain HTTP server with WebSocket upgrade support
const server = createServer(app);
attachWebSocket(server);

server.listen(config.port, () => {
  console.log(`server on http://localhost:${config.port}`);
});
