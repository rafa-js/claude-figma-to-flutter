<div align="center">

# claude-figma-to-flutter

**Turn Figma screens into Flutter UI with a Claude Code skill that pixel-checks itself against the original, frame by frame, until fidelity holds.**

[Overview](#overview) • [Features](#features) • [Install](#install) • [Quickstart](#quickstart) • [How it works](#how-it-works) • [Troubleshooting](#troubleshooting)

</div>

---

## Overview

A Claude Code plugin that ships two things:

- **`figma-to-flutter`** — a model-invoked skill that runs a closed render-and-compare loop on each Figma frame: generate widget, render to PNG, diff against the Figma export, critique the gap, fix the top items, repeat — until an SSIM gate passes or a plateau detector stops the loop.
- **`/figma-to-flutter:setup`** — a slash command that does the one-time setup in your Flutter repo: copies harness templates, wires fonts and assets, checks Python and Figma access, and reports anything still blocking before the first run.

> [!NOTE]
> **Why a loop?** Generation is the easy half. The value is in the harness: a quantitative gate (SSIM + pixel mismatch) decides *"are we done"*, and a multimodal critic decides *"what to fix next"*. The number gates; the critique steers. One won't do the job of the other.

## Features

- **Render-and-compare loop** — golden-style widget tests capture each frame to PNG; diff and critique run outside Flutter.
- **Two evaluators, one job each** — SSIM + pixel mismatch is the gate; the agent reading reference and render side-by-side is the steerer.
- **Bottom-up composition** — shared components first, screens last. Tighter loops, cleaner diffs, fewer iterations on layout noise.
- **Auto-stop built in** — iteration cap (default `8`), plateau detection across consecutive attempts, and an explicit "don't pixel-chase" SSIM target around `0.95`.
- **One install, both artifacts** — `/plugin install` exposes the skill and the setup command together.
- **Figma MCP first, REST fallback** — works whether you have the official Figma plugin or just a personal access token.
- **Per-task checkpoints** — every frame has its own `checkpoint.md`, attempt history, scores, and critique log. Sessions resume cold.

## Prerequisites

- **[Claude Code](https://docs.claude.com/en/docs/claude-code)** — the CLI that runs the skill.
- **[Flutter SDK](https://docs.flutter.dev/get-started/install)** — `flutter test` must work; the harness is a headless widget test, no emulator needed.
- **Python 3.10+** with `pillow`, `numpy`, `scikit-image` for the diff script.
- **Figma access**, one of:
  - the official Figma MCP server (`https://mcp.figma.com/mcp`, recommended), or
  - a Figma personal access token exported as `FIGMA_TOKEN`.

## Install

In a Claude Code session:

```
/plugin marketplace add rafa-js/claude-figma-to-flutter
/plugin install figma-to-flutter@flutter-ui-skill
```

You will then have:

- the skill `figma-to-flutter` — auto-triggers on any Figma-to-Flutter request, and
- the command `/figma-to-flutter:setup` — run once per Flutter repo.

> [!TIP]
> To update later: `/plugin marketplace update flutter-ui-skill` then `/plugin update figma-to-flutter@flutter-ui-skill`.

<details>
<summary><b>Local development install</b></summary>

If you are iterating on the plugin source, point Claude Code at it directly instead of going through the marketplace:

```bash
claude --plugin-dir /path/to/claude-figma-to-flutter
```

Use `/reload-plugins` after every edit.

</details>

### Optional: Figma MCP plugin

```bash
claude plugin install figma@claude-plugins-official
```

The MCP plugin gives the agent first-class read tools for Figma code, images, and variable definitions. Without it, the skill falls back to the REST API via `FIGMA_TOKEN`.

> [!IMPORTANT]
> If the Figma file uses Code Connect to map components to real Flutter widgets, the MCP output points the agent straight at them — that single lever cuts the most iterations out of the loop. Worth confirming with the design team before the first run.

### Diff dependencies

```bash
pip install pillow numpy scikit-image
```

The setup command (next section) checks for these and will offer to install them.

## Quickstart

### 1. Set up your Flutter repo (once)

From the root of your Flutter project, in a Claude Code session:

```
/figma-to-flutter:setup
```

The command walks the agent through every prep step interactively — copying harness templates into `test/harness/`, creating the directory skeleton, proposing `pubspec.yaml` and `.gitignore` edits (with diffs, before applying), checking Python deps, confirming Figma access, and verifying the project is ready. It skips work already done, so it is safe to re-run.

It will ask you for:

- the Figma file URL (optional at setup time, required before the first frame run),
- font families and weights used in the design (defaults to Inter at Regular/Medium/SemiBold/Bold),
- export scale / DPR — usually `1` or `2` (defaults to `2`), and
- Figma access method (MCP plugin or REST token).

The one thing it cannot do for you: **drop the `.ttf` font files into `assets/fonts/`**. Font licensing means the agent cannot fetch them; the command lists the exact filenames it expects so you can drag them in afterwards.

### 2. Implement a multi-screen design

Hand the agent the Figma URL and let the skill drive:

> *"Here's the Figma URL: `<url>`. Implement all the screens using figma-to-flutter, starting with shared components."*

The agent will:

1. **Inventory** the frames in the file, assign kebab-case task IDs (`onboarding-welcome`, `feed-home`, ...), and group them into two waves: shared components and screens.
2. **Generate the token layer once** — pull `variables.json` from Figma, write `lib/theme/tokens.dart` (colors, type scale, spacing, radii), and wire `app_theme.dart`. Every widget references tokens, not literals.
3. **Loop through Wave 1 — shared components.** Per frame: ingest → widget → render → diff → critique → fix → re-render, until SSIM clears the gate or a stop condition fires.
4. **Loop through Wave 2 — screens.** Compose verified Wave 1 components plus screen-specific pieces; same loop. Discrepancies inside a Wave 1 component become bugs on that component task — fix once, reuse everywhere.
5. **Sweep.** Final `flutter test` pass to catch cross-screen regressions, spot-check 2–3 screens visually against Figma, archive the `checkpoint.md` files as the audit trail.

> [!NOTE]
> **Bottom-up composition is deliberate.** Smaller surfaces give tighter loops, cleaner diffs, and a critique that can localise faults. Going screen-first burns iterations on layout noise that components would have caught.

You stay in the loop for two decisions: approving the initial task list, and adjudicating any frame that stops on `stopped_plateau` with a critique you disagree with.

## How it works

Two evaluators with different jobs:

| Evaluator | Job | Tool |
|---|---|---|
| **Quantitative gate** | Decides *"are we done"* | SSIM + pixel mismatch ([`scripts/diff.py`](skills/figma-to-flutter/scripts/diff.py)) |
| **Multimodal critic** | Decides *"what to fix next"* | The agent, viewing `reference.png`, `render.png`, and `diff.png` together against [`references/critique-prompt.md`](skills/figma-to-flutter/references/critique-prompt.md) |

A bare pixel score tells you a magnitude but not a cause; unstructured visual judgement drifts without a hard stop. Splitting the jobs prevents both failure modes.

Every frame is one task on disk:

```
.claude/tasks/<task-id>/
├── spec.json                # distilled Figma node tree
├── variables.json           # design tokens
├── reference.png            # ground truth from Figma
├── target.md                # gate config + which widget this builds
├── checkpoint.md            # the single file a fresh session reads to resume
└── attempts/
    ├── 001/{render,diff}.png, scores.json, critique.md
    ├── 002/...
```

`checkpoint.md` is the handoff contract. Drop a fresh agent on it and the loop picks up where it left off — no state lives in memory.

> [!IMPORTANT]
> Target SSIM around `0.95`, never `1.0`. Font hinting and subpixel rendering mean a Flutter render will never exactly match a Figma raster. The plateau detector and the iteration cap exist to stop pixel-chasing — trust them.

<details>
<summary><b>Optional: drive the loop from CI</b></summary>

[`scripts/loop.ts`](skills/figma-to-flutter/scripts/loop.ts) is a thin runner for batch and CI use. It does **not** invoke the model — the critique step is still the agent's job — but it is useful when you want to re-verify every task after a token change:

```bash
tsx scripts/loop.ts --task <task-id> --ssim-min 0.95 --max-iter 8
```

For interactive sessions, just let Claude Code drive [`SKILL.md`](skills/figma-to-flutter/SKILL.md) directly.

</details>

## Troubleshooting

> [!WARNING]
> **`dims_match: false` in `scores.json`** — the harness `physicalSize` or `devicePixelRatio` does not match the Figma export. Recompute: `logical_size * dpr == exported_pixels`. Fix the harness and re-render *before* reading the SSIM — a dimension mismatch makes every score meaningless.

- **SSIM stuck around 0.6–0.8, red text everywhere in `diff.png`** — font mismatch. Check the exact Figma `.ttf` files are in `assets/fonts/`, registered with `FontLoader`, and listed in `pubspec.yaml`.
- **SSIM oscillates between two attempts** — the critic is pixel-chasing. Tighten `max_items` in the critique prompt (3 instead of 5) and trust the plateau detector. Target ~`0.95`, not `1.0`.
- **Critique keeps flagging a network image** — you forgot to mock network images in tests. See the determinism checklist in [references/setup.md](skills/figma-to-flutter/references/setup.md).
- **REST ingest is slow or rate-limited** — install the official Figma MCP plugin; the REST script is a fallback only.

## Further reading

- [SKILL.md](skills/figma-to-flutter/SKILL.md) — the per-frame workflow the agent follows.
- [references/design.md](skills/figma-to-flutter/references/design.md) — why the loop is shaped this way (two evaluators, bottom-up composition, plateau detection).
- [references/setup.md](skills/figma-to-flutter/references/setup.md) — Figma access, DPR matching, fonts, determinism.
- [references/file-layout.md](skills/figma-to-flutter/references/file-layout.md) — repo and task directory layout.
- [references/critique-prompt.md](skills/figma-to-flutter/references/critique-prompt.md) — the exact critique template.
- [CLAUDE.md](CLAUDE.md) — notes for agents working on the plugin itself.
- [Claude Code plugins](https://code.claude.com/docs/en/plugins) — official docs.
