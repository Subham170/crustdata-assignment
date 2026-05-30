import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Supabase connection string)'),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CRUSTDATA_API_KEY: z.string().optional(),
  CRUSTDATA_API_VERSION: z.string().default('2025-11-01'),
  CRUSTDATA_BASE_URL: z.string().url().default('https://api.crustdata.com'),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  LLM_PROVIDER: z.enum(['openai', 'gemini']).default('openai'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(5),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  return parsed.data;
}

export const env = loadEnv();
