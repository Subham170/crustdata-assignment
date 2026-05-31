# GrowthLens AI — Frontend

Next.js (App Router) + Tailwind CSS + JavaScript UI for the GrowthLens backend.

**UI plan:** [FRONTEND_PLAN.md](../FRONTEND_PLAN.md)

## Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Backend should run at `http://localhost:8000` (see `NEXT_PUBLIC_API_URL`).

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Upload resume |
| `/candidates/[id]` | View profile & run analysis |
| `/compare` | Compare two analyzed candidates |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (port 3000) |
| `npm run build` | Production build |
| `npm start` | Start production server |
