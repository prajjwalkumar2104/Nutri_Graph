// src/utils/db.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing in .env');

const pool = new Pool({ 
  connectionString,
  max: 10, 
  connectionTimeoutMillis: 10000 
});

// 🔥 THE FIX: Catch idle connection drops from Supabase so the server doesn't crash
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client. Supabase likely dropped the connection. Reconnecting...', err.message);
});

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });