import { NextResponse } from "next/server";
import { runContentCreatorThreadJSON } from "@/lib/agents/content-creator";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

const ACTIVE_STAGES = ["tofu", "mofu"] as const;
// BOFU sengaja tidak dimasukkan untuk sementara, gampang ditambah balik
// nanti tinggal tambahkan "bofu" ke array ini (dan jam WIB-nya di
// STAGE_HOURS_WIB di bawah).
type ActiveStage = (typeof ACTIVE_STAGES)[number];

const STAGE_HOURS_WIB: Record<ActiveStage, number> = {
  tofu: 5,
  mofu: 11,
};

const DAYS_AHEAD = 14;

interface Slot {
  stage: ActiveStage;
  dateKey: string; // tanggal kalender WIB, format YYYY-MM-DD
  scheduledFor: string; // instant ISO dalam UTC
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function buildSlots(): Slot[] {
  const now = new Date();
  const startOfTodayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const slots: Slot[] = [];

  for (let i = 1; i <= DAYS_AHEAD; i++) {
    const day = new Date(startOfTodayUTC + i * 24 * 60 * 60 * 1000);
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth();
    const date = day.getUTCDate();
    const dateKey = `${year}-${pad(month + 1)}-${pad(date)}`;

    for (const stage of ACTIVE_STAGES) {
      const wibHour = STAGE_HOURS_WIB[stage];
      // Konversi WIB (UTC+7) ke UTC: kurangi 7 jam dari jam WIB. Date.UTC
      // otomatis handle rollback ke hari sebelumnya kalau hasilnya negatif.
      const scheduledFor = new Date(
        Date.UTC(year, month, date, wibHour - 7, 0, 0, 0)
      ).toISOString();

      slots.push({ stage, dateKey, scheduledFor });
    }
  }

  return slots;
}

// Konversi scheduled_for (UTC) yang tersimpan di database kembali ke
// tanggal kalender WIB, supaya bisa dibandingkan per tanggal (bukan per
// detik) dengan dateKey dari buildSlots().
function toWibDateKey(scheduledForUtc: string): string {
  const wib = new Date(
    new Date(scheduledForUtc).getTime() + 7 * 60 * 60 * 1000
  );
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(
    wib.getUTCDate()
  )}`;
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slots = buildSlots();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("content_pieces")
    .select("funnel_stage, scheduled_for")
    .in("funnel_stage", ACTIVE_STAGES)
    .not("scheduled_for", "is", null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const existingKeys = new Set(
    (existing ?? []).map(
      (row) => `${row.funnel_stage}|${toWibDateKey(row.scheduled_for)}`
    )
  );

  const toGenerate = slots.filter(
    (slot) => !existingKeys.has(`${slot.stage}|${slot.dateKey}`)
  );
  const skipped = slots.length - toGenerate.length;

  const generated = await Promise.all(
    toGenerate.map(async (slot) => {
      const result = await runContentCreatorThreadJSON(slot.stage);
      return {
        format: "threads",
        funnel_stage: slot.stage,
        thread_posts: result.posts,
        content_pillar: result.pillar,
        hook_type: result.hookType,
        scheduled_for: slot.scheduledFor,
        status: "pending_review",
      };
    })
  );

  let created = 0;

  if (generated.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("content_pieces")
      .insert(generated)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    created = data?.length ?? 0;
  }

  return NextResponse.json({ created, skipped });
}
