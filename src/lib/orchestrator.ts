import { claude, MODEL } from "@/lib/claude";
import { pmSystemPrompt } from "@/lib/prompts/pm";
import { runContentCreator } from "@/lib/agents/content-creator";

interface ContentCreatorAgentInput {
  platform: "tiktok_video" | "tiktok_carousel" | "threads";
  funnelStage: "tofu" | "mofu" | "bofu";
  topic: string;
}

export async function runOrchestrator(userGoal: string): Promise<string> {
  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: pmSystemPrompt,
    messages: [{ role: "user", content: userGoal }],
    tools: [
      {
        name: "content_creator_agent",
        description:
          "Buat naskah konten untuk TikTok atau Threads sesuai tahap funnel marketing",
        input_schema: {
          type: "object",
          properties: {
            platform: {
              type: "string",
              enum: ["tiktok_video", "tiktok_carousel", "threads"],
            },
            funnelStage: {
              type: "string",
              enum: ["tofu", "mofu", "bofu"],
            },
            topic: {
              type: "string",
            },
          },
          required: ["platform", "funnelStage", "topic"],
        },
      },
    ],
  });

  const toolUse = response.content.find(
    (block) =>
      block.type === "tool_use" && block.name === "content_creator_agent"
  );

  if (toolUse && toolUse.type === "tool_use") {
    const input = toolUse.input as ContentCreatorAgentInput;
    return runContentCreator({
      platform: input.platform,
      funnelStage: input.funnelStage,
      topic: input.topic,
    });
  }

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}
