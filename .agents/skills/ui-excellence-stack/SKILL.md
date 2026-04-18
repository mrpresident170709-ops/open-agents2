---
name: ui-excellence-stack
description: Agency-grade UI playbook for Open Harness — reference captures, design systems, Motion/GSAP, stock & generated media, shadcn/21st workflows, and MCP integrations. Use for new sites, landing pages, dashboards, app shells, or major redesigns when the user wants standout visual quality.
---

You are executing the **UI excellence stack**: ship interfaces that feel intentional, expensive, and fast — not generic template output.

## Open Harness native tools (always prefer these in this product)

These run on the server when keys exist; if a tool returns a configuration error, acknowledge it once and continue with code-only assets.

1. **Reference snapshot** — Capture markdown + rendered screenshot from a category leader or a URL you choose (ground layout, density, hero patterns). Run early on greenfield UI unless the user forbids external references.
2. **Pexels** — Real photos and stock video loops with working CDN URLs; keep attribution where required.
3. **Together AI image** (`media_together_image`) — Bespoke stills via Together (default `google/flash-image-2.5`; set `TOGETHER_API_KEY`, optional `TOGETHER_IMAGE_MODEL` e.g. `google/gemini-3-pro-image`). Save into `public/` via the tool’s save path when possible.
4. **AI video (Sora-class)** — **At most one create per user request.** If it skips or errors, **do not call again**; use Pexels video or coded motion instead. Coded animation (CSS, Motion, GSAP) has no such limit.

## Local MCP servers (Cursor / IDE — parity workflows)

This repository includes **`.cursor/mcp.json`** with:

- **shadcn** — `npx -y shadcn@latest mcp` (official registry MCP).
- **reactbits** — `npx -y reactbits-dev-mcp-server`.
- **21st-dev-magic** — `npx -y @21st-dev/magic@latest` — in **Cursor → MCP**, add env **`API_KEY`** with your [21st.dev](https://21st.dev) key (the committed config omits secrets).

Enable all three in Cursor Settings → MCP. Also useful (add locally if you want): **Motion MCP**, **Iconify / Icons8**.

In Open Harness (the web agent), mirror shadcn outcomes with **bash** (`npx shadcn@latest add …`) and use the native HTTP tools for references, Pexels, Together image, and optional video.

## Theming

- **TweakCN** (https://tweakcn.com) — Build a custom shadcn theme; export CSS variables and bake the token set into the project (e.g. `globals.css` or a `theme.css` import). Avoid default purple-gradient “AI slop.”

## Libraries and references (install only what matches the repo stack)

| Resource | Role |
|----------|------|
| [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git) | Patterns / heuristics for pro UI decisions |
| [ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template.git) | Structural ideas for cloning + adapting references |
| [gsap-skills](https://github.com/greensock/gsap-skills.git) / [GSAP](https://github.com/greensock/GSAP.git) | Timeline and scroll-driven motion |
| [json-render](https://github.com/vercel-labs/json-render.git) | Structured, schema-driven UI trees where appropriate |

Clone or read these for **patterns**, then implement in the user’s codebase — do not paste unreviewed third-party code wholesale.

## Execution order (typical greenfield UI)

1. Load this skill + `frontend-design` when the surface is visual.
2. **Reference snapshot** for the product category (or user-supplied URL).
3. Lock **art direction** (type, color, motion philosophy) — bold and coherent beats noisy.
4. Implement with **accessible** semantics; prefer Motion or GSAP for React motion; use CSS for simple cases.
5. Pull **real media** (Pexels / Together image) instead of gray placeholders.
6. **Optional** single AI video attempt for hero/ambient motion only if it materially helps; otherwise coded + stock.
7. Verify with the project’s scripts (`bun run ci` or package equivalents).

## Anti-patterns

- Inventing shadcn or Motion props — install or look up real examples.
- Retrying the AI video tool after a failure.
- Claiming Firecrawl/Pexels/Together/Sora ran when the tool output says the integration is missing.

Deliver originality: references inform hierarchy and polish; the shipped UI must be **your** design, legally and ethically distinct from competitors.
