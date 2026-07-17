import { type Request,type Response } from 'express';
// 1. Added the 'type' keyword before Schema
import { GoogleGenAI, Type, type Schema } from '@google/genai';

// 2. Added 'as string' to assure TypeScript the env variable exists
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export const generateAISummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, description } = req.body;

    if (!name) {
      res.status(400).json({ error: "Missing node name for AI analysis." });
      return;
    }

    // Enforce strict JSON output from Gemini to prevent UI parsing errors
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        clinicalSummary: { 
          type: Type.STRING, 
          description: "A deeper 2-3 sentence clinical summary of the condition or nutrient." 
        },
        treatmentAndSources: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING }, 
          description: "3-4 bullet points on best dietary sources (if deficiency) or medical treatments (if disease)." 
        },
        absorptionTips: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING }, 
          description: "2-3 tips on physiological co-factors that increase absorption or inhibitors to avoid." 
        }
      },
      required: ["clinicalSummary", "treatmentAndSources", "absorptionTips"]
    };

    const prompt = `Act as an expert clinical biochemist. Analyze the following biological entity from a pathological cascade:
    Name: ${name}
    Type: ${type}
    Current Known Description: ${description}
    
    Provide a comprehensive analysis including treatment/dietary sources and absorption/metabolic tips.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
         responseMimeType: "application/json",
         responseSchema: responseSchema,
      }
    });

    if (!response.text) throw new Error("AI returned empty response");

    const data = JSON.parse(response.text);
    res.status(200).json(data);

  } catch (error) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ error: "Failed to generate AI clinical summary." });
  }
};