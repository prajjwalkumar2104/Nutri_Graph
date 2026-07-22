// src/controllers/uploadController.ts
import { type Request, type Response } from 'express';
import { prisma } from '../prisma';
import { GoogleGenAI, Type, type Schema } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

// Enforce Gemini to output a strict array of strings
const extractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    conditions: {
      type: Type.ARRAY,
      description: "List of extracted biological conditions, deficiencies, or hormonal imbalances found in the report.",
      items: { type: Type.STRING }
    }
  },
  required: ["conditions"]
};

export const parseLabReport = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided." });
    }

    console.log(`🧠 Parsing ${files.length} file(s) with Gemini...`);

    // 1. Convert uploaded files to Gemini's InlineData format
    const parts: any[] = files.map(file => ({
      inlineData: {
        data: file.buffer.toString("base64"),
        mimeType: file.mimetype
      }
    }));

    // 2. Add the prompt instruction
    parts.unshift({
      text: "You are a clinical AI. Analyze this medical lab report. Identify any biomarkers that are 'Out of Range', 'High', 'Low', or diagnosed diseases. Standardize their names to match nutritional deficiencies (e.g., 'Low Iron' -> 'Iron Deficiency') or endocrine hormones (e.g., 'High Cortisol' -> 'Cortisol'). ONLY return conditions if they are related to basic vitamins, minerals, or major hormones. Ignore highly specific blood counts like Lymphocytes or Monocytes. Return the list as a JSON array."
    });

    // 3. Call Gemini 2.5 Flash (which natively handles PDFs and Images!)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: parts,
      config: {
        responseMimeType: 'application/json',
        responseSchema: extractionSchema,
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    const extractedNames = parsedData.conditions || [];

    console.log(`✅ Gemini Extracted:`, extractedNames);

    // 4. Query the Database for matches (case-insensitive)
    const matchedEntities = await prisma.entity.findMany({
      where: {
        name: { in: extractedNames, mode: 'insensitive' }
      }
    });

    const rootIds = matchedEntities.map(e => e.id);
    const matchedNames = matchedEntities.map(e => e.name);

    console.log(`🔗 Matched to Database Nodes:`, matchedNames);

    // Return the array of IDs so the frontend can trigger the Multi-Root Graph
    res.json({ rootIds, extractedNames, matchedNames });

  } catch (error) {
    console.error("Error parsing lab report:", error);
    res.status(500).json({ error: "Failed to parse lab report" });
  }
};