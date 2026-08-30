import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  }

  const { data: contentPiece, error: fetchError } = await supabaseAdmin
    .from("content_pieces")
    .select("id")
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

  const { data: updated, error } = await supabaseAdmin
    .from("content_pieces")
    .update({ status: "approved" })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: updated.id, status: updated.status });
}
