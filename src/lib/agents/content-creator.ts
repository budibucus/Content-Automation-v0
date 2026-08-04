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
