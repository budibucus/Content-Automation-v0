import { NextResponse } from "next/server";
import { runContentCreatorThreadJSON } from "@/lib/agents/content-creator";
import { supabaseAdmin } from "@/lib/supabase";

const VALID_STAGES = ["tofu", "mofu", "bofu"] as const;
type FunnelStage = (typeof VALID_STAGES)[number];

function isValidStage(value: string | null): value is FunnelStage {
  return VALID_STAGES.includes(value as FunnelStage);
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");

  if (!isValidStage(stage)) {
    return NextResponse.json(
      { error: "stage wajib salah satu dari tofu, mofu, bofu" },
      { status: 400 }
    );
  }

  const threadPosts = await runContentCreatorThreadJSON(stage);

  const { data, error } = await supabaseAdmin
    .from("content_pieces")
    .insert({
      format: "threads",
      funnel_stage: stage,
      thread_posts: threadPosts,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stage, id: data.id });
}
