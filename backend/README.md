# GrowthLens AI — Backend

Node.js + Express API: resume parsing, Crustdata employer enrichment, Growth Exposure Score, AI hiring insights, and candidate comparison.

**Architecture details:** [BACKEND_PLAN.md](../BACKEND_PLAN.md)  
**Crustdata API reference:** [api-guide.md](../api-guide.md)

---

## Quick start

```bash
cd backend
npm install
cp .env.example .env   # fill in Supabase, Crustdata, Gemini keys
npm run db:generate
npm run db:migrate
docker compose up -d   # optional Redis cache
npm run dev
```

Server URL: `http://localhost:${PORT}` (default **3001**; set `PORT=8000` in `.env` if you prefer).

---

## API overview

| Method | Endpoint | What it does |
|--------|----------|--------------|
| `GET` | `/` | Service info + route list |
| `GET` | `/api/health` | DB + Redis health |
| `POST` | `/api/candidates/upload` | Upload PDF resume, create candidate |
| `POST` | `/api/candidates/analyze` | Full pipeline (parse → enrich → score → AI) |
| `GET` | `/api/candidates` | List recent candidates (for compare dropdown) |
| `GET` | `/api/candidates/:id` | Get candidate, experiences, latest report |
| `POST` | `/api/candidates/compare` | Compare two analyzed candidates |

### Score bands

| Score | Band |
|-------|------|
| 0–30 | `stable` |
| 31–60 | `moderate` |
| 61–80 | `fast` |
| 81–100 | `hypergrowth` |

---

## How to use (Postman)

### 1. Upload resume

| Setting | Value |
|---------|--------|
| Method | `POST` |
| URL | `http://localhost:8000/api/candidates/upload` |
| Body | **form-data** |

| Key | Type | Required | Example |
|-----|------|----------|---------|
| `resume` | **File** | Yes | `resume.pdf` |
| `linkedinUrl` | Text | No | `https://www.linkedin.com/in/username` |

**Response:** copy `candidateId` from the JSON body.

---

### 2. Analyze candidate

| Setting | Value |
|---------|--------|
| Method | `POST` |
| URL | `http://localhost:8000/api/candidates/analyze` |
| Headers | `Content-Type: application/json` |
| Body | **raw → JSON** |

```json
{
  "candidateId": "PASTE_UUID_FROM_UPLOAD"
}
```

Runs parse → Crustdata identify/enrich → scoring → Gemini insights (15–60s typical).  
**Response:** `growthScore`, `scoreBand`, `summary`, `signals`, `employers`, optional `warnings`.

---

### 3. Get candidate

| Setting | Value |
|---------|--------|
| Method | `GET` |
| URL | `http://localhost:8000/api/candidates/YOUR_UUID` |

No body.

---

### 4. Compare two candidates

Both must be analyzed first (`status: completed`).

| Setting | Value |
|---------|--------|
| Method | `POST` |
| URL | `http://localhost:8000/api/candidates/compare` |
| Body | **raw → JSON** |

```json
{
  "candidate1": "UUID_OF_CANDIDATE_A",
  "candidate2": "UUID_OF_CANDIDATE_B"
}
```

IDs must be different UUIDs.

---

## Typical workflow

```
Upload resume A  →  Analyze A  →  Upload resume B  →  Analyze B  →  Compare A vs B
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase **Transaction** pooler URI (`:6543`, `?pgbouncer=true`) |
| `DIRECT_URL` | Yes | Supabase **Session** pooler URI (`:5432`) for migrations |
| `PORT` | No | Server port (default `3001`) |
| `REDIS_URL` | No | Default `redis://localhost:6379` |
| `CRUSTDATA_API_KEY` | Yes* | Crustdata API key |
| `GEMINI_API_KEY` | No** | AI summary (template fallback if missing) |
| `UPLOAD_DIR` | No | Default `./uploads` |
| `MAX_FILE_SIZE_MB` | No | Default `5` |

\* Required for employer enrichment.  
\** Recommended for rich `summary` and `signals`.

### Supabase connection (IPv4 networks)

If direct host `db.xxx.supabase.co` fails, use **Connection pooling** in the Supabase dashboard:

| Variable | Pooler type | Port |
|----------|-------------|------|
| `DATABASE_URL` | Transaction | 6543 |
| `DIRECT_URL` | Session | 5432 |

URL-encode special characters in the password (`#` → `%23`, `$` → `%24`, etc.).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm start` | Production start |
| `npm test` | Unit tests |
| `npm run test:crustdata` | Manual Crustdata test (Razorpay, Google) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:push` | Push schema without migration files |
| `npm run db:studio` | Prisma Studio |

---

## Project structure

```
backend/
├── prisma/schema.prisma
├── src/
│   ├── server.js
│   ├── config/          # env, db, redis, logger
│   ├── routes/
│   ├── controllers/
│   ├── middlewares/     # upload, validation, errors, rate limits, logging
│   ├── services/
│   │   ├── resumeParserService.js
│   │   ├── llmResumeExtractor.js
│   │   ├── llmService.js
│   │   ├── growthAnalysisService.js
│   │   ├── analysisOrchestrator.js
│   │   ├── comparisonService.js
│   │   └── candidateService.js
│   ├── clients/crustdataClient.js
│   └── utils/           # dateUtils, scoreCalculator, sanitize, normalizeCompany
├── test/
├── scripts/test-crustdata.js
├── uploads/             # PDF storage (gitignored)
└── docker-compose.yml   # Redis
```

---

## Error codes

| Status | Meaning |
|--------|---------|
| `400` | Invalid body or params |
| `404` | Candidate not found |
| `422` | No work history extracted from resume |
| `502` | Crustdata or external API error |
| `503` | Rate limited (API or analyze endpoint) |

---

## Features implemented

- PDF resume parsing (Gemini primary, regex/heuristics fallback)
- Crustdata identify + enrich with Redis/DB cache
- Growth Exposure Score per employer and aggregate
- AI hiring summary + signals (Gemini + fallback)
- Side-by-side candidate comparison
- Request logging (Pino), API rate limits, input sanitization
