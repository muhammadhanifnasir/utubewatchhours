# Website Content Auditor

Audit websites by crawling internal pages, capturing SEO and accessibility signals, and exporting results. The crawler respects robots.txt, throttles requests, and stores results in Supabase.

## Features

- Crawl internal pages with depth and page limits
- Respect robots.txt directives
- Capture titles, meta descriptions, headings, word count, links, and images
- Screenshot every page with Playwright
- Detect broken links and missing assets
- Generate SEO and accessibility issue lists
- Store results in Supabase and display in a dashboard
- Export runs as CSV or JSON

## Getting Started

### 1) Configure Supabase

Run the SQL in `supabase/schema.sql` against your Supabase project.

### 2) Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
CRAWLER_MAX_DEPTH=2
CRAWLER_MAX_PAGES=50
CRAWLER_DELAY_MS=1200
CRAWLER_LINK_CONCURRENCY=6
CRAWLER_ASSET_CONCURRENCY=4
```

### 3) Install dependencies and run locally

```bash
npm install
npx playwright install --with-deps
npm run dev
```

Open `http://localhost:3000` and start a crawl.

## Deployment (Vercel)

1. Add the environment variables in your Vercel project settings.
2. Ensure the Supabase schema has been applied.
3. Deploy the project.

> Playwright requires a compatible runtime. Vercel Node functions should be configured to allow longer execution for crawl routes.

## API Endpoints

- `POST /api/crawl` — start a crawl
- `GET /api/runs` — list crawl runs
- `GET /api/runs/:runId` — run details and JSON export
- `GET /api/runs/:runId?format=csv` — CSV export
