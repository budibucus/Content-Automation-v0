import { claude, MODEL } from "@/lib/claude";
import { productCreatorSystemPrompt } from "@/lib/prompts/product-creator";

interface RunProductCreatorParams {
  jobRole: string;
  skills: string;
  dailyChallenge: string;
  availableTime: string;
  familyContext?: string;
}

export async function runProductCreator({
  jobRole,
  skills,
  dailyChallenge,
  availableTime,
  familyContext,
}: RunProductCreatorParams): Promise<string> {
  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: productCreatorSystemPrompt,
    messages: [
      {
        role: "user",
        content: `jobRole: ${jobRole}
skills: ${skills}
dailyChallenge: ${dailyChallenge}
availableTime: ${availableTime}
familyContext: ${familyContext ?? "(tidak disebutkan)"}

Buatkan laporan personal 'Peta Skill ke Ide Bisnis' sesuai instruksi di system prompt.`,
      },
    ],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}
