// src/scripts/scrapeVitamins.ts
import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaClient, EntityType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing');
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TARGET_URL = 'https://en.wikipedia.org/wiki/Vitamin_deficiency'; 

async function runScraper() {
  console.log(`🚀 Starting Smart Scraper on: ${TARGET_URL}`);

  try {
    const response = await axios.get(TARGET_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    });
    
    const $ = cheerio.load(response.data);
    const scrapedPairs: { deficiency: string, rawText: string }[] = [];

    $('table.wikitable').first().find('tbody tr').each((index, element) => {
      if (index === 0) return; 
      
      const columns = $(element).find('td');
      if (columns.length >= 2) {
        const deficiencyName = $(columns[0]).text().trim();
        const diseaseText = $(columns[1]).text().trim();

        if (deficiencyName && diseaseText && !/^\d{4}$/.test(deficiencyName)) {
          scrapedPairs.push({ deficiency: deficiencyName, rawText: diseaseText });
        }
      }
    });

    console.log(`✅ Extracted ${scrapedPairs.length} raw paragraphs. Tokenizing now...`);

    for (const pair of scrapedPairs) {
      // 1. Create the Root Deficiency Node
      const sourceNode = await prisma.entity.upsert({
        where: { name: pair.deficiency },
        update: {},
        create: {
          name: pair.deficiency,
          type: EntityType.DEFICIENCY,
          description: `Automatically scraped data for ${pair.deficiency}.`,
        }
      });

      // 2. THE TOKENIZER: Clean and split the paragraph
      // Strip Wikipedia citations like [18] or [22]
      const cleanText = pair.rawText.replace(/\[\d+\]/g, '');
      
      // Split by commas, periods, or the word "and"
      const rawSymptoms = cleanText.split(/[,\.]|\s+and\s+/i);

      // Filter out junk, keep short phrases, and capitalize them nicely
      const atomicSymptoms = rawSymptoms
        .map(s => s.trim())
        .filter(s => s.length > 4 && s.length < 45) // Strict length limits for UI cards
        .map(s => s.charAt(0).toUpperCase() + s.slice(1));

      // 3. Create a separate node and edge for EACH tokenized symptom
      for (const symptomText of atomicSymptoms) {
        const targetNode = await prisma.entity.upsert({
          where: { name: symptomText },
          update: {},
          create: {
            name: symptomText,
            type: EntityType.SYMPTOM,
            description: `Identified symptom of ${pair.deficiency}.`,
          }
        });

        try {
          await prisma.edge.create({
            data: {
              sourceId: sourceNode.id,
              targetId: targetNode.id,
              relation: 'CAUSES'
            }
          });
          console.log(`   🔗 Linked: ${sourceNode.name} -> ${targetNode.name}`);
        } catch (e: any) {
          if (e.code !== 'P2002') console.error(`   ❌ Failed to link:`, e.message);
        }
      }
    }
    console.log('🎉 Smart ingestion complete!');
  } catch (error) {
    console.error('❌ Scraper failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runScraper();