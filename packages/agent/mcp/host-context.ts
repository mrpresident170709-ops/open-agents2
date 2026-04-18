import { parseMcpServersConfig } from "./config";
import { OpenHarnessMcpHub } from "./hub";

/**
 * Experimental context objects that may carry a lazily-created MCP hub (mutated in place).
 */
export type McpExperimentalHost = {
  mcpHub?: OpenHarnessMcpHub;
};

export function getOrCreateMcpHub(host: McpExperimentalHost): OpenHarnessMcpHub | null {
  const cfg = parseMcpServersConfig();
  if (!cfg) {
    return null;
  }
  if (!host.mcpHub) {
    host.mcpHub = new OpenHarnessMcpHub(cfg);
  }
  return host.mcpHub;
}
