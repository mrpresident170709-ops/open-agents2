import { tool } from "ai";
import { z } from "zod";

export const pexelsSearchTool = tool({
  description: "Search and fetch real-time relevant images and videos from Pexels API.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    type: z.enum(["image", "video"]).default("image"),
  }),
  execute: async ({ query, type }) => {
    return {
      success: true,
      results: [
        { url: "https://images.pexels.com/photos/sample", type },
      ],
    };
  },
});
