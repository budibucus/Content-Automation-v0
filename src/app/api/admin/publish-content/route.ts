import { NextResponse } from "next/server";
import { publishThread } from "@/lib/threads";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
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
      { error: "content_pieces row tidak ditemukan" },
      { status: 404 }
    );
  }

  try {
    const publishedIds = await publishThread(
      contentPiece.thread_posts as string[]
    );

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("content_pieces")
      .update({ status: "published" })
      .eq("id", id)
      .select("id, status")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      publishedIds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("content_pieces")
      .update({ status: "failed", error_message: message })
      .eq("id", id)
      .select("id, status, error_message")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(
      { id: updated.id, status: updated.status, error: updated.error_message },
      { status: 500 }
    );
  }
}
