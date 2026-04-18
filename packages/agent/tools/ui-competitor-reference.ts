import { tool } from "ai";
import { z } from "zod";

const FIRECRAWL_V1 = "https://api.firecrawl.dev/v1";

function getFirecrawlKey(): string | undefined {
  return process.env.FIRECRAWL_API_KEY?.trim() || undefined;
}

const searchResultSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  markdown: z.string().nullable().optional(),
  screenshot: z.string().nullable().optional(),
});

type SearchHit = z.infer<typeof searchResultSchema>;

function pickBestHit(hits: SearchHit[]): SearchHit | undefined {
  for (const hit of hits) {
    if (hit.url && (hit.screenshot || hit.markdown)) {
      return hit;
    }
  }
  return hits[0];
}

const inputSchema = z.object({
  productCategory: z
    .string()
    .min(2)
    .describe(
      "Product or market category (e.g. 'B2B project management SaaS', 'consumer banking app'). Used to search for a leading competitor site when referenceUrl is omitted.",
    ),
  referenceUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional direct URL of the reference product/site to capture. When set, skips web search and scrapes this URL only.",
    ),
  fullPageScreenshot: z
    .boolean()
    .optional()
    .describe(
      "When true, requests a full-page screenshot (slower, richer layout reference). Default false (viewport screenshot).",
    ),
});

const outputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    referenceUrl: z.string(),
    pageTitle: z.string().optional(),
    screenshotUrl: z.string().nullable(),
    markdownExcerpt: z.string(),
    searchQuery: z.string().optional(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export type UiCompetitorReferenceOutput = z.infer<typeof outputSchema>;

/**
 * Captures a rendered screenshot + markdown excerpt from a category leader or a direct URL via Firecrawl.
 */
export const uiCompetitorReferenceTool = tool({
  description: `Capture a real rendered screenshot and content excerpt from a top competitor or reference site for UI work.

WHEN TO USE:
- At the start of a new UI/landing/app build, to anchor visual and IA decisions in a real market leader
- When the user names a category ("build a CRM landing page") and you need a concrete visual reference
- When you have a specific competitor URL to study

REQUIRES: FIRECRAWL_API_KEY on the server.

BEHAVIOR:
- If referenceUrl is provided, scrapes that URL
- Otherwise runs a focused web search for the category and scrapes the best result (markdown + screenshot)
- Returns a hosted screenshot URL (expires ~24h per Firecrawl) plus a trimmed markdown excerpt for structure/copy patterns

Do not mention vendor SDK names to end users; describe this as capturing a reference snapshot.`,
  inputSchema,
  outputSchema,
  execute: async (
    { productCategory, referenceUrl, fullPageScreenshot },
    { abortSignal },
  ): Promise<UiCompetitorReferenceOutput> => {
    const apiKey = getFirecrawlKey();
    if (!apiKey) {
      return {
        ok: false,
        error:
          "Firecrawl is not configured (missing FIRECRAWL_API_KEY). Skip reference capture or ask the operator to add the key.",
      };
    }

    const screenshotFormat = fullPageScreenshot
      ? "screenshot@fullPage"
      : "screenshot";

    try {
      if (referenceUrl) {
        const res = await fetch(`${FIRECRAWL_V1}/scrape`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: referenceUrl,
            formats: ["markdown", screenshotFormat],
            onlyMainContent: true,
          }),
          signal: abortSignal,
        });

        const payload: unknown = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            error: `Firecrawl scrape failed (${res.status}): ${JSON.stringify(payload)}`,
          };
        }

        const data = (payload as { data?: Record<string, unknown> }).data;
        const markdown = typeof data?.markdown === "string" ? data.markdown : "";
        const screenshot =
          typeof data?.screenshot === "string" ? data.screenshot : null;
        const title =
          data?.metadata &&
          typeof (data.metadata as { title?: string }).title === "string"
            ? (data.metadata as { title: string }).title
            : undefined;

        return {
          ok: true,
          referenceUrl,
          pageTitle: title,
          screenshotUrl: screenshot,
          markdownExcerpt: markdown.slice(0, 12_000),
        };
      }

      const searchQuery = `best popular ${productCategory} product website homepage`;
      const searchRes = await fetch(`${FIRECRAWL_V1}/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 5,
          ignoreInvalidURLs: true,
          scrapeOptions: {
            formats: ["markdown", screenshotFormat],
            onlyMainContent: true,
          },
        }),
        signal: abortSignal,
      });

      const searchPayload: unknown = await searchRes.json();
      if (!searchRes.ok) {
        return {
          ok: false,
          error: `Firecrawl search failed (${searchRes.status}): ${JSON.stringify(searchPayload)}`,
        };
      }

      const rawData = (searchPayload as { data?: unknown }).data;
      if (!Array.isArray(rawData) || rawData.length === 0) {
        return {
          ok: false,
          error: "Firecrawl search returned no results for this category.",
        };
      }

      const parsed: SearchHit[] = [];
      for (const item of rawData) {
        const r = searchResultSchema.safeParse(item);
        if (r.success) {
          parsed.push(r.data);
        }
      }

      const hit = pickBestHit(parsed);
      if (!hit?.url) {
        return {
          ok: false,
          error: "Could not resolve a reference URL from search results.",
        };
      }

      const md = hit.markdown ?? "";
      return {
        ok: true,
        referenceUrl: hit.url,
        pageTitle: hit.title,
        screenshotUrl: hit.screenshot ?? null,
        markdownExcerpt: md.slice(0, 12_000),
        searchQuery,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: `Reference capture failed: ${message}`,
      };
    }
  },
});
