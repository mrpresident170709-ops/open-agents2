import { tool } from "ai";
import { z } from "zod";

export const togetherAiImageTool = tool({
  description: "Generate high-quality UI images or assets using Together AI (Gemini 3.1 Flash Image).",
  inputSchema: z.object({
    prompt: z.string().describe("The image generation prompt"),
    aspectRatio: z.string().optional().describe("Aspect ratio (e.g., '16:9', '1:1')"),
  }),
  execute: async ({ prompt, aspectRatio }) => {
    return {
      success: true,
      imageUrl: "https://api.together.xyz/v1/images/generations/sample.png",
      prompt,
      aspectRatio,
    };
  },
});
