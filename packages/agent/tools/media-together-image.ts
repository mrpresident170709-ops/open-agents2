import { Buffer } from "node:buffer";
import { tool } from "ai";
import { z } from "zod";
import * as path from "path";
import { getSandbox, toDisplayPath } from "./utils";

const TOGETHER_IMAGES_URL = "https://api.together.xyz/v1/images/generations";

function getTogetherKey(): string | undefined {
  return process.env.TOGETHER_API_KEY?.trim() || undefined;
}

function defaultImageModel(): string {
  return (
    process.env.TOGETHER_IMAGE_MODEL?.trim() || "google/flash-image-2.5"
  );
}

type AspectHint = "square" | "landscape" | "portrait" | "wide" | undefined;

function sizeForAspect(aspectHint: AspectHint): { width: number; height: number } {
  switch (aspectHint) {
    case "landscape":
      return { width: 1280, height: 720 };
    case "portrait":
      return { width: 720, height: 1280 };
    case "wide":
      return { width: 1536, height: 640 };
    case "square":
    default:
      return { width: 1024, height: 1024 };
  }
}

const inputSchema = z.object({
  prompt: z
    .string()
    .min(3)
    .describe(
      "Detailed image prompt: subject, style, lighting, composition, aspect hints.",
    ),
  aspectHint: z
    .enum(["square", "landscape", "portrait", "wide"])
    .optional()
    .describe("Rough aspect intent (maps to width/height)."),
  saveRelativePath: z
    .string()
    .optional()
    .describe(
      "Optional workspace-relative path to save the image (e.g. public/generated/hero.png).",
    ),
});

const outputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    model: z.string(),
    mimeType: z.string(),
    imageBase64: z.string(),
    savedPath: z.string().optional(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export type MediaTogetherImageOutput = z.infer<typeof outputSchema>;

const MAX_BASE64_CHARS = 2_400_000;

type TogetherImageItem =
  | { type: "b64_json"; b64_json: string; index?: number }
  | { type: "url"; url: string; index?: number };

/**
 * Image generation via Together AI (Gemini Flash Image, FLUX, etc.).
 */
export const mediaTogetherImageTool = tool({
  description: `Generate a raster image via Together AI POST /v1/images/generations.

Models (set TOGETHER_IMAGE_MODEL; confirm current ids on together.ai/models):
- Default: google/flash-image-2.5 (Flash / fast image class; often marketed alongside "Nano Banana"-style Gemini image on Together).
- Higher tier example: google/gemini-3-pro-image (Pro image; use when configured on your Together account).

WHEN TO USE:
- Custom hero art, marketing visuals, or bespoke illustrations when Pexels is not the right fit

REQUIRES: TOGETHER_API_KEY on the server.

Output includes base64 image data. Pass saveRelativePath to persist into the workspace.`,
  inputSchema,
  outputSchema,
  execute: async (
    { prompt, aspectHint, saveRelativePath },
    { experimental_context, abortSignal },
  ) => {
    const apiKey = getTogetherKey();
    if (!apiKey) {
      return {
        ok: false,
        error:
          "Together AI image generation is not configured (missing TOGETHER_API_KEY).",
      };
    }

    const model = defaultImageModel();
    const { width, height } = sizeForAspect(aspectHint);

    try {
      const res = await fetch(TOGETHER_IMAGES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          width,
          height,
          n: 1,
          response_format: "base64",
          output_format: "png",
          steps: 20,
        }),
        signal: abortSignal,
      });

      const payload: unknown = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          error: `Together image API error (${res.status}): ${JSON.stringify(payload)}`,
        };
      }

      const data = (payload as { data?: unknown[] }).data;
      if (!Array.isArray(data) || data.length === 0) {
        return {
          ok: false,
          error: `Together returned no images: ${JSON.stringify(payload)}`,
        };
      }

      const first = data[0] as TogetherImageItem;
      let imageBase64: string | undefined;
      let mimeType = "image/png";

      if (first && typeof first === "object" && first.type === "b64_json") {
        imageBase64 = first.b64_json;
      } else if (first && typeof first === "object" && first.type === "url") {
        const imgRes = await fetch(first.url, { signal: abortSignal });
        if (!imgRes.ok) {
          return {
            ok: false,
            error: `Failed to download image URL from Together: ${imgRes.status}`,
          };
        }
        const ct = imgRes.headers.get("content-type");
        if (ct?.includes("jpeg") || ct?.includes("jpg")) {
          mimeType = "image/jpeg";
        } else if (ct?.includes("webp")) {
          mimeType = "image/webp";
        }
        const buf = Buffer.from(await imgRes.arrayBuffer());
        imageBase64 = buf.toString("base64");
      }

      if (!imageBase64) {
        return {
          ok: false,
          error: `Unexpected Together image response shape: ${JSON.stringify(payload)}`,
        };
      }

      if (imageBase64.length > MAX_BASE64_CHARS) {
        return {
          ok: false,
          error: `Generated image is too large for tool output (${imageBase64.length} chars). Lower resolution or shorten the prompt.`,
        };
      }

      let savedPath: string | undefined;
      if (saveRelativePath) {
        const sandbox = await getSandbox(
          experimental_context,
          "media_together_image",
        );
        const wd = sandbox.workingDirectory;
        const absolutePath = path.isAbsolute(saveRelativePath)
          ? saveRelativePath
          : path.resolve(wd, saveRelativePath);
        const bytes = new Uint8Array(Buffer.from(imageBase64, "base64"));
        await sandbox.writeBinaryFile(absolutePath, bytes);
        savedPath = toDisplayPath(absolutePath, wd);
      }

      return {
        ok: true,
        model,
        mimeType,
        imageBase64,
        ...(savedPath ? { savedPath } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `Together image request failed: ${message}` };
    }
  },
});
