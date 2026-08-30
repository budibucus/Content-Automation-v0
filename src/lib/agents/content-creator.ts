import { claude, MODEL } from "@/lib/claude";
import { contentCreatorSystemPrompt } from "@/lib/prompts/content-creator";
import { supabaseAdmin } from "@/lib/supabase";
import { BRAND_CONFIG } from "@/config/brand";

// Data pillar & hook type sekarang terpusat di BRAND_CONFIG (src/config/brand.ts).
const CONTENT_PILLARS = BRAND_CONFIG.contentPillars;
const HOOK_TYPES = BRAND_CONFIG.hookTypes;

// "cerita_inspirasi_composite" dan "cerita_inspirasi_verified" adalah
// sub-kategori dari 1 pillar utama "cerita_inspirasi", bukan pillar
// terpisah - jadi nama pillar yang valid untuk dipilih adalah nama key di
// atas dengan suffix itu digabung jadi satu.
const PILLAR_NAMES = Array.from(
  new Set(
    Object.keys(CONTENT_PILLARS).map((key) =>
      key.replace(/_(composite|verified)$/, "")
    )
  )
);

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

interface PillarSeed {
  seed: string;
  extraInstruction: string;
}

function getSeedForPillar(pillar: string): PillarSeed {
  if (pillar === "cerita_inspirasi") {
    const verified = CONTENT_PILLARS.cerita_inspirasi_verified;
    const composite = CONTENT_PILLARS.cerita_inspirasi_composite;

    if (verified.length > 0) {
      return {
        seed: pickRandom(verified),
        extraInstruction:
          "Ini cerita FAKTA nyata - narasikan HANYA dari fakta yang diberikan, jangan menambah detail (nama, angka, atau kejadian) yang tidak ada di sumbernya.",
      };
    }

    return {
      seed: pickRandom(composite),
      extraInstruction:
        "Ini cerita ilustratif/komposit - buat sebagai cerita ilustratif/komposit, JANGAN klaim nama/angka spesifik sebagai fakta nyata.",
    };
  }

  const seeds = CONTENT_PILLARS[pillar];

  if (!seeds) {
    throw new Error(
      `Pillar tidak dikenal: "${pillar}". Pillar valid: ${PILLAR_NAMES.join(", ")}`
    );
  }

  return { seed: pickRandom(seeds), extraInstruction: "" };
}

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

function parseThreadPostsJSON(text: string): string[] {
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

async function getRecentFeedbackBlock(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("content_feedback_log")
    .select("notes")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(`[content-creator] Gagal ambil content_feedback_log: ${error.message}`);
    return "";
  }

  if (!data || data.length === 0) {
    return "";
  }

  const notesList = data.map((row, index) => `${index + 1}. ${row.notes}`).join("\n");

  return `Berikut catatan revisi dari konten-konten sebelumnya - jadikan pelajaran, hindari pola yang sama kalau relevan dengan konten yang sedang dibuat sekarang:\n${notesList}\n\n`;
}

export interface ThreadGenerationResult {
  posts: string[];
  pillar: string;
  hookType: string;
}

export async function runContentCreatorThreadJSON(
  funnelStage: FunnelStage,
  pillar?: string
): Promise<ThreadGenerationResult> {
  if (pillar !== undefined && !PILLAR_NAMES.includes(pillar)) {
    throw new Error(
      `Pillar tidak dikenal: "${pillar}". Pillar valid: ${PILLAR_NAMES.join(", ")}`
    );
  }

  const chosenPillar = pillar ?? pickRandom(PILLAR_NAMES);
  const { seed, extraInstruction } = getSeedForPillar(chosenPillar);
  const hookType = pickRandom(HOOK_TYPES);
  const feedbackBlock = await getRecentFeedbackBlock();

  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 1500,
    temperature: 1,
    system: contentCreatorSystemPrompt,
    messages: [
      {
        role: "user",
        content: `${feedbackBlock}Buat 1 thread Threads untuk tahap funnel ${funnelStage} tentang keresahan bapak-bapak kerja kantoran, dari pillar konten "${chosenPillar}". Pilih sendiri sudut pandang spesifik yang segar sesuai tahap funnel dan pillar ini. Gunakan momen/ide spesifik ini sebagai titik berangkat: ${seed}. Kembangkan dari momen ini, jangan generalisasi ke tema besar - tetap konkret dan personal.${extraInstruction ? ` ${extraInstruction}` : ""} Gaya hook untuk post pertama: ${hookType.name} - ${hookType.desc}. Balas HANYA dengan JSON array of strings, tanpa teks penjelasan apapun di luar JSON. Tiap string adalah 1 post dalam thread (maksimal 500 karakter, maksimal 1 hashtag kalau ada, post pertama adalah hook, total 3-5 post).`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return {
    posts: parseThreadPostsJSON(text),
    pillar: chosenPillar,
    hookType: hookType.name,
  };
}

export async function runContentRevision(
  threadPosts: string[],
  notes: string
): Promise<string[]> {
  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 1500,
    temperature: 1,
    system: contentCreatorSystemPrompt,
    messages: [
      {
        role: "user",
        content: `Ini thread Threads yang sudah dibuat sebelumnya (JSON array of strings, tiap string 1 post):\n${JSON.stringify(threadPosts)}\n\nAdmin minta revisi dengan catatan berikut: "${notes}"\n\nRevisi thread di atas sesuai catatan tersebut. Pertahankan bagian yang sudah bagus, cuma ubah yang perlu diubah sesuai catatan. Balas HANYA dengan JSON array of strings hasil revisi, tanpa teks penjelasan apapun di luar JSON. Tiap string adalah 1 post dalam thread (maksimal 500 karakter, maksimal 1 hashtag kalau ada, post pertama adalah hook, total 3-5 post).`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return parseThreadPostsJSON(text);
}
