---
name: ui-excellence-stack
description: Agency-grade UI playbook for Open Harness — reference captures, design systems, Motion/GSAP, stock & generated media, shadcn/21st workflows, and MCP integrations. Use for new sites, landing pages, dashboards, app shells, or major redesigns when the user wants standout visual quality.
---

You are executing the **UI excellence stack**: ship interfaces that feel intentional, expensive, and fast — not generic template output.

## Open Harness native tools (always prefer these in this product)

These run on the server when keys exist; if a tool returns a configuration error, acknowledge it once and continue with code-only assets.

1. **Reference snapshot** — Capture markdown + rendered screenshot from a category leader or a URL you choose (ground layout, density, hero patterns). Run early on greenfield UI unless the user forbids external references.
2. **Pexels** — Real photos and stock video loops with working CDN URLs; keep attribution where required.
3. **Together AI image** (`media_together_image`) — Bespoke stills via Together. See **Image models** at the end of this skill.
4. **AI video (Sora-class)** — **At most one create per user request.** If it skips or errors, **do not call again**; use Pexels video or coded motion instead. Coded animation (CSS, Motion, GSAP) has no such limit.

## Cursor MCP (`.cursor/mcp.json`)

Enable each server in **Cursor → Settings → MCP**. Secrets are set in the UI per server (not committed).

| Server | Purpose | Env / notes |
|--------|---------|-------------|
| **shadcn** | Registry browse/search/install | None for public registry; private registries use `components.json` + env from [shadcn auth docs](https://ui.shadcn.com/docs/registry/authentication) |
| **reactbits** | Backgrounds, motion primitives | None |
| **21st-dev-magic** | Curated UI components / variations | **`API_KEY`** — [21st.dev](https://21st.dev) |
| **motion** | Motion docs, 330+ examples, CSS springs | Optional **`TOKEN`** — [Motion+ personal token](https://plus.motion.dev/personal-token) for Motion+ MCP features |
| **iconify** | Search 200+ icon sets | None usually; follow package docs if API limits apply |
| **icons8** | Large icon catalog (remote MCP) | Free PNG tier via remote URL; **SVG / paid** may need headers — see [Icons8 MCP](https://icons8.com/mcp) |

## Hosted Open Harness MCP (`OPENHARNESS_MCP_SERVERS`)

On your **deployment** (the Node host that runs the web agent), set **`OPENHARNESS_MCP_SERVERS`** to a JSON string so the in-app agent gets **`mcp_list`** / **`mcp_invoke`** (same stdio MCP pattern as Cursor).

- Shape: either a flat map of server id → `{ "command", "args"?, "env"? }`, or `{ "mcpServers": { ... } }` like `.cursor/mcp.json`.
- Copy **`mcpServers`** from `.cursor/mcp.json` and stringify it (escape quotes if the platform expects a single env value). Put secrets in each server’s **`env`** object — do not commit them.
- If this env var is **unset**, the web agent has no MCP bridge; use **bash** (`npx shadcn@latest add …`) and the native HTTP tools above.

## Theming (TweakCN)

- Design tokens live in **[apps/web/styles/theme-tweakcn.css](apps/web/styles/theme-tweakcn.css)** (imported from `app/globals.css`). On any **new** design-system pass, open TweakCN, export CSS variables, and paste `:root` / `.dark` blocks there so the app is not cookie-cutter default shadcn.

## External skills (install into `.agents/skills/`)

Prefer **one** approach per machine/sandbox:

**A. Universal Agent skills (AMP)** — from repo root:

```bash
npx skills add nextlevelbuilder/ui-ux-pro-max-skill -y -a amp
npx skills add greensock/gsap-skills -y -a amp
```

(Adjust repo slugs if the `skills` CLI expects `owner/repo` without `.git`.)

**B. Git clone** — clone into `.agents/skills/<folder>/` preserving `SKILL.md` frontmatter.

Reference repos for patterns (read before large UI work):

| Resource | Role |
|----------|------|
| [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git) | UX heuristics and UI decisions |
| [ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template.git) | Structure for reference-driven builds — use with **`website-clone-and-adapt`** |
| [gsap-skills](https://github.com/greensock/gsap-skills.git) / [GSAP](https://github.com/greensock/GSAP.git) | Timeline and scroll motion |
| [json-render](https://github.com/vercel-labs/json-render.git) | **Schema-driven UI** — when building JSON-to-UI flows, follow Vercel’s json-render patterns and types; do **not** invent ad-hoc JSON UI protocols |

## Parent agent before `task` → `design`

Before delegating large visual work to the **design** subagent, **you** (the parent) should already have invoked **`ui-excellence-stack`** and, for app surfaces, **`baseline-ui`** and **`emil-design-eng`** via the `skill` tool so constraints are loaded; pass distilled art direction and file targets in the task instructions.

## Execution order (typical greenfield UI)

1. Load this skill + `frontend-design` when the surface is visual; use **`website-clone-and-adapt`** if the user cited a competitor or clone request.
2. **Reference snapshot** for the product category (or user-supplied URL).
3. Lock **art direction**; sync **theme-tweakcn.css** when theming.
4. Implement with **accessible** semantics; Motion or GSAP for React motion; CSS when sufficient.
5. Pull **real media** (Pexels / Together image) instead of gray placeholders.
6. **Optional** single AI video attempt only if it materially helps; otherwise coded + stock.
7. **Verify** — run **`bun run ci`** (or the repo’s documented check script) after touching **`apps/web`** UI in any multi-file or non-trivial way.

## Image models (Together AI)

Set **`TOGETHER_API_KEY`**. Optional **`TOGETHER_IMAGE_MODEL`**:

| Model id (examples) | Notes |
|---------------------|--------|
| `google/flash-image-2.5` | Default in tooling; fast “Flash image” class on Together |
| `google/gemini-3-pro-image` | Higher-quality / Pro image tier when available on Together — confirm in [Together models](https://www.together.ai/models) |

Marketing names (e.g. “Nano Banana”) map to these server-side ids, not separate API hosts.

## Anti-patterns

- Inventing shadcn or Motion props — install or use MCP / docs.
- Retrying the AI video tool after a failure.
- Claiming Firecrawl/Pexels/Together/Sora ran when the tool output says the integration is missing.
- Skipping **`bun run ci`** after substantive UI changes.

Deliver originality: references inform hierarchy and polish; the shipped UI must be **your** design, legally and ethically distinct from competitors.
