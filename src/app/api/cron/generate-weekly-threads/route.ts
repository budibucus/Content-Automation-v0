import { NextResponse } from "next/server";
import { planContent, runContentCreatorThreadJSON } from "@/lib/agents/content-creator";
import { supabaseAdmin } from "@/lib/supabase";

// 14 hari x 3 slot = sampai 42 panggilan Claude; 60 detik tidak cukup.
export const maxDuration = 300;

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
const CONCURRENCY = 6;

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

  // Generate per batch (bukan semua sekaligus) supaya tidak kena rate limit
  // Claude. Pakai allSettled: kalau 1 slot gagal (misal JSON tidak valid),
  // slot lain tetap disimpan - slot yang gagal otomatis diisi di run
  // berikutnya karena belum ada di existingKeys.
  // Rencana pillar/seed/tipe konten dibuat sekaligus untuk semua slot supaya
  // tersebar rata, bukan acak sendiri-sendiri per slot.
  const plans = planContent(toGenerate.length);
  const generated: Record<string, unknown>[] = [];
  const failures: string[] = [];

  for (let i = 0; i < toGenerate.length; i += CONCURRENCY) {
    const batch = toGenerate.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((slot, index) =>
        runContentCreatorThreadJSON(slot.stage, plans[i + index])
      )
    );

    results.forEach((result, index) => {
      const slot = batch[index];

      if (result.status === "rejected") {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        console.error(
          `[generate-weekly] Gagal generate ${slot.stage} ${slot.scheduledFor}: ${message}`
        );
        failures.push(`${slot.stage}|${slot.scheduledFor}`);
        return;
      }

      generated.push({
        format: "threads",
        funnel_stage: slot.stage,
        thread_posts: result.value.posts,
        content_pillar: result.value.pillar,
        hook_type: result.value.hookType,
        content_type: result.value.contentType,
        scheduled_for: slot.scheduledFor,
        status: "pending_review",
      });
    });
  }

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

  return NextResponse.json({ created, skipped, failed: failures });
}
