import { NextResponse } from "next/server";
import { publishThread } from "@/lib/threads";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const { data: dueContent, error: fetchError } = await supabaseAdmin
    .from("content_pieces")
    .select("id, thread_posts")
    .eq("status", "approved")
    .gte("scheduled_for", oneHourAgo.toISOString())
    .lte("scheduled_for", now.toISOString());

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const publishedIds: string[] = [];

  // Publish satu per satu (bukan Promise.all) supaya tidak membanjiri
  // Threads API dengan beberapa thread sekaligus.
  for (const piece of dueContent ?? []) {
    // Row-locking sederhana: cuma lanjut kalau UPDATE ini benar-benar
    // mengubah row (masih berstatus "approved"). Kalau row sudah diambil
    // proses/invocation lain (race condition antar cron run), update ini
    // tidak akan match apa pun - skip tanpa error.
    const { data: locked, error: lockError } = await supabaseAdmin
      .from("content_pieces")
      .update({ status: "publishing" })
      .eq("id", piece.id)
      .eq("status", "approved")
      .select("id");

    if (lockError || !locked || locked.length === 0) {
      continue;
    }

    try {
      await publishThread(piece.thread_posts as string[]);

      await supabaseAdmin
        .from("content_pieces")
        .update({ status: "published" })
        .eq("id", piece.id);

      publishedIds.push(piece.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      await supabaseAdmin
        .from("content_pieces")
        .update({ status: "failed", error_message: message })
        .eq("id", piece.id);
    }
  }

  return NextResponse.json({ published: publishedIds });
}
