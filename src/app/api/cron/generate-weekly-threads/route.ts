import { NextResponse } from "next/server";
import { runContentCreatorThreadJSON } from "@/lib/agents/content-creator";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

const SLOT_SCHEDULE = [
  { hour: 5, stage: "tofu" },
  { hour: 11, stage: "mofu" },
  { hour: 19, stage: "tofu" },
] as const;
type Stage = (typeof SLOT_SCHEDULE)[number]["stage"];

const ACTIVE_STAGES = [
  ...new Set(SLOT_SCHEDULE.map((slot) => slot.stage)),
] as Stage[];

const DAYS_AHEAD = 14;

interface Slot {
  stage: Stage;
  scheduledFor: string; // instant ISO dalam UTC
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

    for (const { hour: wibHour, stage } of SLOT_SCHEDULE) {
      // Konversi WIB (UTC+7) ke UTC: kurangi 7 jam dari jam WIB. Date.UTC
      // otomatis handle rollback ke hari sebelumnya kalau hasilnya negatif.
      const scheduledFor = new Date(
        Date.UTC(year, month, date, wibHour - 7, 0, 0, 0)
      ).toISOString();

      slots.push({ stage, scheduledFor });
    }
  }

  return slots;
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
      (row) =>
        `${row.funnel_stage}|${new Date(row.scheduled_for).toISOString()}`
    )
  );

  const toGenerate = slots.filter(
    (slot) => !existingKeys.has(`${slot.stage}|${slot.scheduledFor}`)
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
        content_type: result.contentType,
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
