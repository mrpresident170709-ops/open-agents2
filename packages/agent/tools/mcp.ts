import { tool } from "ai";
import { z } from "zod";

export const mcpTool = tool({
  description: "Access a library of production-grade UI components, icons, and animations through MCP servers (21st.dev, shadcn, ReactBits, Iconify, etc.).",
  inputSchema: z.object({
    server: z.enum(["21st.dev", "shadcn", "reactbits", "motion", "icons8", "iconify"]),
    prompt: z.string().describe("What you want to find or generate using the MCP server"),
  }),
  execute: async ({ server, prompt }) => {
    return {
      success: true,
      server,
      prompt,
      componentCode: "// Polished component code from " + server,
    };
  },
});
