import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const extractionSchema = z.object({
  name: z.string().nullable().optional(),
  email: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && v.includes('@') ? v : null)),
  experiences: z.array(
    z.object({
      companyName: z.string().min(1),
      role: z.string().nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
    })
  ),
});

const PROMPT = `You are a resume parsing expert. Extract structured work history from the resume text below.

Return JSON only:
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
- Include full-time jobs, internships, freelance, and contract roles.
- companyName = employer only (e.g. "Razorpay", "Google") — NOT project names or subtitles after dashes.
  Example: "LEAN AI – AI-Powered Recruitment Platform" → companyName: "LEAN AI"
- role = job title (e.g. "Software Engineer", "Backend + AI Engineer").
- startDate / endDate as YYYY-MM. Use null for endDate when current, present, or ongoing.
- Do NOT include education, certifications, projects, or hobbies as experiences.
- Do NOT invent employers or dates not supported by the text.
- Order experiences from most recent to oldest.`;

/**
 * @param {string} rawText
 * @returns {Promise<{ name: string | null, email: string | null, experiences: Array<{ companyName: string, role: string | null, startDate: string | null, endDate: string | null }> } | null>}
 */
export async function extractResumeWithLlm(rawText) {
  if (!env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set — cannot use LLM resume parsing');
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

    const result = await model.generateContent(`${PROMPT}\n\n---\n\n${rawText.slice(0, 14000)}`);
    const text = result.response.text();
    const parsed = extractionSchema.safeParse(JSON.parse(text));

    if (!parsed.success) {
      logger.warn({ issues: parsed.error.flatten() }, 'LLM resume JSON validation failed');
      return null;
    }

    const experiences = parsed.data.experiences
      .map((exp) => ({
        companyName: exp.companyName.trim(),
        role: exp.role?.trim() || null,
        startDate: normalizeDateString(exp.startDate),
        endDate: normalizeDateString(exp.endDate),
      }))
      .filter((exp) => exp.companyName.length > 0);

    if (experiences.length === 0) {
      return null;
    }

    return {
      name: parsed.data.name?.trim() || null,
      email: parsed.data.email,
      experiences,
    };
  } catch (error) {
    logger.warn({ err: error.message }, 'LLM resume extraction failed');
    return null;
  }
}

function normalizeDateString(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (['present', 'current', 'now', 'ongoing'].includes(trimmed)) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, '0')}`;
  }

  return null;
}
