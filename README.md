# figma-to-flutter

A Claude Code skill that replicates Figma designs in Flutter and verifies the
result against the original with a deterministic render-and-compare loop. Two
evaluators do the work: an SSIM + pixel-mismatch **gate** that decides "are we
done", and a multimodal **critic** that decides "what to fix next". The agent
keeps iterating until the gate passes, a plateau is detected, or an iteration
cap is reached.

This README covers installing the skill and using it end to end on a Figma
file with **multiple screens**.

## What you need

- **Flutter SDK** with `flutter test` working (the render harness runs as a
  headless widget test — no emulator or device needed).
- **Python 3.10+** with `pillow`, `numpy`, `scikit-image` for the diff script.
- **Node 18+** with `tsx` (or `ts-node`) if you use the REST fallback or the
  CI orchestrator. Optional if you stay on MCP.
- **Figma access**, one of:
  - Official Figma MCP server (preferred) — endpoint
    `https://mcp.figma.com/mcp`, installed in Claude Code as a plugin.
  - Figma REST API + a personal access token, via the
    `FIGMA_TOKEN` env var.
- **The Figma file URL** for the screens you want to implement. Each frame URL
  has the form `https://www.figma.com/design/<file_key>/...?node-id=<node_id>`
  — both pieces are needed per frame.

## Install the plugin

This repo is packaged as a Claude Code plugin marketplace named
`flutter-ui-skill` that ships one plugin (`figma-to-flutter`). One install
gets you both the model-invoked skill and the `/figma-to-flutter:setup`
slash command.

In a Claude Code session, run:

```
/plugin marketplace add rafa-js/claude-figma-to-flutter
/plugin install figma-to-flutter@flutter-ui-skill
```

(For local development, swap the first command for an absolute path:
`/plugin marketplace add /path/to/claude-figma-to-flutter`.)

After install you should see, in `/plugin list`:

- The skill `figma-to-flutter` (auto-triggers on Figma-to-Flutter requests).
- The command `/figma-to-flutter:setup` (run once per target repo).

To update later, `/plugin marketplace update flutter-ui-skill` then
`/plugin update figma-to-flutter@flutter-ui-skill`.

### Local development install

If you are iterating on the plugin source, point Claude Code at it directly
instead of going through the marketplace:

```bash
claude --plugin-dir /path/to/claude-figma-to-flutter
```

Use `/reload-plugins` after every edit.

### Install the Figma MCP plugin (recommended)

```bash
claude plugin install figma@claude-plugins-official
```

The plugin gives the agent first-class read tools for Figma code, images, and
variable definitions. If you can't use it, set `FIGMA_TOKEN` in your shell
and the skill will fall back to `scripts/figma_pull.ts` against the REST API.

### Install the Python diff dependencies

```bash
pip install pillow numpy scikit-image
```

You can do this in a venv inside the target Flutter repo if you prefer — the
skill just shells out to `python scripts/diff.py`.

## One-time setup in the target Flutter repo

From the root of your Flutter project, run the setup command that ships
with the plugin:

```
/figma-to-flutter:setup
```

The command walks the agent through every step interactively — copying
harness templates into `test/harness/`, creating the `lib/theme/`,
`test/golden/`, and `.claude/tasks/` directories, proposing the
`pubspec.yaml` and `.gitignore` edits (with diffs, before applying),
checking Python diff deps, confirming Figma access (MCP plugin or
`FIGMA_TOKEN`), and verifying the project is ready. It skips anything that
is already in place, so it is safe to re-run whenever you change the design
fonts or move repos.

### What the command will ask you for

Things the agent cannot infer; have these ready:

- The **Figma file URL** for the design (optional at setup time, required
  before the first frame run).
- **Font families and weights** used in the design (e.g. "Inter Regular,
  Medium, SemiBold, Bold"). Defaults to Inter at those four weights if
  unspecified.
- **Export scale (DPR)** your Figma exports use — usually `1` or `2`.
  Defaults to `2`.
- **Figma access method** — the MCP plugin (recommended) or a personal
  access token in `FIGMA_TOKEN`.

### What you still do yourself

Two things the command intentionally does not automate:

- **Drop the `.ttf` font files** into `assets/fonts/`. Font licensing means
  the agent cannot fetch them for you; the command lists the exact filenames
  it expects.
- **Confirm Code Connect.** If the Figma file uses Code Connect to map
  components to Flutter widgets, the MCP output points the agent straight at
  them, cutting iterations dramatically — worth checking with the design team
  before the first run.

Gate defaults (`ssim_min = 0.95`, `iteration_cap = 8`,
`diff_threshold = 0.10`) are set in each task's `target.md`. Override per
task if a screen has unusually heavy gradients or photography.

## End-to-end workflow for a multi-screen Figma file

The skill works **one frame at a time**. For a multi-screen design, you wrap
it in a per-screen task list and let the agent burn through them. Bottom-up
composition (shared components first, screens last) gives tighter loops and
cleaner diffs than going screen-by-screen from the start.

### Step A — Inventory the design

Open the Figma file with the agent and ask it to enumerate the frames you
want to ship. Capture, for each:

- A short kebab-case `task-id` (e.g. `onboarding-welcome`, `feed-home`).
- The `file_key` and `node_id` from the frame URL.
- Logical size and export scale (typically 1x or 2x).
- Which shared components the frame depends on.

The agent writes this as a top-level plan in `.claude/tasks/_plan.md` (or
just keeps it in conversation if there are only a few screens). Group the
tasks into two waves:

- **Wave 1 — shared components.** Buttons, cards, list rows, app bars,
  anything that appears on more than one screen.
- **Wave 2 — screens.** Each screen composes verified components from Wave 1
  plus its own one-off pieces.

### Step B — Generate the token layer once

Before any widget work, the agent runs **Step 1 of `SKILL.md`** once for the
whole file: pull `variables.json` from Figma, generate `lib/theme/tokens.dart`
(colors, type scale, spacing, radii) mapping named Figma variables to named
Dart tokens, and wire it into `lib/theme/app_theme.dart`. Every later widget
references these tokens instead of literals, so corrections route into one
file instead of fanning out.

### Step C — Run the loop on Wave 1 (components)

For each component task, the agent follows the per-frame workflow from
`SKILL.md`:

0. **Ingest** — `scripts/figma_pull.ts` (or MCP) writes
   `.claude/tasks/<task-id>/{spec.json, variables.json, reference.png, assets/, target.md}`.
1. (Already done in Step B for the shared token layer.)
2. **Generate the widget** from `spec.json`, translating auto-layout into
   `Row` / `Column` with axis alignment and spacing — not absolute
   positioning.
3. **Render** via the capture test:
   ```bash
   flutter test test/golden/<task-id>_capture_test.dart --update-goldens
   ```
   PNG lands at `.claude/tasks/<task-id>/attempts/001/render.png`.
4. **Diff**:
   ```bash
   python scripts/diff.py \
     --reference .claude/tasks/<task-id>/reference.png \
     --render    .claude/tasks/<task-id>/attempts/001/render.png \
     --out       .claude/tasks/<task-id>/attempts/001/
   ```
   If `dims_match` is false, **stop and fix the harness `physicalSize` /
   `devicePixelRatio` before reading the SSIM** — a dimension mismatch makes
   every score meaningless.
5. **Critique** — the agent opens `reference.png`, `render.png`, and
   `diff.png` together and emits a ranked, capped (3-5 items) discrepancy
   list per [references/critique-prompt.md](references/critique-prompt.md),
   written to `attempts/<NNN>/critique.md`.
6. **Decide** — gate passed → stop and update `checkpoint.md`. Otherwise
   apply the top corrections, increment the attempt, return to step 2.

   Stop conditions: gate met, iteration cap (default 8), or plateau (SSIM
   has not improved meaningfully across two consecutive attempts and the
   critic reports only below-threshold cosmetic items).

When a component task stops with `state: passed` in its
`checkpoint.md`, the component is reusable in Wave 2.

### Step D — Run the loop on Wave 2 (screens)

Identical workflow, but the generated widget tree composes verified
components from Wave 1 instead of building from scratch. The critique step
should rarely fire on the inner components — most discrepancies will be
layout-level (gap between sections, header padding, scroll-edge behavior).
If a critique pins a discrepancy inside a Wave 1 component, treat it as a
bug in that component task, fix and re-verify it, then re-render the screen.

### Step E — Sweep and check out

After every task is `passed` (or knowingly `stopped_plateau` with cosmetic
residual), do one final pass:

- Run the full `flutter test` suite to catch regressions across screens.
- Spot-check 2-3 screens visually side-by-side against Figma for things SSIM
  cannot see (typography rhythm across screens, semantic colour usage,
  accessibility contrast).
- Archive `.claude/tasks/` (or at least the `checkpoint.md` files) — they
  are the audit trail of what was tried and why the loop stopped.

## Driving it from a session

In practice you do not run any of these commands by hand. A typical session
looks like:

> *"Here's the Figma URL: <url>. Implement all the screens in this file in
> Flutter using the figma-to-flutter skill. Start with shared components,
> then screens."*

The agent:

1. Invokes the skill, reads `SKILL.md`, inventories the frames.
2. Generates `tokens.dart` once.
3. Walks the component wave, running the loop per task and updating each
   `checkpoint.md` as it goes.
4. Walks the screen wave the same way.
5. Reports per-task SSIM and stop reason at the end.

You stay in the loop for two decisions: approving the initial task list, and
adjudicating any task that stops on `stopped_plateau` with a critique you
disagree with.

## Optional: CI orchestration

`scripts/loop.ts` is a thin runner for batch / CI use — it does **not**
invoke the model; the critique step is still the agent's job. Use it when
you want to re-verify every task after a token change:

```bash
tsx scripts/loop.ts --task <task-id> --ssim-min 0.95 --max-iter 8
```

For an interactive session, just let Claude Code drive `SKILL.md` directly.

## Troubleshooting

- **`dims_match: false`** — the harness `physicalSize` or `devicePixelRatio`
  does not match the Figma export. Recompute: `logical_size * dpr ==
  exported_pixels`. Fix and re-render; do not read the SSIM until it matches.
- **SSIM stuck around 0.6-0.8 with red text everywhere in `diff.png`** —
  font mismatch. Check that the exact Figma `.ttf`s are in `assets/fonts/`,
  registered with `FontLoader`, and listed in `pubspec.yaml`.
- **SSIM oscillates between two attempts** — the critic is pixel-chasing.
  Tighten `max_items` in the critique prompt (3 instead of 5), and trust the
  plateau detection. Target SSIM ~0.95, never 1.0.
- **Critique keeps flagging a network image** — you forgot to mock or stub
  network images for the test. See the determinism checklist in
  [references/setup.md](references/setup.md).
- **REST ingest is slow or rate-limited** — install the official Figma MCP
  plugin; the REST script is a fallback only.

## Further reading

- [SKILL.md](SKILL.md) — the per-frame workflow the agent follows.
- [references/design.md](references/design.md) — why the loop is shaped this
  way (two evaluators, bottom-up composition, plateau detection).
- [references/setup.md](references/setup.md) — Figma access, DPR matching,
  fonts, determinism.
- [references/file-layout.md](references/file-layout.md) — repo and task
  directory layout.
- [references/critique-prompt.md](references/critique-prompt.md) — the exact
  critique template for Step 5.
- [CLAUDE.md](CLAUDE.md) — notes for agents working on the skill itself.
