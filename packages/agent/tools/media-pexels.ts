import { tool } from "ai";
import { z } from "zod";

function getPexelsKey(): string | undefined {
  return process.env.PEXELS_API_KEY?.trim() || undefined;
}

const inputSchema = z.object({
  query: z.string().min(1).describe("Pexels search query."),
  mediaType: z.enum(["photos", "videos"]),
  perPage: z.number().int().min(1).max(30).optional(),
});

const outputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    mediaType: z.enum(["photos", "videos"]),
    items: z.array(
      z.object({
        id: z.number(),
        width: z.number().optional(),
        height: z.number().optional(),
        url: z.string(),
        alt: z.string().optional(),
        photographer: z.string().optional(),
        photographerUrl: z.string().optional(),
        durationSeconds: z.number().optional(),
        videoFiles: z
          .array(
            z.object({
              quality: z.string().optional(),
              width: z.number().optional(),
              height: z.number().optional(),
              link: z.string(),
            }),
          )
          .optional(),
      }),
    ),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

export const mediaPexelsSearchTool = tool({
  description: `Search Pexels for stock photos or videos. Requires PEXELS_API_KEY.`,
  inputSchema,
  outputSchema,
  execute: async ({ query, mediaType, perPage = 10 }, { abortSignal }) => {
    const apiKey = getPexelsKey();
    if (!apiKey) {
      return {
        ok: false as const,
        error: "Pexels is not configured (missing PEXELS_API_KEY).",
      };
    }
    const q = encodeURIComponent(query);
    const url =
      mediaType === "photos"
        ? `https://api.pexels.com/v1/search?query=${q}&per_page=${perPage}`
        : `https://api.pexels.com/videos/search?query=${q}&per_page=${perPage}`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: apiKey },
        signal: abortSignal,
      });
      const payload: unknown = await res.json();
      if (!res.ok) {
        return {
          ok: false as const,
          error: `Pexels API error (${res.status}): ${JSON.stringify(payload)}`,
        };
      }
      if (mediaType === "photos") {
        const photos = (payload as { photos?: unknown[] }).photos ?? [];
        const items = photos.map((p: unknown) => {
          const o = p as Record<string, unknown>;
          const src = o.src as Record<string, unknown> | undefined;
          return {
            id: Number(o.id),
            width: typeof o.width === "number" ? o.width : undefined,
            height: typeof o.height === "number" ? o.height : undefined,
            url: String(src?.large ?? src?.original ?? ""),
            alt: typeof o.alt === "string" ? o.alt : undefined,
            photographer:
              typeof o.photographer === "string" ? o.photographer : undefined,
            photographerUrl:
              typeof o.photographer_url === "string"
                ? o.photographer_url
                : undefined,
          };
        });
        return { ok: true as const, mediaType: "photos" as const, items };
      }
      const videos = (payload as { videos?: unknown[] }).videos ?? [];
      const items = videos.map((v: unknown) => {
        const o = v as Record<string, unknown>;
        const files = Array.isArray(o.video_files)
          ? (o.video_files as Record<string, unknown>[]).map((f) => ({
              quality:
                typeof f.quality === "string" ? f.quality : undefined,
              width: typeof f.width === "number" ? f.width : undefined,
              height: typeof f.height === "number" ? f.height : undefined,
              link: typeof f.link === "string" ? f.link : "",
            }))
          : undefined;
        const bestLink =
          files?.find((f) => f.quality === "hd" && f.link)?.link ??
          files?.find((f) => f.link)?.link ??
          "";
        const image =
          typeof o.image === "string"
            ? o.image
            : typeof o.image === "object" && o.image !== null
              ? String((o.image as { large?: string }).large ?? "")
              : "";
        return {
          id: Number(o.id),
          width: typeof o.width === "number" ? o.width : undefined,
          height: typeof o.height === "number" ? o.height : undefined,
          url: bestLink || image,
          photographer:
            typeof o.user === "object" && o.user !== null
              ? String((o.user as { name?: string }).name ?? "")
              : undefined,
          durationSeconds:
            typeof o.duration === "number" ? o.duration : undefined,
          videoFiles: files,
        };
      });
      return { ok: true as const, mediaType: "videos" as const, items };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false as const, error: `Pexels request failed: ${message}` };
    }
  },
});
