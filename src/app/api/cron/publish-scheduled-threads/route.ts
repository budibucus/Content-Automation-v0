import { NextResponse } from "next/server";
import { publishThread } from "@/lib/threads";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 300;

interface PublishResult {
  id: string;
  status: "published" | "failed";
  error?: string;
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: dueContent, error: fetchError } = await supabaseAdmin
    .from("content_pieces")
    .select("id, thread_posts")
    .eq("status", "approved")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const results: PublishResult[] = [];

  // Publish satu content_piece per satu waktu (bukan Promise.all) supaya
  // tidak membanjiri Threads API dengan beberapa thread sekaligus - jeda
  // antar post di dalam publishThread cuma efektif kalau publish-nya sendiri
  // juga berurutan.
  for (const piece of dueContent ?? []) {
    try {
      await publishThread(piece.thread_posts as string[]);

      await supabaseAdmin
        .from("content_pieces")
        .update({ status: "published" })
        .eq("id", piece.id);

      results.push({ id: piece.id, status: "published" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      await supabaseAdmin
        .from("content_pieces")
        .update({ status: "failed", error_message: message })
        .eq("id", piece.id);

      results.push({ id: piece.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({
    processed: results.length,
    published: results.filter((r) => r.status === "published").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
}
