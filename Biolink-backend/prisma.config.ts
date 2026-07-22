import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    // This tells Prisma v7 where your seed file is
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    // This securely pulls your Supabase URL from your .env file
    url: env('DATABASE_URL'),
  },
});