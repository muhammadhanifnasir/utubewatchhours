"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type RunRecord = {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  max_depth: number | null;
  max_pages: number | null;
  delay_ms: number | null;
  page_count: number | null;
  issue_count: number | null;
  broken_link_count: number | null;
  missing_asset_count: number | null;
  error_message: string | null;
  sites?: {
    start_url: string;
    origin: string;
  } | null;
};

type PageRecord = {
  id: string;
  url: string;
  depth: number;
  status_code: number | null;
  title: string | null;
  meta_description: string | null;
  word_count: number | null;
  headings: Array<{ level: number; text: string }>;
  links: Array<{ url: string; isBroken?: boolean; statusCode?: number | null }>;
  images: Array<{ url: string; isMissing?: boolean; statusCode?: number | null }>;
  issues: Array<{ type: string; severity: string; message: string }>;
  screenshot_base64: string | null;
};

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

export default function Home() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startUrl, setStartUrl] = useState("");
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(50);
  const [delayMs, setDelayMs] = useState(1200);

  const loadRuns = async () => {
    setLoadingRuns(true);
    try {
      const response = await fetch("/api/runs");
      const data = await response.json();
      setRuns(data.runs ?? []);
      if (!selectedRun && data.runs?.length) {
        setSelectedRun(data.runs[0]);
      }
    } catch {
      setError("Failed to load crawl runs.");
    } finally {
      setLoadingRuns(false);
    }
  };

  const loadRunPages = async (runId: string) => {
    setLoadingPages(true);
    try {
      const response = await fetch(`/api/runs/${runId}`);
      const data = await response.json();
      const normalizedPages = (data.pages ?? []).map((page: PageRecord) => ({
        ...page,
        headings: Array.isArray(page.headings) ? page.headings : [],
        links: Array.isArray(page.links) ? page.links : [],
        images: Array.isArray(page.images) ? page.images : [],
        issues: Array.isArray(page.issues) ? page.issues : [],
      }));
      setPages(normalizedPages);
    } catch {
      setError("Failed to load crawl pages.");
    } finally {
      setLoadingPages(false);
    }
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    if (selectedRun) {
      void loadRunPages(selectedRun.id);
    }
  }, [selectedRun]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrl,
          maxDepth,
          maxPages,
          delayMs,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start crawl.");
      }

      await loadRuns();
      setStartUrl("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to start crawl.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">
            Website Content Auditor
          </p>
          <h1 className="text-3xl font-semibold">
            Crawl sites, capture issues, and export reports.
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            Launch a crawl, review page-level SEO and accessibility insights,
            and download exports for follow-up.
          </p>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
          <form
            className="grid gap-4 md:grid-cols-[2fr_repeat(3,minmax(0,1fr))_auto]"
            onSubmit={handleSubmit}
          >
            <label className="flex flex-col gap-2 text-sm">
              Starting URL
              <input
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
                placeholder="https://example.com"
                value={startUrl}
                onChange={(event) => setStartUrl(event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Max depth
              <input
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                type="number"
                min={0}
                value={maxDepth}
                onChange={(event) => setMaxDepth(Number(event.target.value))}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Max pages
              <input
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                type="number"
                min={1}
                value={maxPages}
                onChange={(event) => setMaxPages(Number(event.target.value))}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Delay (ms)
              <input
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                type="number"
                min={0}
                step={100}
                value={delayMs}
                onChange={(event) => setDelayMs(Number(event.target.value))}
              />
            </label>
            <button
              className="mt-6 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Crawling..." : "Start crawl"}
            </button>
          </form>
          {error ? (
            <p className="mt-4 text-sm text-red-400">{error}</p>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_2fr]">
          <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent runs</h2>
              <button
                className="text-sm text-emerald-400"
                type="button"
                onClick={loadRuns}
                disabled={loadingRuns}
              >
                {loadingRuns ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <div className="space-y-3">
              {runs.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  No crawls yet. Start one to see results.
                </p>
              ) : (
                runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRun(run)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      selectedRun?.id === run.id
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {run.sites?.start_url ?? "Unknown site"}
                      </span>
                      <span className="text-xs uppercase text-zinc-400">
                        {run.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                      Started: {formatTimestamp(run.started_at)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Pages: {run.page_count ?? 0} · Issues:{" "}
                      {run.issue_count ?? 0}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Run details</h2>
                <p className="text-sm text-zinc-400">
                  {selectedRun?.sites?.start_url ?? "Select a run to inspect."}
                </p>
              </div>
              {selectedRun ? (
                <div className="flex items-center gap-3 text-sm">
                  <a
                    className="text-emerald-400"
                    href={`/api/runs/${selectedRun.id}?format=csv`}
                  >
                    Export CSV
                  </a>
                  <a
                    className="text-emerald-400"
                    href={`/api/runs/${selectedRun.id}`}
                  >
                    Export JSON
                  </a>
                </div>
              ) : null}
            </div>

            {selectedRun ? (
              <div className="grid gap-3 text-xs text-zinc-400 md:grid-cols-3">
                <div>
                  <p className="uppercase text-[10px] tracking-wide">Status</p>
                  <p className="text-sm text-zinc-200">{selectedRun.status}</p>
                </div>
                <div>
                  <p className="uppercase text-[10px] tracking-wide">
                    Completed
                  </p>
                  <p className="text-sm text-zinc-200">
                    {formatTimestamp(selectedRun.completed_at)}
                  </p>
                </div>
                <div>
                  <p className="uppercase text-[10px] tracking-wide">Errors</p>
                  <p className="text-sm text-zinc-200">
                    {selectedRun.error_message ?? "—"}
                  </p>
                </div>
              </div>
            ) : null}

            {loadingPages ? (
              <p className="text-sm text-zinc-400">Loading pages…</p>
            ) : pages.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No pages recorded for this run.
              </p>
            ) : (
              <div className="space-y-4">
                {pages.map((page) => {
                  const brokenLinks = page.links?.filter(
                    (link) => link.isBroken,
                  ).length;
                  const missingAssets = page.images?.filter(
                    (image) => image.isMissing,
                  ).length;

                  return (
                    <article
                      key={page.id}
                      className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 md:grid-cols-[160px_1fr]"
                    >
                      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                        {page.screenshot_base64 ? (
                          <Image
                            src={`data:image/jpeg;base64,${page.screenshot_base64}`}
                            alt={`Screenshot of ${page.url}`}
                            width={320}
                            height={200}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                            No screenshot
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {page.title ?? "Untitled page"}
                          </p>
                          <p className="text-xs text-zinc-400">{page.url}</p>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Status: {page.status_code ?? "—"} · Word count:{" "}
                          {page.word_count ?? 0} · Broken links:{" "}
                          {brokenLinks ?? 0} · Missing assets:{" "}
                          {missingAssets ?? 0}
                        </p>
                        {page.meta_description ? (
                          <p className="text-xs text-zinc-300">
                            {page.meta_description}
                          </p>
                        ) : null}
                        {page.issues?.length ? (
                          <ul className="text-xs text-amber-300">
                            {page.issues.map((issue, index) => (
                              <li key={`${page.id}-issue-${index}`}>
                                {issue.severity.toUpperCase()} ·{" "}
                                {issue.message}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-emerald-400">
                            No issues detected.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
