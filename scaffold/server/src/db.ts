import { MongoClient, type Db } from 'mongodb';
import { Redis } from 'ioredis';
import { config } from './config.js';

let client: MongoClient | undefined;
let dbInstance: Db | undefined;
let indexesCreated = false;

// Connects on first use. Call from anywhere: const db = await getDb();
export async function getDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(config.mongoUrl);
    await client.connect();
    dbInstance = client.db();
  }

  if (!indexesCreated && dbInstance) {
    indexesCreated = true;
    await Promise.all([
      dbInstance.collection('messages').createIndex({ workspace: 1, message_id: 1 }, { unique: true }),
      dbInstance.collection('messages').createIndex({ workspace: 1, contact: 1, occurred_at: 1 }),
      dbInstance.collection('conversations').createIndex({ workspace: 1, contact: 1 }, { unique: true }),
      dbInstance.collection('outbound').createIndex({ workspace: 1, client_ref: 1 }, { unique: true }),
    ]).catch((err) => {
      console.error('Failed to create indexes:', err);
    });
  }

  return dbInstance!;
}

// Shared Redis client for idempotency, rate limiting, and pub/sub
export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
