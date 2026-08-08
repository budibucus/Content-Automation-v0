import { claude, MODEL } from "@/lib/claude";
import { pmSystemPrompt } from "@/lib/prompts/pm";
import { runContentCreator } from "@/lib/agents/content-creator";
import { runProductCreator } from "@/lib/agents/product-creator";

interface ContentCreatorAgentInput {
  platform: "tiktok_video" | "tiktok_carousel" | "threads";
  funnelStage: "tofu" | "mofu" | "bofu";
  topic: string;
}

interface ProductCreatorAgentInput {
  jobRole: string;
  skills: string;
  dailyChallenge: string;
  availableTime: string;
  familyContext?: string;
}

export async function runOrchestrator(userGoal: string) {
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
      {
        name: "product_creator_agent",
        description:
          "Buat laporan Peta Skill ke Ide Bisnis personal berdasarkan profil customer",
        input_schema: {
          type: "object",
          properties: {
            jobRole: { type: "string" },
            skills: { type: "string" },
            dailyChallenge: { type: "string" },
            availableTime: { type: "string" },
            familyContext: { type: "string" },
          },
          required: ["jobRole", "skills", "dailyChallenge", "availableTime"],
        },
      },
    ],
  });

  const toolUse = response.content.find(
    (block) =>
      block.type === "tool_use" &&
      (block.name === "content_creator_agent" ||
        block.name === "product_creator_agent")
  );

  if (toolUse && toolUse.type === "tool_use") {
    if (toolUse.name === "content_creator_agent") {
      const input = toolUse.input as ContentCreatorAgentInput;
      return runContentCreator({
        platform: input.platform,
        funnelStage: input.funnelStage,
        topic: input.topic,
      });
    }

    if (toolUse.name === "product_creator_agent") {
      const input = toolUse.input as ProductCreatorAgentInput;
      const result = await runProductCreator({
        jobRole: input.jobRole,
        skills: input.skills,
        dailyChallenge: input.dailyChallenge,
        availableTime: input.availableTime,
        familyContext: input.familyContext,
      });
      return { result, toolName: toolUse.name };
    }
  }

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}
