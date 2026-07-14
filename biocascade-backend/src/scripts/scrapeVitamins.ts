// src/scripts/scrapeVitamins.ts
import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenAI, Type,type Schema } from '@google/genai';
import { PrismaClient, EntityType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Initialize Prisma Database Layer
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing in .env');
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 2. Initialize the Gemini API client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY is missing in .env');
const ai = new GoogleGenAI({ apiKey });

// Define an array of target URLs to scrape multiple pages in one run
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


const TARGET_URLS = [
  'https://en.wikipedia.org/wiki/Mineral_deficiency',
  'https://en.wikipedia.org/wiki/Vitamin_A_deficiency',
  'https://en.wikipedia.org/wiki/Vitamin_D_deficiency',
  'https://en.wikipedia.org/wiki/Vitamin_E_deficiency',
  'https://en.wikipedia.org/wiki/Vitamin_K_deficiency',
  'https://en.wikipedia.org/wiki/Thiamine_deficiency',
  'https://en.wikipedia.org/wiki/Hyponatremia',
  'https://en.wikipedia.org/wiki/Copper_deficiency',
  'https://en.wikipedia.org/wiki/Selenium_deficiency'
];
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
              // FIX: Force Gemini to provide descriptions!
              required: ["symptomName", "symptomDescription", "resultingConditionName", "resultingConditionDescription"] 
            }
          }
        },
        // FIX: Force Gemini to provide the root description!
        required: ["deficiencyName", "deficiencyDescription", "pathways"]
      }
    }
  },
  required: ["cascades"]
};
async function runAIPipeline() {
  console.log(`🚀 Starting Multi-Source AI Ingestion Pipeline...`);

  try {
    for (const url of TARGET_URLS) {
      console.log(`\n========================================`);
      console.log(`📡 Sourcing data from: ${url}`);
      
      // 2. ADD AN INNER TRY/CATCH BLOCK HERE
      try {
        const response = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        
        const $ = cheerio.load(response.data);
        let rawTextContent = '';

        $('p, ul li').each((index, element) => {
          const text = $(element).text().trim();
          if (text.length > 40 && text.length < 500) {
            rawTextContent += `${text}\n`;
          }
        });

        const safeTextContent = rawTextContent.substring(0, 15000);
        console.log('🧠 Submitting text to Gemini for deep structural parsing...');

        const aiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: `Analyze the following raw medical text. Break down the multi-tiered cause-and-effect hierarchy. Map the root deficiency (vitamin or mineral) to its immediate intermediate symptoms, and then map those symptoms to the final advanced chronic diseases.\n\nRaw Medical Text:\n${safeTextContent}` }] }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: extractionSchema,
            temperature: 0.1 
          }
        });

        const responseText = aiResponse.text;
        if (!responseText) throw new Error('Empty response from Gemini');
        
        const parsedData = JSON.parse(responseText);
        console.log(`✅ Structured extraction successful. Found ${parsedData.cascades?.length || 0} root deficiency systems.`);

        // --- TRANSFORM & LOAD (DATABASE INGESTION) ---
        for (const cascade of parsedData.cascades) {
          console.log(`Ingesting System: ${cascade.deficiencyName}`);

          const deficiencyNode = await prisma.entity.upsert({
            where: { name: cascade.deficiencyName },
            update: {},
            create: {
              name: cascade.deficiencyName,
              type: EntityType.DEFICIENCY,
              description: cascade.deficiencyDescription || `Pathological tree for ${cascade.deficiencyName}.`
            }
          });

          for (const pathway of cascade.pathways) {
            const symptomNode = await prisma.entity.upsert({
              where: { name: pathway.symptomName },
              update: {},
              create: {
                name: pathway.symptomName,
                type: EntityType.SYMPTOM,
                description: pathway.symptomDescription || `Symptomatic marker linked to ${cascade.deficiencyName}.`
              }
            });

            const conditionNode = await prisma.entity.upsert({
              where: { name: pathway.resultingConditionName },
              update: {},
              create: {
                name: pathway.resultingConditionName,
                type: EntityType.DISEASE,
                description: pathway.resultingConditionDescription || `Chronic complication resulting from progressive symptoms.`
              }
            });

            try {
              await prisma.edge.create({ data: { sourceId: deficiencyNode.id, targetId: symptomNode.id, relation: 'CAUSES' } });
              console.log(`   🔗 Linked: ${deficiencyNode.name} -> [Symptom] ${symptomNode.name}`);
            } catch (e: any) { if (e.code !== 'P2002') console.error('Edge error:', e.message); }

            try {
              await prisma.edge.create({ data: { sourceId: symptomNode.id, targetId: conditionNode.id, relation: 'PROGRESSES_TO' } });
              console.log(`   🔗 Linked: [Symptom] ${symptomNode.name} -> [Disease] ${conditionNode.name}`);
            } catch (e: any) { if (e.code !== 'P2002') console.error('Edge error:', e.message); }
          }
        }
        
        // Wait 3 seconds before hitting the next URL
        await new Promise(resolve => setTimeout(resolve, 10000));

      // 3. CATCH THE INNER ERROR SO THE LOOP CONTINUES
      } catch (innerError: any) {
        console.error(`⚠️ Skipping ${url} due to failure: ${innerError.message}`);
      }
    }

    console.log('\n🎉 Multi-Source AI Ingestion Pipeline executed successfully!');

  } catch (error) {
    // This now only catches absolute catastrophic failures (like database connection issues)
    console.error('❌ Catastrophic Pipeline failure:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runAIPipeline();