// prisma/seed.ts
import 'dotenv/config'; // Required to ensure process.env.DATABASE_URL is loaded
import { PrismaClient, EntityType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Validate the environment variable exists to prevent silent crashes
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in your .env file');
}

// 2. Initialize the PostgreSQL connection pool
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// 3. Pass the adapter to PrismaClient
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Clearing old data...');
  // ... rest of your script remains exactly the same
  await prisma.edge.deleteMany();
  await prisma.entity.deleteMany();

  console.log('Seeding BioCascade base data...');

  // 1. Create Nodes
  const vitaminD = await prisma.entity.create({
    data: { name: 'Vitamin D Deficiency', type: EntityType.DEFICIENCY, description: 'Lack of adequate vitamin D.' }
  });

  const calciumAbsorption = await prisma.entity.create({
    data: { name: 'Impaired Calcium Absorption', type: EntityType.SYMPTOM, description: 'Gut cannot absorb calcium properly.' }
  });

  const osteopenia = await prisma.entity.create({
    data: { name: 'Osteopenia', type: EntityType.CONDITION, description: 'Lower than normal bone density.' }
  });

  const osteoporosis = await prisma.entity.create({
    data: { name: 'Osteoporosis', type: EntityType.DISEASE, description: 'Severe bone weakness and high fracture risk.' }
  });

  // 2. Create Edges (Connections)
  await prisma.edge.createMany({
    data: [
      { sourceId: vitaminD.id, targetId: calciumAbsorption.id, relation: 'CAUSES' },
      { sourceId: calciumAbsorption.id, targetId: osteopenia.id, relation: 'LEADS_TO' },
      { sourceId: osteopenia.id, targetId: osteoporosis.id, relation: 'PROGRESSES_TO' },
    ],
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });