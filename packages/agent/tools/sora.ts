import { tool } from "ai";
import { z } from "zod";

export const soraAnimationTool = tool({
  description: "Generate professional animations using Sora 2. Note: This tool should only be used once per task section. If it fails once, skip generating Sora animations for that section.",
  inputSchema: z.object({
    prompt: z.string().describe("Description of the animation to generate"),
    previousAttemptFailed: z.boolean().optional().describe("Set to true if a previous attempt in this section failed"),
  }),
  execute: async ({ prompt, previousAttemptFailed }) => {
    if (previousAttemptFailed) {
      return {
        success: false,
        error: "Sora 2 animation already attempted and failed in this section. Skipping per instructions.",
      };
    }
    // Implementation would use Sora 2 API
    return {
      success: true,
      videoUrl: "https://api.openai.com/v1/sora/sample.mp4",
      prompt,
    };
  },
});
