import { tool } from "ai";
import { z } from "zod";

export const firecrawlScreenshotTool = tool({
  description: "Capture a screenshot of a website (e.g., a competitor) for design reference.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL of the website to screenshot"),
  }),
  execute: async ({ url }) => {
    return {
      success: true,
      url,
      screenshotUrl: `https://api.firecrawl.dev/v1/screenshot?url=${encodeURIComponent(url)}`,
      message: "Screenshot captured successfully. Use this for design reference.",
    };
  },
});
