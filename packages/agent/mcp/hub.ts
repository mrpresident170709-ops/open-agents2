import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpServerDefinition } from "./config";

function stringifyCallToolContent(
  content: unknown,
): { text: string; isError?: boolean } {
  if (!Array.isArray(content)) {
    return { text: JSON.stringify(content), isError: false };
  }
  const lines: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") {
      lines.push(JSON.stringify(part));
      continue;
    }
    const p = part as Record<string, unknown>;
    if (p.type === "text" && typeof p.text === "string") {
      lines.push(p.text);
    } else if (p.type === "image" && typeof p.mimeType === "string") {
      lines.push(`[image ${p.mimeType}]`);
    } else {
      lines.push(JSON.stringify(part));
    }
  }
  return { text: lines.join("\n").trim() || "(empty)" };
}

/**
 * One MCP stdio client per logical server id; lazy-connect on first use.
 */
export class OpenHarnessMcpHub {
  private readonly clients = new Map<string, Client>();
  private readonly transports = new Map<string, StdioClientTransport>();

  constructor(private readonly config: Record<string, McpServerDefinition>) {}

  getServerIds(): string[] {
    return Object.keys(this.config);
  }

  private async ensureClient(serverId: string): Promise<Client> {
    const existing = this.clients.get(serverId);
    if (existing) {
      return existing;
    }

    const def = this.config[serverId];
    if (!def) {
      throw new Error(`Unknown MCP server id: ${serverId}`);
    }

    const transport = new StdioClientTransport({
      command: def.command,
      args: def.args ?? [],
      env: { ...getDefaultEnvironment(), ...(def.env ?? {}) },
      stderr: "pipe",
    });

    const client = new Client(
      {
        name: "open-harness",
        version: "0.0.0",
      },
      {
        capabilities: {},
      },
    );

    await client.connect(transport);
    this.clients.set(serverId, client);
    this.transports.set(serverId, transport);
    return client;
  }

  async listCatalogText(): Promise<string> {
    const sections: string[] = [];
    for (const id of this.getServerIds()) {
      const client = await this.ensureClient(id);
      const res = await client.listTools();
      const tools = res.tools ?? [];
      const lines = tools.map(
        (t) =>
          `- **${t.name}**${t.description ? `: ${t.description}` : ""}`,
      );
      sections.push(`### ${id}\n${lines.join("\n") || "(no tools)"}`);
    }
    return sections.join("\n\n");
  }

  async invoke(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
    try {
      const client = await this.ensureClient(serverId);
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });
      const structured = result as {
        isError?: boolean;
        content?: unknown;
      };
      if (structured.isError) {
        return {
          ok: false,
          error: stringifyCallToolContent(structured.content).text,
        };
      }
      return {
        ok: true,
        text: stringifyCallToolContent(structured.content).text,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  }

  async closeAll(): Promise<void> {
    for (const t of this.transports.values()) {
      try {
        await t.close();
      } catch {
        // ignore
      }
    }
    this.transports.clear();
    this.clients.clear();
  }
}
