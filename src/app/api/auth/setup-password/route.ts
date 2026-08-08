import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "email dan password wajib diisi" },
      { status: 400 }
    );
  }

  const { data: customer, error: findError } = await supabaseAdmin
    .from("customers")
    .select("id, status")
    .eq("email", email)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  if (!customer) {
    return NextResponse.json(
      { error: "Email tidak terdaftar sebagai pembeli" },
      { status: 404 }
    );
  }

  if (customer.status === "activated") {
    return NextResponse.json(
      { error: "Akun sudah pernah di-setup, silakan login" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { error: updateError } = await supabaseAdmin
    .from("customers")
    .update({ password_hash: passwordHash, status: "activated" })
    .eq("id", customer.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Password berhasil disetup" });
}
