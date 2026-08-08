import { NextResponse } from "next/server";
import { runOrchestrator } from "@/lib/orchestrator";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedCustomer } from "@/lib/auth";

export async function POST(request: Request) {
  const customer = await getAuthenticatedCustomer();

  if (!customer) {
    return NextResponse.json(
      { error: "Silakan login terlebih dahulu" },
      { status: 401 }
    );
  }

  const { jobRole, skills, dailyChallenge, availableTime, familyContext } =
    await request.json();

  if (!jobRole || !skills || !dailyChallenge || !availableTime) {
    return NextResponse.json(
      {
        error:
          "jobRole, skills, dailyChallenge, dan availableTime wajib diisi",
      },
      { status: 400 }
    );
  }

  const userGoal = `Ini permintaan untuk generate laporan "Peta Skill ke Ide Bisnis" berdasarkan profil customer berikut:
jobRole: ${jobRole}
skills: ${skills}
dailyChallenge: ${dailyChallenge}
availableTime: ${availableTime}
familyContext: ${familyContext ?? "(tidak disebutkan)"}`;

  const orchestratorResult = await runOrchestrator(userGoal);
  const result =
    typeof orchestratorResult === "string"
      ? orchestratorResult
      : orchestratorResult.result;

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert({
      title: "Peta Skill ke Ide Bisnis",
      status: "draft",
      content: JSON.stringify({
        result,
        profile: { jobRole, skills, dailyChallenge, availableTime, familyContext },
      }),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    result,
    id: data.id,
  });
}
