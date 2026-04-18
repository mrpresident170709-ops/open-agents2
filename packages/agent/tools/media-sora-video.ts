import { tool } from "ai";
import { z } from "zod";
import * as path from "path";
import { getSandbox, toDisplayPath } from "./utils";

function getOpenAiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

const inputSchema = z.object({
  prompt: z
    .string()
    .min(8)
    .describe(
      "Cinematic description for a single short motion clip (brand motion, hero background loop, etc.).",
    ),
  model: z
    .enum(["sora-2", "sora-2-pro"])
    .optional()
    .describe("Video model. Default sora-2."),
  seconds: z
    .enum(["4", "8", "12"])
    .optional()
    .describe("Clip length in seconds. Default 4."),
  size: z
    .enum(["720x1280", "1280x720", "1024x1792", "1792x1024"])
    .optional()
    .describe("Output size. Default 720x1280."),
  saveRelativePath: z
    .string()
    .optional()
    .describe(
      "Optional workspace-relative path to save the MP4 (e.g. public/media/hero-loop.mp4). Parent dirs are created. When download fails, the tool still reports status without saving.",
    ),
});

const outputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    status: z.string(),
    videoId: z.string(),
    savedPath: z.string().optional(),
    note: z.string().optional(),
  }),
  z.object({
    ok: z.literal(false),
    skipped: z.literal(true),
    reason: z.string(),
  }),
]);

export type MediaSoraVideoOutput = z.infer<typeof outputSchema>;

const POLL_INTERVAL_MS = 8000;
const POLL_MAX_ATTEMPTS = 14;

async function sleep(ms: number, signal: AbortSignal | undefined) {
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      if (signal.aborted) {
        clearTimeout(t);
        reject(signal.reason);
        return;
      }
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          reject(signal.reason);
        },
        { once: true },
      );
    }
  });
}

type VideoJob = {
  id?: string;
  status?: string;
  error?: { message?: string; code?: string };
};

/**
 * One-shot Sora-class video generation via OpenAI Videos API (when enabled for the key).
 * Does not retry failed jobs; polling is only for the same single job to complete.
 */
export const mediaSoraVideoTool = tool({
  description: `Request ONE short AI-generated video clip (OpenAI Sora-class models) for motion backgrounds or marketing teasers.

STRICT RULES:
- Call at most ONCE per user request for this tool — no duplicate creates on failure
- If the API returns an error, quota issue, or timeout, STOP — do not call again; continue with coded animation (CSS, Motion, GSAP) or stock video (Pexels) instead
- This is separate from in-code Framer Motion / CSS animation, which you should still apply liberally

REQUIRES: OPENAI_API_KEY with video access.

Optional saveRelativePath writes the MP4 into the workspace when generation completes.`,
  inputSchema,
  outputSchema,
  execute: async (
    { prompt, model = "sora-2", seconds = "4", size = "720x1280", saveRelativePath },
    { experimental_context, abortSignal },
  ) => {
    const apiKey = getOpenAiKey();
    if (!apiKey) {
      return {
        ok: false,
        skipped: true as const,
        reason:
          "OpenAI API key missing — skipping Sora. Use Pexels videos or coded animation.",
      };
    }

    try {
      const createRes = await fetch("https://api.openai.com/v1/videos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          seconds,
          size,
        }),
        signal: abortSignal,
      });

      const created: unknown = await createRes.json();
      if (!createRes.ok) {
        return {
          ok: false,
          skipped: true as const,
          reason: `Sora create failed (${createRes.status}): ${JSON.stringify(created)}`,
        };
      }

      const job = created as VideoJob;
      const videoId = typeof job.id === "string" ? job.id : undefined;
      if (!videoId) {
        return {
          ok: false,
          skipped: true as const,
          reason: `Sora create returned no id: ${JSON.stringify(created)}`,
        };
      }

      let latest: VideoJob = job;
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i += 1) {
        const st = latest.status;
        if (st === "failed" || latest.error) {
          return {
            ok: false,
            skipped: true as const,
            reason: `Sora job failed: ${latest.error?.message ?? JSON.stringify(latest.error)}`,
          };
        }
        if (st === "completed") {
          break;
        }
        if (i === POLL_MAX_ATTEMPTS - 1) {
          return {
            ok: false,
            skipped: true as const,
            reason:
              "Sora job did not finish in time — skip and use coded animation or stock video.",
          };
        }
        await sleep(POLL_INTERVAL_MS, abortSignal);
        const pollRes = await fetch(
          `https://api.openai.com/v1/videos/${encodeURIComponent(videoId)}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: abortSignal,
          },
        );
        latest = (await pollRes.json()) as VideoJob;
        if (!pollRes.ok) {
          return {
            ok: false,
            skipped: true as const,
            reason: `Sora poll failed (${pollRes.status}): ${JSON.stringify(latest)}`,
          };
        }
      }

      if (latest.status !== "completed") {
        return {
          ok: false,
          skipped: true as const,
          reason: `Sora ended in unexpected state: ${latest.status}`,
        };
      }

      let savedPath: string | undefined;
      if (saveRelativePath) {
        const sandbox = await getSandbox(experimental_context, "media_sora_video");
        const wd = sandbox.workingDirectory;
        const absolutePath = path.isAbsolute(saveRelativePath)
          ? saveRelativePath
          : path.resolve(wd, saveRelativePath);
        const dir = path.dirname(absolutePath);
        await sandbox.mkdir(dir, { recursive: true });

        const contentRes = await fetch(
          `https://api.openai.com/v1/videos/${encodeURIComponent(videoId)}/content`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: abortSignal,
          },
        );

        if (!contentRes.ok) {
          const errText = await contentRes.text();
          return {
            ok: true,
            status: "completed",
            videoId,
            note: `Video ready but download failed (${contentRes.status}): ${errText}`,
          };
        }

        const buffer = new Uint8Array(await contentRes.arrayBuffer());
        await sandbox.writeBinaryFile(absolutePath, buffer);
        savedPath = toDisplayPath(absolutePath, wd);
      }

      return {
        ok: true,
        status: "completed",
        videoId,
        ...(savedPath ? { savedPath } : {}),
        ...(!saveRelativePath
          ? {
              note: "Video job completed. Pass saveRelativePath next time to persist MP4 in the repo, or download via your OpenAI dashboard.",
            }
          : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        skipped: true as const,
        reason: `Sora pipeline error (no retry): ${message}`,
      };
    }
  },
});
