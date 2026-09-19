import { BRAND_CONFIG } from "@/config/brand";

export const contentCreatorSystemPrompt = `${BRAND_CONFIG.persona}

${BRAND_CONFIG.writingStyleRules}

${BRAND_CONFIG.valuePrinciple}`;
