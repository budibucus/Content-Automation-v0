import { claude, MODEL } from "@/lib/claude";
import { contentCreatorSystemPrompt } from "@/lib/prompts/content-creator";

type Platform = "tiktok_video" | "tiktok_carousel" | "threads";
type FunnelStage = "tofu" | "mofu" | "bofu";

interface RunContentCreatorParams {
  platform: Platform;
  funnelStage: FunnelStage;
  topic: string;
}

export async function runContentCreator({
  platform,
  funnelStage,
  topic,
}: RunContentCreatorParams): Promise<string> {
  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: contentCreatorSystemPrompt,
    messages: [
      {
        role: "user",
        content: `platform: ${platform}\nfunnel_stage: ${funnelStage}\ntopic: ${topic}\n\nBuatkan kontennya sesuai instruksi di system prompt.`,
      },
    ],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

export async function runContentCreatorThreadJSON(
  funnelStage: FunnelStage
): Promise<string[]> {
  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: contentCreatorSystemPrompt,
    messages: [
      {
        role: "user",
        content: `Buat 1 thread Threads untuk tahap funnel ${funnelStage} tentang keresahan bapak-bapak kerja kantoran. Pilih sendiri 1 sudut pandang spesifik yang segar - bisa lucu, reflektif personal, atau menginspirasi, sesuaikan dengan tahap funnel. Balas HANYA dengan JSON array of strings, tanpa teks penjelasan apapun di luar JSON. Tiap string adalah 1 post dalam thread (maksimal 500 karakter, maksimal 1 hashtag kalau ada, post pertama adalah hook, total 3-5 post).`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    throw new Error(
      `Gagal parse response Claude sebagai JSON array: ${text}`
    );
  }

  if (
    !Array.isArray(parsed) ||
    !parsed.every((item) => typeof item === "string")
  ) {
    throw new Error(`Response Claude bukan JSON array of strings: ${text}`);
  }

  return parsed;
}
