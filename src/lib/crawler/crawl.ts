import PQueue from "p-queue";
import { chromium } from "playwright";

import { CRAWLER_USER_AGENT, DEFAULT_TIMEOUT_MS } from "./constants";
import { extractPageData } from "./extract";
import { getRobotsParser, isAllowedByRobots } from "./robots";
import type { CrawlOptions, ExtractedPage, IssueInfo } from "./types";
import {
  defaultHeaders,
  delay,
  isHttpUrl,
  isInternalUrl,
  normalizeUrl,
  resolveUrl,
} from "./utils";

type CrawlSummary = {
  pageCount: number;
  issueCount: number;
  brokenLinkCount: number;
  missingAssetCount: number;
};

type LinkCandidate = {
  url: string;
  text: string;
  isInternal: boolean;
};

type ImageCandidate = {
  url: string;
  alt: string;
};

async function checkUrlStatus(url: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: defaultHeaders(),
    });
    if (response.status === 405 || response.status === 403) {
      const fallback = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: defaultHeaders(),
      });
      return { statusCode: fallback.status, ok: fallback.ok };
    }
    return { statusCode: response.status, ok: response.ok };
  } catch {
    return { statusCode: null, ok: false };
  }
}

function buildIssues(data: {
  title: string | null;
  metaDescription: string | null;
  headings: { level: number; text: string }[];
  wordCount: number;
  lang: string | null;
  imagesMissingAlt: number;
  brokenLinks: number;
  missingAssets: number;
  statusCode: number | null;
  navigationError: string | null;
}): IssueInfo[] {
  const issues: IssueInfo[] = [];

  if (data.navigationError) {
    issues.push({
      type: "navigation_error",
      severity: "high",
      message: data.navigationError,
    });
  }

  if (data.statusCode && data.statusCode >= 400) {
    issues.push({
      type: "http_error",
      severity: "high",
      message: `Page returned status ${data.statusCode}.`,
    });
  }

  if (!data.title) {
    issues.push({
      type: "missing_title",
      severity: "high",
      message: "Missing page title.",
    });
  }

  if (!data.metaDescription) {
    issues.push({
      type: "missing_meta_description",
      severity: "medium",
      message: "Missing meta description.",
    });
  }

  const h1Count = data.headings.filter((heading) => heading.level === 1).length;
  if (h1Count === 0) {
    issues.push({
      type: "missing_h1",
      severity: "medium",
      message: "No H1 heading detected.",
    });
  } else if (h1Count > 1) {
    issues.push({
      type: "multiple_h1",
      severity: "low",
      message: "Multiple H1 headings detected.",
    });
  }

  if (!data.lang) {
    issues.push({
      type: "missing_lang",
      severity: "low",
      message: "Missing document language attribute.",
    });
  }

  if (data.wordCount < 250) {
    issues.push({
      type: "thin_content",
      severity: "low",
      message: "Low word count on page.",
    });
  }

  if (data.imagesMissingAlt > 0) {
    issues.push({
      type: "missing_alt",
      severity: "medium",
      message: `${data.imagesMissingAlt} image(s) missing alt text.`,
    });
  }

  if (data.brokenLinks > 0) {
    issues.push({
      type: "broken_links",
      severity: "high",
      message: `${data.brokenLinks} broken link(s) detected.`,
    });
  }

  if (data.missingAssets > 0) {
    issues.push({
      type: "missing_assets",
      severity: "high",
      message: `${data.missingAssets} missing asset(s) detected.`,
    });
  }

  return issues;
}

export async function crawlSite(
  options: CrawlOptions,
  onPage: (page: ExtractedPage) => Promise<void>,
): Promise<CrawlSummary> {
  const startUrl = normalizeUrl(options.startUrl);
  const origin = new URL(startUrl).origin;
  const queue: Array<{ url: string; depth: number }> = [
    { url: startUrl, depth: 0 },
  ];
  const visited = new Set<string>();

  const robots = await getRobotsParser(startUrl);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({
    userAgent: CRAWLER_USER_AGENT,
  });

  const summary: CrawlSummary = {
    pageCount: 0,
    issueCount: 0,
    brokenLinkCount: 0,
    missingAssetCount: 0,
  };

  while (queue.length > 0 && summary.pageCount < options.maxPages) {
    const next = queue.shift();
    if (!next) {
      break;
    }

    if (next.depth > options.maxDepth) {
      continue;
    }

    const normalized = normalizeUrl(next.url);
    if (visited.has(normalized)) {
      continue;
    }

    if (!isAllowedByRobots(robots, normalized)) {
      visited.add(normalized);
      continue;
    }

    visited.add(normalized);

    const page = await context.newPage();
    let statusCode: number | null = null;
    let navigationError: string | null = null;

    try {
      const response = await page.goto(normalized, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_TIMEOUT_MS,
      });
      statusCode = response?.status() ?? null;
    } catch (error) {
      navigationError =
        error instanceof Error ? error.message : "Navigation failed.";
    }

    let rawData: Awaited<ReturnType<typeof extractPageData>> = {
      title: null,
      metaDescription: null,
      headings: [],
      wordCount: 0,
      links: [],
      images: [],
      lang: null,
    };

    if (!navigationError) {
      rawData = await extractPageData(page);
    }

    const linkCandidates: LinkCandidate[] = rawData.links
      .map((link) => {
        const resolved = resolveUrl(normalized, link.href);
        if (!resolved || !isHttpUrl(resolved)) {
          return null;
        }

        return {
          url: normalizeUrl(resolved),
          text: link.text,
          isInternal: isInternalUrl(resolved, origin),
        };
      })
      .filter((candidate): candidate is LinkCandidate => Boolean(candidate));

    const imageCandidates: ImageCandidate[] = rawData.images
      .map((image) => {
        if (!image.src) {
          return null;
        }

        if (image.src.startsWith("data:")) {
          return null;
        }

        const resolved = resolveUrl(normalized, image.src);
        if (!resolved || !isHttpUrl(resolved)) {
          return null;
        }

        return {
          url: normalizeUrl(resolved),
          alt: image.alt,
        };
      })
      .filter((candidate): candidate is ImageCandidate => Boolean(candidate));

    const linkQueue = new PQueue({ concurrency: options.linkConcurrency });
    const linkResults = await Promise.all(
      linkCandidates.map((link) =>
        linkQueue.add(async () => {
          const status = await checkUrlStatus(link.url);
          return {
            ...link,
            statusCode: status.statusCode,
            isBroken: !status.ok,
          };
        }),
      ),
    );

    const assetQueue = new PQueue({ concurrency: options.assetConcurrency });
    const imageResults = await Promise.all(
      imageCandidates.map((image) =>
        assetQueue.add(async () => {
          const status = await checkUrlStatus(image.url);
          return {
            ...image,
            statusCode: status.statusCode,
            isMissing: !status.ok,
          };
        }),
      ),
    );

    const brokenLinks = linkResults.filter((link) => link.isBroken).length;
    const missingAssets = imageResults.filter((image) => image.isMissing).length;
    const imagesMissingAlt = imageResults.filter(
      (image) => image.alt.trim().length === 0,
    ).length;

    const issues = buildIssues({
      title: rawData.title,
      metaDescription: rawData.metaDescription,
      headings: rawData.headings,
      wordCount: rawData.wordCount,
      lang: rawData.lang,
      imagesMissingAlt,
      brokenLinks,
      missingAssets,
      statusCode,
      navigationError,
    });

    let screenshotBase64: string | null = null;
    try {
      const buffer = await page.screenshot({
        fullPage: true,
        type: "jpeg",
        quality: 60,
      });
      screenshotBase64 = buffer.toString("base64");
    } catch {
      screenshotBase64 = null;
    }

    await page.close();

    const extractedPage: ExtractedPage = {
      url: normalized,
      depth: next.depth,
      statusCode,
      title: rawData.title,
      metaDescription: rawData.metaDescription,
      headings: rawData.headings,
      wordCount: rawData.wordCount,
      links: linkResults,
      images: imageResults,
      issues,
      screenshotBase64,
    };

    summary.pageCount += 1;
    summary.issueCount += issues.length;
    summary.brokenLinkCount += brokenLinks;
    summary.missingAssetCount += missingAssets;

    await onPage(extractedPage);

    linkResults
      .filter((link) => link.isInternal)
      .forEach((link) => {
        if (!visited.has(link.url)) {
          queue.push({ url: link.url, depth: next.depth + 1 });
        }
      });

    if (options.delayMs > 0) {
      await delay(options.delayMs);
    }
  }

  await context.close();
  await browser.close();

  return summary;
}
