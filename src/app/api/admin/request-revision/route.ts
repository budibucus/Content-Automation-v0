import { NextResponse } from "next/server";
import { runContentRevision } from "@/lib/agents/content-creator";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { id, notes } = await request.json();

  if (!id || !notes) {
    return NextResponse.json(
      { error: "id dan notes wajib diisi" },
      { status: 400 }
    );
  }

  const { data: contentPiece, error: fetchError } = await supabaseAdmin
    .from("content_pieces")
    .select("id, thread_posts")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!contentPiece) {
    return NextResponse.json(
      { error: "Konten tidak ditemukan" },
      { status: 404 }
    );
  }

  const revisedThreadPosts = await runContentRevision(
    contentPiece.thread_posts as string[],
    notes
  );

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("content_pieces")
    .update({
      thread_posts: revisedThreadPosts,
      revision_notes: notes,
      status: "pending_review",
    })
    .eq("id", id)
    .select("id, thread_posts")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log riwayat revisi secara terpisah (append-only), supaya catatan lama
  // tidak hilang ketika revision_notes di content_pieces ke-overwrite oleh
  // revisi berikutnya. Kegagalan di sini tidak menggagalkan response utama,
  // karena revisi kontennya sendiri sudah berhasil.
  const { error: logError } = await supabaseAdmin
    .from("content_feedback_log")
    .insert({ content_piece_id: id, notes });

  if (logError) {
    console.error(`[request-revision] Gagal insert content_feedback_log: ${logError.message}`);
  }

  return NextResponse.json({ thread_posts: updated.thread_posts });
}
