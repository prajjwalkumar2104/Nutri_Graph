// src/scripts/scrapeVitamins.ts
import { pipeline } from '@xenova/transformers';
import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { PrismaClient, EntityType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Initialize Prisma Database Layer
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing in .env');
const pool = new Pool({ 
  connectionString,
  max: 10, 
  connectionTimeoutMillis: 10000 
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 2. Initialize the Gemini API client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY is missing in .env');
const ai = new GoogleGenAI({ apiKey });

// Comprehensive URL set encompassing your target landscape
const TARGET_URLS = [
  'https://en.wikipedia.org/wiki/Mineral_deficiency',
  'https://en.wikipedia.org/wiki/Vitamin_A_deficiency',
  'https://en.wikipedia.org/wiki/Vitamin_D_deficiency',
  'https://en.wikipedia.org/wiki/Vitamin_E_deficiency',
  'https://en.wikipedia.org/wiki/Vitamin_K_deficiency',
  'https://en.wikipedia.org/wiki/Thiamine_deficiency',
  'https://en.wikipedia.org/wiki/Hyponatremia',
  'https://en.wikipedia.org/wiki/Copper_deficiency',
  'https://en.wikipedia.org/wiki/Selenium_deficiency',
  'https://en.wikipedia.org/wiki/Vitamin_B12_deficiency',
  'https://en.wikipedia.org/wiki/Scurvy',
  'https://en.wikipedia.org/wiki/Iron_deficiency'
];

// const TARGET_URLS = [
//   'https://en.wikipedia.org/wiki/Vitamin_deficiency',
//   'https://en.wikipedia.org/wiki/Mineral_deficiency', 

//   // --- THE FAT-SOLUBLE VITAMINS ---
//   'https://en.wikipedia.org/wiki/Vitamin_A_deficiency',
//   'https://en.wikipedia.org/wiki/Vitamin_D_deficiency',
//   'https://en.wikipedia.org/wiki/Vitamin_E_deficiency',
//   'https://en.wikipedia.org/wiki/Vitamin_K_deficiency',

//   // --- THE WATER-SOLUBLE VITAMINS (B-Complex & C) ---
//   'https://en.wikipedia.org/wiki/Thiamine_deficiency',    // B1 (Beriberi)
//   'https://en.wikipedia.org/wiki/Riboflavin_deficiency',  // B2
//   'https://en.wikipedia.org/wiki/Pellagra',               // B3 (Niacin)
//   'https://en.wikipedia.org/wiki/Vitamin_B6_deficiency',
//   'https://en.wikipedia.org/wiki/Biotin_deficiency',      // B7
//   'https://en.wikipedia.org/wiki/Folate_deficiency',      // B9
//   'https://en.wikipedia.org/wiki/Vitamin_B12_deficiency',
//   'https://en.wikipedia.org/wiki/Scurvy',                 // Vitamin C

//   // --- THE ESSENTIAL MINERALS ---
//   'https://en.wikipedia.org/wiki/Iron_deficiency',        // Often leads to Anemia
//   'https://en.wikipedia.org/wiki/Iodine_deficiency',      // Often leads to Goiter
//   'https://en.wikipedia.org/wiki/Hypocalcaemia',          // Calcium deficiency
//   'https://en.wikipedia.org/wiki/Magnesium_deficiency',
//   'https://en.wikipedia.org/wiki/Hypokalemia',            // Potassium deficiency
//   'https://en.wikipedia.org/wiki/Hyponatremia',           // Sodium deficiency
//   'https://en.wikipedia.org/wiki/Zinc_deficiency',
//   'https://en.wikipedia.org/wiki/Copper_deficiency',
//   'https://en.wikipedia.org/wiki/Selenium_deficiency'
// ];


// Define the structured schema we expect back from Gemini
const extractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cascades: {
      type: Type.ARRAY,
      description: "List of extracted pathological cascades from the text.",
      items: {
        type: Type.OBJECT,
        properties: {
          deficiencyName: { type: Type.STRING },
          deficiencyDescription: { type: Type.STRING },
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
        required: ["deficiencyName", "deficiencyDescription", "pathways"]
      }
    }
  },
  required: ["cascades"]
};

// Create a variable to hold the model in memory so it doesn't download every loop
let localEmbedder: any = null;

/**
 * Computes vector representation using a local 768-dimension model (NO API KEY NEEDED)
 */
async function computeEmbedding(text: string): Promise<number[]> {
  try {
    // Load the model into memory the very first time this function is called
    if (!localEmbedder) {
      console.log('⏳ Loading local AI embedding model (this takes a few seconds on the first run)...');
      localEmbedder = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');
    }

    // Generate the embedding locally
    const output = await localEmbedder(text, { pooling: 'mean', normalize: true });
    
    // Convert the Float32Array to a standard JavaScript Array for Prisma
    return Array.from(output.data);

  } catch (error: any) {
    console.error(`❌ Local embedding error: ${error.message}`);
    throw error;
  }
}
/**
 * Synchronizes entity database records and appends vectors natively
 */
/**
 * Synchronizes entity database records and appends vectors natively
 */
async function processAndStoreEntity(name: string, type: EntityType, fallbackDesc: string) {
  // Upsert core relational entry
  const record = await prisma.entity.upsert({
    where: { name },
    update: {},
    create: { name, type, description: fallbackDesc }
  });

  // Calculate high-dimensional vector using spatial context
  const contextualBlock = `${record.name}: ${record.description}`;
  try {
    const embeddingVector = await computeEmbedding(contextualBlock);

    // 🔥 THE FIX: Convert the JavaScript array into a strict pgvector string format
    const vectorString = `[${embeddingVector.join(',')}]`;

    // Save vector bypass via template serialization
    await prisma.$queryRaw`
      UPDATE "Entity"
      SET "embedding" = ${vectorString}::vector
      WHERE "id" = ${record.id};
    `;
    
    console.log(`   🟢 Vector embedded successfully for ${name}`);
  } catch (err: any) {
    // We also expose the true error message here now just in case!
    console.warn(`⚠️ Vector serialization skipped for ${name}. Error: ${err.message}`);
  }

  return record;
}

async function runAIPipeline() {
  console.log(`🚀 Starting Multi-Source AI Vector-Ingestion Pipeline...`);

  try {
    for (const url of TARGET_URLS) {
      console.log(`\n========================================`);
      console.log(`📡 Sourcing data from: ${url}`);
      
      try {
        const response = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const $ = cheerio.load(response.data);
        let rawTextContent = '';

        // Improved scraper parser rules to prevent data loss
        $('p, ul li, table td').each((_, element) => {
          // Clean out bracketed citation footnotes (e.g., [1], [flags])
          $(element).find('sup.reference').remove();
          
          const text = $(element).text().replace(/\s+/g, ' ').trim();
          // Relaxed constraints to capture precise short symptoms and long compound clinical analysis
          if (text.length > 20 && text.length < 1200) {
            rawTextContent += `${text}\n`;
          }
        });

        // Safe substring window for Gemini parsing constraints
        const safeTextContent = rawTextContent.substring(0, 20000);
        
        if (safeTextContent.trim().length < 100) {
          console.warn(`⚠️ Warning: Insufficient content retrieved from page structure. Skipping parsing.`);
          continue;
        }

        console.log('🧠 Submitting clean context block to Gemini for Vector & Node Extraction...');

        const aiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ 
            role: 'user', 
            parts: [{ text: `Analyze the following raw medical text. Break down the multi-tiered cause-and-effect hierarchy. Map the root deficiency (vitamin or mineral) to its immediate intermediate symptoms, and then map those symptoms to the final advanced chronic diseases.\n\nRaw Medical Text:\n${safeTextContent}` }] 
          }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: extractionSchema,
            temperature: 0.1 
          }
        });

        const responseText = aiResponse.text;
        if (!responseText) throw new Error('Empty system token response from Gemini context runtime.');
        
        const parsedData = JSON.parse(responseText);
        console.log(`✅ Structured extraction successful. Found ${parsedData.cascades?.length || 0} root deficiency systems.`);

        // --- TRANSFORM & LOAD (VECTOR DATABASE INGESTION) ---
        for (const cascade of parsedData.cascades) {
          console.log(`📦 System Sync Ingest: ${cascade.deficiencyName}`);

          const deficiencyNode = await processAndStoreEntity(
            cascade.deficiencyName, 
            EntityType.DEFICIENCY, 
            cascade.deficiencyDescription || `Pathological tree tracking root deficiency of ${cascade.deficiencyName}.`
          );

          for (const pathway of cascade.pathways) {
            const symptomNode = await processAndStoreEntity(
              pathway.symptomName, 
              EntityType.SYMPTOM, 
              pathway.symptomDescription || `Symptomatic marker linked to ${cascade.deficiencyName}.`
            );

            const conditionNode = await processAndStoreEntity(
              pathway.resultingConditionName, 
              EntityType.DISEASE, 
              pathway.resultingConditionDescription || `Chronic complication resulting from progressive untreated symptoms.`
            );

            // Relational Edge mappings
            try {
              await prisma.edge.create({ data: { sourceId: deficiencyNode.id, targetId: symptomNode.id, relation: 'CAUSES' } });
              console.log(`   🔗 Graph Edge Saved: ${deficiencyNode.name} -> [Symptom] ${symptomNode.name}`);
            } catch (e: any) { if (e.code !== 'P2002') console.error('Edge construction error:', e.message); }

            try {
              await prisma.edge.create({ data: { sourceId: symptomNode.id, targetId: conditionNode.id, relation: 'PROGRESSES_TO' } });
              console.log(`   🔗 Graph Edge Saved: [Symptom] ${symptomNode.name} -> [Disease] ${conditionNode.name}`);
            } catch (e: any) { if (e.code !== 'P2002') console.error('Edge construction error:', e.message); }
          }
        }
        
        // Politeness window rate-limiting block (3 seconds delay)
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (innerError: any) {
        console.error(`⚠️ Skipping target URL pipeline trace [${url}] due to operational execution error: ${innerError.message}`);
      }
    }

    console.log('\n🎉 Multi-Source AI Vector Pipeline executed and synced successfully!');

  } catch (error) {
    console.error('❌ Catastrophic Pipeline Database Failure:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runAIPipeline();