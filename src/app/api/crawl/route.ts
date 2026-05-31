import { NextResponse } from "next/server";

import { defaultCrawlConfig } from "@/lib/config";
import { crawlSite } from "@/lib/crawler/crawl";
import type { CrawlOptions } from "@/lib/crawler/types";
import { normalizeUrl } from "@/lib/crawler/utils";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type CrawlRequest = {
  startUrl?: string;
  maxDepth?: number;
  maxPages?: number;
  delayMs?: number;
};

function parseRequest(body: CrawlRequest): CrawlOptions {
  if (!body.startUrl) {
    throw new Error("startUrl is required.");
  }

  const startUrl = normalizeUrl(body.startUrl);
  const parsedUrl = new URL(startUrl);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("startUrl must be http or https.");
  }

  return {
    startUrl,
    maxDepth:
      typeof body.maxDepth === "number"
        ? Math.max(0, body.maxDepth)
        : defaultCrawlConfig.maxDepth,
    maxPages:
      typeof body.maxPages === "number"
        ? Math.max(1, body.maxPages)
        : defaultCrawlConfig.maxPages,
    delayMs:
      typeof body.delayMs === "number"
        ? Math.max(0, body.delayMs)
        : defaultCrawlConfig.delayMs,
    linkConcurrency: defaultCrawlConfig.linkConcurrency,
    assetConcurrency: defaultCrawlConfig.assetConcurrency,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CrawlRequest;

  let options: CrawlOptions;
  try {
    options = parseRequest(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const origin = new URL(options.startUrl).origin;

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .upsert({ start_url: options.startUrl, origin })
    .select()
    .single();

  if (siteError || !site) {
    return NextResponse.json(
      { error: siteError?.message ?? "Failed to create site." },
      { status: 500 },
    );
  }

  const { data: run, error: runError } = await supabase
    .from("crawl_runs")
    .insert({
      site_id: site.id,
      status: "running",
      started_at: new Date().toISOString(),
      max_depth: options.maxDepth,
      max_pages: options.maxPages,
      delay_ms: options.delayMs,
    })
    .select()
    .single();

  if (runError || !run) {
    return NextResponse.json(
      { error: runError?.message ?? "Failed to create crawl run." },
      { status: 500 },
    );
  }

  try {
    const summary = await crawlSite(options, async (page) => {
      await supabase.from("pages").insert({
        run_id: run.id,
        url: page.url,
        depth: page.depth,
        status_code: page.statusCode,
        title: page.title,
        meta_description: page.metaDescription,
        headings: page.headings,
        word_count: page.wordCount,
        links: page.links,
        images: page.images,
        issues: page.issues,
        screenshot_base64: page.screenshotBase64,
      });
    });

    await supabase
      .from("crawl_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        page_count: summary.pageCount,
        issue_count: summary.issueCount,
        broken_link_count: summary.brokenLinkCount,
        missing_asset_count: summary.missingAssetCount,
      })
      .eq("id", run.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crawler failed.";
    await supabase
      .from("crawl_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", run.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ runId: run.id });
}
