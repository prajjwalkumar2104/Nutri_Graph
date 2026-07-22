// src/prisma.ts
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config'; // Ensure env vars are loaded

// 1. Initialize the Postgres connection pool
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

// 2. Wrap it in Prisma's adapter
const adapter = new PrismaPg(pool);

// 3. Export a single, shared Prisma instance
export const prisma = new PrismaClient({ adapter });