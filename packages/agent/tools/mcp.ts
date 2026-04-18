import { tool } from "ai";
import { z } from "zod";
import { getOrCreateMcpHub, type McpExperimentalHost } from "../mcp/host-context";
import { mcpServersConfigured, parseMcpServersConfig } from "../mcp/config";

const listOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    catalog: z.string(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

const invokeInputSchema = z.object({
  server: z
    .string()
    .min(1)
    .describe(
      "MCP server id from OPENHARNESS_MCP_SERVERS (e.g. shadcn, motion, iconify).",
    ),
  tool: z.string().min(1).describe("Tool name as reported by mcp_list."),
  arguments: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Tool arguments object (JSON-serializable)."),
});

const invokeOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    text: z.string(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export const mcpListTool = tool({
  description: `List MCP tools available to the in-app agent (stdio servers from OPENHARNESS_MCP_SERVERS).

WHEN TO USE:
- Before calling an MCP integration (shadcn registry, Motion examples, 21st components, etc.) to see exact tool names and parameters.

If this returns "not configured", MCP is disabled on the host — use bash (e.g. npx shadcn) instead.`,
  inputSchema: z.object({}),
  outputSchema: listOutputSchema,
  execute: async (_, { experimental_context }) => {
    if (!mcpServersConfigured()) {
      return {
        ok: false as const,
        error:
          "MCP not configured. Set OPENHARNESS_MCP_SERVERS on the web app host (JSON, same shape as .cursor/mcp.json mcpServers).",
      };
    }
    const host = experimental_context as McpExperimentalHost;
    const hub = getOrCreateMcpHub(host);
    if (!hub) {
      return { ok: false as const, error: "MCP config parse failed." };
    }
    try {
      const catalog = await hub.listCatalogText();
      return { ok: true as const, catalog };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false as const, error: message };
    }
  },
});

export const mcpInvokeTool = tool({
  description: `Invoke a tool on a configured MCP server (shadcn, motion, 21st-dev-magic, reactbits, iconify, icons8, etc.).

Call mcp_list first if you do not know tool names. Each invocation may spawn or reuse a long-lived stdio server process on the agent host.`,
  inputSchema: invokeInputSchema,
  outputSchema: invokeOutputSchema,
  execute: async (
    { server, tool: toolName, arguments: args = {} },
    { experimental_context },
  ) => {
    if (!mcpServersConfigured()) {
      return {
        ok: false as const,
        error:
          "MCP not configured. Set OPENHARNESS_MCP_SERVERS on the web app host.",
      };
    }
    const cfg = parseMcpServersConfig();
    if (!cfg || !(server in cfg)) {
      return {
        ok: false as const,
        error: `Unknown server "${server}". Known: ${Object.keys(cfg ?? {}).join(", ") || "(none)"}`,
      };
    }
    const host = experimental_context as McpExperimentalHost;
    const hub = getOrCreateMcpHub(host);
    if (!hub) {
      return { ok: false as const, error: "MCP hub unavailable." };
    }
    const result = await hub.invoke(server, toolName, args);
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    return { ok: true as const, text: result.text };
  },
});
