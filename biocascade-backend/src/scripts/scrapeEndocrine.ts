// src/scripts/scrapeEndocrine.ts
import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { pipeline } from '@xenova/transformers';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 🔥 1. PRISMA CACHE BYPASS IMPORT (From our previous fix)
import { PrismaClient , EntityType } from '@prisma/client';

// 2. Initialize Database with Strict Connection Limits (Prevents Supabase Crashes)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing in .env');

const pool = new Pool({ 
  connectionString,
  max: 5, // Keep low to prevent Supabase connection drops
  idleTimeoutMillis: 30000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 3. Initialize Gemini for Data Extraction
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY is missing in .env');
const ai = new GoogleGenAI({ apiKey });

// 4. Endocrine System Wikipedia Targets
const TARGET_URLS = [
//   'https://en.wikipedia.org/wiki/Cortisol',
//   'https://en.wikipedia.org/wiki/Insulin_resistance',
//   'https://en.wikipedia.org/wiki/Thyroid_hormone',
//   'https://en.wikipedia.org/wiki/Hypothyroidism',
//   'https://en.wikipedia.org/wiki/Adrenaline',
//   'https://en.wikipedia.org/wiki/Testosterone',
  'https://en.wikipedia.org/wiki/Estrogen'
];

// 5. Schema strictly tailored for Hormones & Glands
const extractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cascades: {
      type: Type.ARRAY,
      description: "List of endocrine cascades extracted from the text.",
      items: {
        type: Type.OBJECT,
        properties: {
          hormoneName: { type: Type.STRING },
          hormoneDescription: { type: Type.STRING },
          pathways: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                symptomName: { type: Type.STRING },
                symptomDescription: { type: Type.STRING },
                resultingConditionName: { type: Type.STRING },
                resultingConditionDescription: { type: Type.STRING }
              },
              required: ["symptomName", "symptomDescription", "resultingConditionName", "resultingConditionDescription"]
            }
          }
        },
        required: ["hormoneName", "hormoneDescription", "pathways"]
      }
    }
  },
  required: ["cascades"]
};

// 6. Global Local AI Extractor Variable
let extractor: any = null;

async function processAndStoreEntity(name: string, type: EntityType, fallbackDesc: string) {
  // A. Upsert core relational entry
  const record = await prisma.entity.upsert({
    where: { name: name },
    update: {}, 
    create: {
      name: name,
      type: type,
      description: fallbackDesc
    }
  });

  // B. Generate Vector Embedding Locally
  try {
    if (!extractor) {
      console.log('   ⏳ Loading local AI embedding model (this takes a few seconds on the first run)...');
      extractor = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');
    }

    const textToEmbed = `${name}: ${fallbackDesc}`;
    const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
    const embeddingArray = Array.from(output.data);
    
    // FORMAT AS A STRING: '[0.1, 0.2, ...]' for pgvector
    const vectorString = `[${embeddingArray.join(',')}]`;

    // Direct SQL update using Postgres casting (::vector)
    await prisma.$queryRawUnsafe(
      `UPDATE "Entity" SET embedding = $1::vector WHERE id = $2`,
      vectorString,
      record.id
    );
    console.log(`   🟢 Vector embedded successfully for ${name}`);

  } catch (err: any) {
    console.log(`   ⚠️ Vector serialization failed for ${name}: ${err.message}`);
  }

  return record;
}

async function runEndocrinePipeline() {
  console.log(`🚀 Starting Endocrine AI Web Scraper & Vector Pipeline...`);

  try {
    for (const url of TARGET_URLS) {
      console.log(`\n========================================`);
      console.log(`📡 Sourcing data from: ${url}`);
      
      try {
        const response = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        const $ = cheerio.load(response.data);
        let rawTextContent = '';
        
        $('p, ul li').each((index, element) => {
          const text = $(element).text().trim();
          if (text.length > 40 && text.length < 600) {
            rawTextContent += `${text}\n`;
          }
        });

        const safeTextContent = rawTextContent.substring(0, 15000);
        console.log('🧠 Submitting text to Gemini for Endocrine extraction...');

        const aiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ 
            role: 'user', 
            parts: [{ 
              text: `Analyze the following raw medical text. Break down the cause-and-effect hierarchy of hormonal imbalances. Map the root hormone or glandular dysfunction to its immediate symptoms, and then map those symptoms to chronic diseases.\n\nRaw Medical Text:\n${safeTextContent}` 
            }] 
          }],
          config: {
             responseMimeType: 'application/json',
             responseSchema: extractionSchema,
             temperature: 0.1
          }
        });

        const parsedData = JSON.parse(aiResponse.text || "{}");
        console.log(`✅ Extracted ${parsedData.cascades?.length || 0} hormonal systems.`);

        // --- DATABASE INGESTION ---
        for (const cascade of (parsedData.cascades || [])) {
          console.log(`📦 Ingesting System: ${cascade.hormoneName}`);

          const hormoneNode = await processAndStoreEntity(
            cascade.hormoneName, 
            'HORMONE_IMBALANCE' as EntityType, 
            cascade.hormoneDescription
          );

          for (const pathway of cascade.pathways) {
            const symptomNode = await processAndStoreEntity(
              pathway.symptomName, 
              'SYMPTOM' as EntityType, 
              pathway.symptomDescription
            );

            const conditionNode = await processAndStoreEntity(
              pathway.resultingConditionName, 
              'DISEASE' as EntityType, 
              pathway.resultingConditionDescription
            );

            // Create Edges
            try {
              await prisma.edge.create({ data: { sourceId: hormoneNode.id, targetId: symptomNode.id, relation: 'CAUSES' } });
              console.log(`   🔗 Linked: ${hormoneNode.name} -> [Symptom] ${symptomNode.name}`);
            } catch (e: any) { if (e.code !== 'P2002') console.error('Edge error:', e.message); }

            try {
              await prisma.edge.create({ data: { sourceId: symptomNode.id, targetId: conditionNode.id, relation: 'PROGRESSES_TO' } });
              console.log(`   🔗 Linked: [Symptom] ${symptomNode.name} -> [Disease] ${conditionNode.name}`);
            } catch (e: any) { if (e.code !== 'P2002') console.error('Edge error:', e.message); }
            
            // Tiny 100ms delay to keep Supabase pool happy
            await new Promise(res => setTimeout(res, 100));
          }
        }

        // Wait 10 seconds before hitting the next URL to respect Gemini API limits
        console.log('⏳ Waiting 10 seconds for API rate limit cool-down...');
        await new Promise(resolve => setTimeout(resolve, 10000));

      } catch (innerError: any) {
        console.error(`⚠️ Skipping ${url} due to failure: ${innerError.message}`);
      }
    }

    console.log('\n🎉 Endocrine Pipeline executed successfully!');

  } catch (error) {
    console.error('❌ Catastrophic Pipeline failure:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runEndocrinePipeline();