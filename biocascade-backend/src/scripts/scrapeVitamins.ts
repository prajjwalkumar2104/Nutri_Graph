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

const TARGET_URL = 'https://en.wikipedia.org/wiki/Vitamin_deficiency';

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
  console.log(`🚀 Sourcing raw text structure from: ${TARGET_URL}`);

  try {
    const response = await axios.get(TARGET_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    
    const $ = cheerio.load(response.data);
    let rawTextContent = '';

    // Extract the raw text rows from the first structured medical table
    $('table.wikitable').first().find('tbody tr').each((index, element) => {
      if (index === 0) return;
      const columns = $(element).find('td');
      if (columns.length >= 2) {
        rawTextContent += `Deficiency Context: ${$(columns[0]).text().trim()} | Pathological Details: ${$(columns[1]).text().trim()}\n`;
      }
    });

    console.log('🧠 Submitting text to Gemini for deep structural parsing...');

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze the following raw medical text. Break down the multi-tiered cause-and-effect hierarchy. 
              Map the root deficiency to its immediate intermediate symptoms/breakdowns, and then map those symptoms to the final advanced chronic diseases or conditions they directly progress into.
              
              Raw Medical Text:
              ${rawTextContent}`
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: extractionSchema,
        temperature: 0.1 // Low temperature ensures analytical consistency and factual adherence
      }
    });

    const responseText = aiResponse.text;
    if (!responseText) throw new Error('Received empty response from Gemini');
    
    const parsedData = JSON.parse(responseText);
    console.log(`✅ Structured extraction successful. Found ${parsedData.cascades.length} root deficiency systems.`);

    // --- TRANSFORM & LOAD (DATABASE INGESTION) ---
    for (const cascade of parsedData.cascades) {
      console.log(`Ingesting System: ${cascade.deficiencyName}`);

      // 1. Upsert the Root Deficiency Node
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
        // 2. Upsert the Intermediate Symptom Node
        const symptomNode = await prisma.entity.upsert({
          where: { name: pathway.symptomName },
          update: {},
          create: {
            name: pathway.symptomName,
            type: EntityType.SYMPTOM,
            description: pathway.symptomDescription || `Symptomatic marker linked to ${cascade.deficiencyName}.`
          }
        });

        // 3. Upsert the Advanced Chronic Disease/Condition Node
        const conditionNode = await prisma.entity.upsert({
          where: { name: pathway.resultingConditionName },
          update: {},
          create: {
            name: pathway.resultingConditionName,
            type: EntityType.DISEASE,
            description: pathway.resultingConditionDescription || `Chronic complication resulting from progressive symptoms.`
          }
        });

        // 4. Connect Root Deficiency -> Intermediate Symptom
        try {
          await prisma.edge.create({
            data: {
              sourceId: deficiencyNode.id,
              targetId: symptomNode.id,
              relation: 'CAUSES'
            }
          });
          console.log(`   🔗 Linked: ${deficiencyNode.name} -> [Symptom] ${symptomNode.name}`);
        } catch (e: any) {
          if (e.code !== 'P2002') console.error('Edge error:', e.message);
        }

        // 5. Connect Intermediate Symptom -> Advanced Chronic Disease
        try {
          await prisma.edge.create({
            data: {
              sourceId: symptomNode.id,
              targetId: conditionNode.id,
              relation: 'PROGRESSES_TO'
            }
          });
          console.log(`   🔗 Linked: [Symptom] ${symptomNode.name} -> [Disease] ${conditionNode.name}`);
        } catch (e: any) {
          if (e.code !== 'P2002') console.error('Edge error:', e.message);
        }
      }
    }

    console.log('🎉 AI Ingestion Pipeline executed successfully!');

  } catch (error) {
    console.error('❌ Pipeline operational failure:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runAIPipeline();