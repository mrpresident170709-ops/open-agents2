---
name: website-clone-and-adapt
description: Use when the user wants a site or page inspired by a competitor or reference URL — capture structure and patterns, then ship an original UI (not a trademark clone). Combines reference snapshots with ethical adaptation. Triggers on clone, reference site, like X but, copy layout, competitor UI, rebuild this site.
---

## Rules

1. **Reference first** — Run the competitor/reference snapshot tool (`ui_competitor_reference`) with a **category** or **direct URL** before locking layout, type, or color. If the tool is misconfigured, state that once and proceed from the brief only.
2. **Do not clone illegally** — No pixel-perfect copies of branded sites, logos, proprietary imagery, or distinctive trade dress. Use references for **information architecture, density, hierarchy, and interaction patterns** only.
3. **Original execution** — New typography pairing, color system (sync [apps/web/styles/theme-tweakcn.css](apps/web/styles/theme-tweakcn.css) with TweakCN when theming), motion, and copy. The result must be clearly **your** product.
4. **Patterns from templates** — Read [ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template) for structural ideas (sections, responsive behavior); implement in the project’s stack (e.g. Next.js, shadcn), not by pasting vendor source wholesale.

## Workflow

1. Invoke `ui-excellence-stack` (and `frontend-design` if needed).
2. Capture reference (snapshot + markdown excerpt).
3. Draft art direction; update TweakCN tokens file if building a new theme pass.
4. Build with shadcn/Motion/GSAP as appropriate; use MCP in Cursor when available.
5. Run project verification (`bun run ci` or AGENTS.md equivalents).

## When not to use

- User explicitly forbids external URLs or competitor research.
- Pure bugfix or non-visual task.
