import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const extractionSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  experiences: z.array(
    z.object({
      companyName: z.string().min(1),
      role: z.string().nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
    })
  ),
});

const PROMPT = `Extract structured resume data from the text below.
Return JSON only with this shape:
{
  "name": string | null,
  "email": string | null,
  "experiences": [
    {
      "companyName": string,
      "role": string | null,
      "startDate": "YYYY-MM" | null,
      "endDate": "YYYY-MM" | null
    }
  ]
}
Rules:
- Include jobs, internships, and freelance roles under experiences.
- Use the employer/company name only (not project subtitles).
- Dates as YYYY-MM; use null for endDate if current/present.
- Do not invent employers not present in the text.`;

/**
 * @param {string} rawText
 * @returns {Promise<{ name: string | null, email: string | null, experiences: Array<{ companyName: string, role: string | null, startDate: string | null, endDate: string | null }> } | null>}
 */
export async function extractResumeWithLlm(rawText) {
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const result = await model.generateContent(`${PROMPT}\n\n---\n\n${rawText.slice(0, 12000)}`);
    const text = result.response.text();
    const parsed = extractionSchema.safeParse(JSON.parse(text));

    if (!parsed.success || parsed.data.experiences.length === 0) {
      return null;
    }

    return {
      name: parsed.data.name ?? null,
      email: parsed.data.email || null,
      experiences: parsed.data.experiences.map((exp) => ({
        companyName: exp.companyName.trim(),
        role: exp.role?.trim() ?? null,
        startDate: exp.startDate ?? null,
        endDate: exp.endDate ?? null,
      })),
    };
  } catch (error) {
    logger.warn({ err: error.message }, 'LLM resume extraction failed');
    return null;
  }
}
