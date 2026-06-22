---
name: figma-to-flutter
description: >-
  Replicate a Figma frame or component in Flutter and verify the result against
  the original design using a closed feedback loop. Use this whenever the user
  wants to turn a Figma design, frame, node, or component into Flutter UI, asks
  to "match", "replicate", "implement", or "pixel-check" a design, mentions a
  Figma file or node id alongside Flutter, or wants an agent to self-check its UI
  output against a reference image. Use it even when the user does not say the
  word "loop": any design-to-Flutter task benefits from the render-and-compare
  harness this skill sets up.
metadata:
  version: "1.0.0"
---

# Figma to Flutter replication loop

Replicate a Figma design in Flutter, then close the gap by rendering the Flutter
output and comparing it against the Figma reference until it passes a fidelity
gate. Generation is the easy half. The value of this skill is the deterministic
render-and-compare harness that lets you check your own work without a human or
a device in the loop.

## The shape of the loop

Two evaluators, with different jobs:

1. A quantitative gate (SSIM plus pixel mismatch). Cheap, objective, deterministic.
   It decides "are we done."
2. A multimodal critic (you, looking at reference and render side by side). It
   decides "what to fix next."

The number gates. The critique steers. Do not try to make one do both: a bare
pixel score tells you a magnitude but not a cause, and unstructured visual
judgment drifts without a hard stop.

## When to run this

Trigger on any request to turn a Figma node into Flutter UI, or to check existing
Flutter UI against a design. If you do not have a Figma node id or file key yet,
ask for the frame URL (it contains both) before starting.

## One-time setup (per repo)

Do this once, then reuse it for every frame. Check whether each piece already
exists before creating it.

1. Figma access. Prefer the official Figma MCP server (remote endpoint
   `https://mcp.figma.com/mcp`), which exposes read tools for code, images, and
   variable definitions. In Claude Code it installs as a plugin
   (`claude plugin install figma@claude-plugins-official`). If MCP is unavailable,
   fall back to the Figma REST API with a personal access token. See
   `references/setup.md`.
2. Render harness. A golden-style widget test that renders the target widget to a
   PNG via a `RepaintBoundary`, at a logical size and `devicePixelRatio` chosen so
   the output pixel dimensions match the Figma export. Template:
   `assets/templates/render_to_png.dart`.
3. Fonts. Load the exact Figma fonts into the test engine with `FontLoader`.
   Unmatched fonts are the single largest source of false differences. See
   `assets/templates/fonts.dart`.
4. Assets. Export icons and images from Figma into the repo and reference them, so
   missing art does not dominate the diff.
5. Diff tooling. `scripts/diff.py` computes SSIM and pixel mismatch and writes a
   highlighted diff image. It needs `pillow`, `numpy`, and `scikit-image`.
6. Determinism. Disable animations, fix any clock or random values, and mock
   network images. Non-determinism makes the gate meaningless.

## Per-frame workflow

Work one frame or component at a time. Create a task directory and drive the loop.

### Step 0: Ingest (once per frame)

Run `scripts/figma_pull.ts` (or the MCP tools directly) to produce, under
`.claude/tasks/<task-id>/`:

- `spec.json` distilled node tree (layout, auto-layout, constraints)
- `variables.json` token and variable definitions
- `reference.png` ground-truth export at a fixed scale and known pixel dimensions
- `assets/` frame-specific icon and image exports
- `target.md` which widget file this task builds, and the gate config

Use `assets/templates/target.md` as the starting point.

### Step 1: Tokens before widgets

Generate or update `lib/theme/tokens.dart` (colors, type scale, spacing, radii)
from `variables.json`. Map named Figma variables to named Dart tokens. Widgets
that reference tokens are easier to correct than widgets full of literals.

### Step 2: Generate or edit the widget

Build the widget tree from `spec.json`. Translate auto-layout into Flex semantics
(`Row`/`Column` with main and cross axis alignment, gaps via spacing or
`SizedBox`) rather than absolute positioning, so the result stays responsive and
maintainable. You still render at the exact frame size for verification.

### Step 3: Render

Run the harness to capture the widget as a PNG at the matched dimensions. Write it
to `attempts/<NNN>/render.png`.

```bash
flutter test test/golden/<frame>_capture_test.dart --update-goldens
```

### Step 4: Quantitative diff

```bash
python scripts/diff.py \
  --reference .claude/tasks/<id>/reference.png \
  --render .claude/tasks/<id>/attempts/<NNN>/render.png \
  --out .claude/tasks/<id>/attempts/<NNN>/
```

This writes `diff.png` and `scores.json` (SSIM, pixel mismatch percentage, both
image dimensions). If the dimensions do not match, stop and fix the harness size
or DPR before reading the score: a dimension mismatch makes every number
meaningless.

### Step 5: Multimodal critique

View `reference.png`, `render.png`, and `diff.png` together. Follow the template
in `references/critique-prompt.md` exactly. Emit a short, ranked, localized list
of discrepancies (layout and spacing first, then sizing, color, typography, fine
detail), capped at the few highest-weight items, each with a concrete
token-level fix. Write it to `attempts/<NNN>/critique.md`.

### Step 6: Decide and iterate

- If SSIM is at or above the gate (default 0.95) and the critic returns `pass`,
  stop. Write the stop reason to `checkpoint.md`.
- Otherwise apply only the top few corrections from the critique, then return to
  Step 2.

### Stop conditions

Stop on any of:

- Gate met (SSIM at or above target and critic verdict `pass`).
- Iteration cap reached (default 8).
- Plateau: SSIM has not improved by a meaningful margin across two consecutive
  attempts, and the critic reports only below-threshold cosmetic items.

Do not pixel-chase. Font hinting and subpixel rendering mean a Flutter render
will never exactly match a Figma raster. Target SSIM around 0.95, never 1.0.
Chasing the last fraction of a percent sends the loop into oscillation, which is
exactly what the plateau and `max_items` cap exist to prevent.

## State and handoff

`.claude/tasks/<task-id>/checkpoint.md` is the single file a fresh session reads
to resume. Keep it current: task and node id, target widget path, gate config,
best attempt and its score, the current ranked discrepancy list, the next action,
and a stop reason if stopped. Everything else is reconstructable from it plus the
attempt history. Template: `assets/templates/checkpoint.md`.

## Reference files

- `references/design.md` full architecture and rationale behind this loop.
- `references/setup.md` Figma MCP and REST setup, harness details, font and DPR
  matching, determinism checklist.
- `references/critique-prompt.md` the exact critique template for Step 5.
- `references/file-layout.md` the repo and task directory structure.

## One upstream lever

If the Figma file uses Code Connect to map design components to real Flutter
widgets, the design context points you at the right component directly, which
cuts the number of correction loops before the gate is even in play. Check for it
during setup.
