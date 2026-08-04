import { NextResponse } from "next/server";
import { claude, MODEL } from "@/lib/claude";

export async function GET() {
  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: "Kamu adalah PM agent yang mengkoordinasikan tim AI.",
    messages: [
      {
        role: "user",
        content:
          "Panggil tool test_connection untuk memastikan koneksi ke sistem agent berjalan baik.",
      },
    ],
    tools: [
      {
        name: "test_connection",
        description: "Test apakah koneksi ke sistem agent berjalan baik",
        input_schema: {
          type: "object",
          properties: {},
        },
      },
    ],
  });

  return NextResponse.json(response.content);
}
