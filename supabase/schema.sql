create extension if not exists "pgcrypto";

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  start_url text not null unique,
  origin text not null,
  created_at timestamptz default now()
);

create table if not exists crawl_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  status text not null,
  started_at timestamptz,
  completed_at timestamptz,
  max_depth int,
  max_pages int,
  delay_ms int,
  page_count int default 0,
  issue_count int default 0,
  broken_link_count int default 0,
  missing_asset_count int default 0,
  error_message text,
  created_at timestamptz default now()
);

create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references crawl_runs(id) on delete cascade,
  url text not null,
  depth int,
  status_code int,
  title text,
  meta_description text,
  headings jsonb,
  word_count int,
  links jsonb,
  images jsonb,
  issues jsonb,
  screenshot_base64 text,
  created_at timestamptz default now()
);

create index if not exists pages_run_id_idx on pages(run_id);
