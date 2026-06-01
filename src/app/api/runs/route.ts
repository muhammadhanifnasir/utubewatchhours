import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("crawl_runs")
    .select(
      "id,status,started_at,completed_at,max_depth,max_pages,delay_ms,page_count,issue_count,broken_link_count,missing_asset_count,error_message,sites(start_url,origin)",
    )
    .order("started_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: data ?? [] });
}
