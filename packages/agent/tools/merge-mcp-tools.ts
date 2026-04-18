import type { ToolSet } from "ai";
import { parseMcpServersConfig } from "../mcp/config";
import { mcpInvokeTool, mcpListTool } from "./mcp";

/**
 * When OPENHARNESS_MCP_SERVERS is set, attach in-app MCP bridge tools.
 */
export function withMcpTools<T extends ToolSet>(base: T): ToolSet {
  if (!parseMcpServersConfig()) {
    return base;
  }
  return {
    ...base,
    mcp_list: mcpListTool,
    mcp_invoke: mcpInvokeTool,
  };
}
