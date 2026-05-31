import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } },
) {
  const { runId } = params;
  const supabase = getSupabaseServerClient();

  const { data: run, error: runError } = await supabase
    .from("crawl_runs")
    .select(
      "id,status,started_at,completed_at,max_depth,max_pages,delay_ms,page_count,issue_count,broken_link_count,missing_asset_count,error_message,sites(start_url,origin)",
    )
    .eq("id", runId)
    .single();

  if (runError || !run) {
    return NextResponse.json(
      { error: runError?.message ?? "Run not found." },
      { status: 404 },
    );
  }

  const { data: pages, error: pagesError } = await supabase
    .from("pages")
    .select(
      "id,url,depth,status_code,title,meta_description,word_count,headings,links,images,issues,screenshot_base64,created_at",
    )
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (pagesError) {
    return NextResponse.json({ error: pagesError.message }, { status: 500 });
  }

  const request = new URL(_request.url);
  const format = request.searchParams.get("format");

  if (format === "csv") {
    const headers = [
      "url",
      "title",
      "meta_description",
      "word_count",
      "status_code",
      "issue_count",
      "broken_link_count",
      "missing_asset_count",
    ];

    const rows = (pages ?? []).map((page) => {
      const issues = Array.isArray(page.issues) ? page.issues.length : 0;
      const brokenLinks = Array.isArray(page.links)
        ? page.links.filter((link: { isBroken?: boolean }) => link.isBroken)
            .length
        : 0;
      const missingAssets = Array.isArray(page.images)
        ? page.images.filter((image: { isMissing?: boolean }) => image.isMissing)
            .length
        : 0;

      return [
        page.url,
        page.title ?? "",
        page.meta_description ?? "",
        String(page.word_count ?? 0),
        String(page.status_code ?? ""),
        String(issues),
        String(brokenLinks),
        String(missingAssets),
      ].map(csvEscape);
    });

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n",
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=\"crawl-${runId}.csv\"`,
      },
    });
  }

  return NextResponse.json({ run, pages: pages ?? [] });
}
