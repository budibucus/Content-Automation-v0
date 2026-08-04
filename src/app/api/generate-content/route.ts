import { NextResponse } from "next/server";
import { runOrchestrator } from "@/lib/orchestrator";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { platform, funnelStage, topic } = await request.json();

  if (!platform || !funnelStage || !topic) {
    return NextResponse.json(
      { error: "platform, funnelStage, dan topic wajib diisi" },
      { status: 400 }
    );
  }

  const userGoal = `Buatkan naskah konten untuk platform "${platform}" pada tahap funnel "${funnelStage}" dengan topik/keresahan: "${topic}".`;

  const script = await runOrchestrator(userGoal);

  const { data, error } = await supabaseAdmin
    .from("content_pieces")
    .insert({
      format: platform,
      script,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    script,
    platform,
    funnelStage,
    id: data.id,
  });
}
