export type McpServerDefinition = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

let cachedConfig: Record<string, McpServerDefinition> | null | undefined;

/**
 * Parse OPENHARNESS_MCP_SERVERS: JSON object of server id → { command, args?, env? },
 * or the same shape as Cursor's file: { "mcpServers": { ... } }.
 * Cached for the process lifetime.
 */
export function parseMcpServersConfig():
  | Record<string, McpServerDefinition>
  | null {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  const raw = process.env.OPENHARNESS_MCP_SERVERS?.trim();
  if (!raw) {
    cachedConfig = null;
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      cachedConfig = null;
      return null;
    }
    const rec = parsed as Record<string, unknown>;
    const inner =
      "mcpServers" in rec &&
      rec.mcpServers &&
      typeof rec.mcpServers === "object"
        ? (rec.mcpServers as Record<string, unknown>)
        : rec;

    const out: Record<string, McpServerDefinition> = {};
    for (const [id, def] of Object.entries(inner)) {
      if (!def || typeof def !== "object") continue;
      const o = def as Record<string, unknown>;
      if (typeof o.command !== "string") continue;

      const entry: McpServerDefinition = { command: o.command };
      if (Array.isArray(o.args)) {
        entry.args = o.args.map((a) => String(a));
      }
      if (
        o.env &&
        typeof o.env === "object" &&
        !Array.isArray(o.env) &&
        o.env !== null
      ) {
        entry.env = Object.fromEntries(
          Object.entries(o.env as Record<string, unknown>).map(([k, v]) => [
            k,
            String(v),
          ]),
        );
      }
      out[id] = entry;
    }

    if (Object.keys(out).length === 0) {
      cachedConfig = null;
      return null;
    }
    cachedConfig = out;
    return out;
  } catch {
    cachedConfig = null;
    return null;
  }
}

export function mcpServersConfigured(): boolean {
  return parseMcpServersConfig() !== null;
}
