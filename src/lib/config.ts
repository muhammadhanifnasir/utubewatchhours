export type CrawlConfig = {
  maxDepth: number;
  maxPages: number;
  delayMs: number;
  linkConcurrency: number;
  assetConcurrency: number;
};

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const defaultCrawlConfig: CrawlConfig = {
  maxDepth: parseNumber(process.env.CRAWLER_MAX_DEPTH, 2),
  maxPages: parseNumber(process.env.CRAWLER_MAX_PAGES, 50),
  delayMs: parseNumber(process.env.CRAWLER_DELAY_MS, 1200),
  linkConcurrency: parseNumber(process.env.CRAWLER_LINK_CONCURRENCY, 6),
  assetConcurrency: parseNumber(process.env.CRAWLER_ASSET_CONCURRENCY, 4),
};

export function getServerEnv() {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL.");
  }
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
  };
}
