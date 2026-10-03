import { claude, MODEL } from "@/lib/claude";
import { contentCreatorSystemPrompt } from "@/lib/prompts/content-creator";
import { supabaseAdmin } from "@/lib/supabase";
import { BRAND_CONFIG, ACTIVE_CONTENT_TYPES } from "@/config/brand";

// Data pillar, hook type, content type & angle terpusat di BRAND_CONFIG
// (src/config/brand.ts).
const CONTENT_PILLARS = BRAND_CONFIG.contentPillars;
const HOOK_TYPES = BRAND_CONFIG.hookTypes;
const ANGLES = BRAND_CONFIG.angles;
const CONTENT_TYPES = BRAND_CONFIG.contentTypes.filter((type) =>
  ACTIVE_CONTENT_TYPES.includes(type.name)
);

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

interface PillarSeed {
  seed: string;
  extraInstruction: string;
}

const VERIFIED_INSTRUCTION =
  "Ini cerita FAKTA nyata - narasikan HANYA dari fakta yang diberikan, jangan menambah detail (nama, angka, atau kejadian) yang tidak ada di sumbernya.";
const COMPOSITE_INSTRUCTION =
  "Ini cerita ilustratif/komposit - buat sebagai cerita ilustratif/komposit, JANGAN klaim nama/angka spesifik sebagai fakta nyata.";

function seedsForPillar(pillar: string): PillarSeed[] {
  if (pillar === "cerita_inspirasi") {
    // Cerita verified dan composite digabung jadi 1 pool, supaya 2 cerita
    // verified tidak terus-terusan dipakai tiap kali pillar ini terpilih.
    return [
      ...CONTENT_PILLARS.cerita_inspirasi_verified.map((seed) => ({
        seed,
        extraInstruction: VERIFIED_INSTRUCTION,
      })),
      ...CONTENT_PILLARS.cerita_inspirasi_composite.map((seed) => ({
        seed,
        extraInstruction: COMPOSITE_INSTRUCTION,
      })),
    ];
  }

  const seeds = CONTENT_PILLARS[pillar];

  if (!seeds) {
    throw new Error(
      `Pillar tidak dikenal: "${pillar}". Pillar valid: ${PILLAR_NAMES.join(", ")}`
    );
  }

  return seeds.map((seed) => ({ seed, extraInstruction: "" }));
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// "Kantong" berisi semua item yang diacak; item diambil satu per satu dan
// kantong baru diisi ulang setelah habis. Hasilnya tiap item kebagian rata
// dalam 1 batch, bukan acak murni yang bisa milih item yang sama berulang.
function createBag<T>(items: T[]): () => T {
  let queue: T[] = [];
  return () => {
    if (queue.length === 0) {
      queue = shuffle(items);
    }
    return queue.pop()!;
  };
}

type ContentType = (typeof CONTENT_TYPES)[number];
type HookType = (typeof HOOK_TYPES)[number];

export interface ContentPlan {
  pillar: string;
  seed: string;
  extraInstruction: string;
  contentType: ContentType;
  hookType: HookType;
  angle: string;
}

// Rencanakan kombinasi pillar/seed/content type/hook/angle untuk sejumlah
// konten sekaligus, supaya dalam 1 batch tidak ada seed yang dipakai dua kali
// sebelum semua seed di pillar itu kebagian.
export function planContent(count: number): ContentPlan[] {
  const nextPillar = createBag(PILLAR_NAMES);
  const nextContentType = createBag(CONTENT_TYPES);
  const nextHookType = createBag(HOOK_TYPES);
  const nextAngle = createBag(ANGLES);
  const seedBags = new Map(
    PILLAR_NAMES.map((pillar) => [pillar, createBag(seedsForPillar(pillar))])
  );

  return Array.from({ length: count }, () => {
    const pillar = nextPillar();
    const { seed, extraInstruction } = seedBags.get(pillar)!();
    return {
      pillar,
      seed,
      extraInstruction,
      contentType: nextContentType(),
      hookType: nextHookType(),
      angle: nextAngle(),
    };
  });
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
  contentType: string;
}

// Ambil pembuka (post pertama) dari konten-konten terakhir, supaya Claude
// tahu cerita/tokoh/sudut pandang apa yang baru saja dipakai dan tidak
// mengulanginya.
async function getRecentHooksBlock(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("content_pieces")
    .select("thread_posts")
    .not("thread_posts", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error(`[content-creator] Gagal ambil konten terakhir: ${error.message}`);
    return "";
  }

  const hooks = (data ?? [])
    .map((row) => (row.thread_posts as string[] | null)?.[0])
    .filter((hook): hook is string => Boolean(hook))
    .map((hook, index) => `${index + 1}. ${hook.replace(/\s+/g, " ").slice(0, 160)}`);

  if (hooks.length === 0) {
    return "";
  }

  return `Berikut pembuka dari konten-konten yang BARU SAJA dibuat. Konten baru WAJIB terasa beda: jangan pakai ulang cerita, tokoh, contoh, metafora, kalimat pembuka, atau sudut pandang yang sama dengan daftar ini:\n${hooks.join("\n")}\n\n`;
}

export async function runContentCreatorThreadJSON(
  funnelStage: FunnelStage,
  plan: ContentPlan = planContent(1)[0]
): Promise<ThreadGenerationResult> {
  const { pillar, seed, extraInstruction, contentType, hookType, angle } = plan;

  const styleInstruction = `Struktur/format konten: ${contentType.name} - ${contentType.desc}. Gaya pembuka (hook): ${hookType.name} - ${hookType.desc}. Sudut pandang/cara bercerita: ${angle}.`;

  const [feedbackBlock, recentHooksBlock] = await Promise.all([
    getRecentFeedbackBlock(),
    getRecentHooksBlock(),
  ]);

  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 1500,
    temperature: 1,
    system: contentCreatorSystemPrompt,
    messages: [
      {
        role: "user",
        content: `${feedbackBlock}${recentHooksBlock}Buat 1 thread Threads untuk tahap funnel ${funnelStage} tentang keresahan bapak-bapak kerja kantoran, dari pillar konten "${pillar}". Gunakan momen/ide ini sebagai titik berangkat: ${seed}. Ide ini cuma pemantik - cari sudut yang spesifik dan nggak terduga dari situ, jangan sekadar menceritakan ulang idenya, dan jangan generalisasi ke tema besar - tetap konkret dan personal.${extraInstruction ? ` ${extraInstruction}` : ""} ${styleInstruction} Balas HANYA dengan JSON array of strings, tanpa teks penjelasan apapun di luar JSON. Tiap string adalah 1 post dalam thread (maksimal 500 karakter, maksimal 1 hashtag kalau ada, post pertama adalah hook). Jumlah post WAJIB: ${contentType.postCountHint} - ikuti ini, jangan ditambah-tambah.`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return {
    posts: parseThreadPostsJSON(text),
    pillar,
    hookType: hookType.name,
    contentType: contentType.name,
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
        content: `Ini thread Threads yang sudah dibuat sebelumnya (JSON array of strings, tiap string 1 post):\n${JSON.stringify(threadPosts)}\n\nAdmin minta revisi dengan catatan berikut: "${notes}"\n\nRevisi thread di atas sesuai catatan tersebut. Pertahankan bagian yang sudah bagus, cuma ubah yang perlu diubah sesuai catatan. Balas HANYA dengan JSON array of strings hasil revisi, tanpa teks penjelasan apapun di luar JSON. Tiap string adalah 1 post dalam thread (maksimal 500 karakter, maksimal 1 hashtag kalau ada, post pertama adalah hook). Pertahankan jumlah post seperti versi sebelumnya, kecuali catatan revisi minta diubah.`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return parseThreadPostsJSON(text);
}
