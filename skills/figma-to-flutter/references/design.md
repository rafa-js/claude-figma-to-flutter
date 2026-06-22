# Design rationale: Figma to Flutter replication loop

This is the architecture behind the skill, captured from the design discussion.
Read it when you need to understand why the loop is shaped the way it is, or when
adapting it to a non-standard project.

## Core idea

The generation step (Figma node to Flutter widget) is the easy half. The loop
only works if you build a deterministic render-and-compare harness that the agent
can run on every iteration without a human or a running device in the way.

Use two evaluators, not one:

1. A quantitative gate (cheap, objective, deterministic) that decides "are we
   done."
2. A multimodal critic (the model looking at both images) that decides "what to
   fix next."

Pixel math alone is noisy and gives a number without a cause. The model reading
the reference next to the render can say "card padding too tight, heading is
semibold not bold, primary color is a shade off," which is what actually drives
the next edit. The number gates; the critique steers.

## One-time setup

### Figma extraction

Use the official Figma MCP server (remote endpoint `https://mcp.figma.com/mcp`).
It exposes three read tools that matter here: one for code, one for images, and
one for variable definitions. In Claude Code it installs as a plugin via
`claude plugin install figma@claude-plugins-official`. It is in beta and free
during the beta period. From this, pull three artifacts per frame: the structured
node tree (layout, constraints, auto-layout), the variable or token definitions,
and a ground-truth reference PNG exported at a known scale.

If MCP is unavailable, the Figma REST API gives the same data: the file or nodes
endpoint for the tree, and the images endpoint for the reference export. It needs
a personal access token plus the file key and node id, both present in the frame
URL.

### Render harness

This is the linchpin. Build a Flutter golden-style widget test that renders the
target widget to a PNG via a `RepaintBoundary`, at a logical size and
`devicePixelRatio` chosen so the output pixel dimensions match the Figma export.
It runs headless under `flutter test`, no emulator, which is what makes the loop
fast enough to iterate dozens of times.

### Fonts and assets

Load the exact Figma fonts into the test engine with `FontLoader`, and export
icons and images from Figma as real assets. Skipping this is the number one cause
of false diffs: unmatched fonts and missing images dominate the pixel delta and
the critic chases ghosts.

### Diff tooling

Pixel diff (mismatch percentage plus a highlighted diff image) and a structural
similarity (SSIM) score that ignores anti-aliasing noise. The diff image feeds
the critic; the SSIM number feeds the gate.

### Determinism

Disable animations, fix any dates or random values, and mock network images. Any
dynamic input causes random failures and invalidates the comparison.

## The loop

0. Ingest (once per frame): node spec, tokens, reference.png, exported assets.
1. Generate or update the theme and design tokens first. Tokens before widgets.
2. Generate or edit the widget tree, translating auto-layout into Flex semantics
   rather than absolute positioning, while still rendering at the exact frame
   size for verification.
3. Render to PNG via the harness at matched dimensions.
4. Quantitative diff: compute SSIM and pixel mismatch, write the diff image.
5. Multimodal critique: view reference, render, and diff together, emit a
   structured, localized, ranked discrepancy list.
6. Decide: if SSIM is above the gate and the critic passes, stop. Otherwise apply
   the top corrections and return to Step 2.
7. Stop conditions: gate met, iteration cap reached, or a no-improvement plateau.

## Things that make or break it

- Match coordinate systems. The render and the reference must share pixel
  dimensions, or you normalize before diffing. A mismatch here makes every score
  meaningless.
- Do not pixel-chase. Set a tolerance that absorbs anti-aliasing and platform
  rendering differences. Target SSIM around 0.95 and up, never 100 percent. A
  Flutter render will never match a Figma raster exactly.
- Work per component, compose up. Smaller surfaces mean tighter loops, cleaner
  diffs, and a critique that can localize a fault. Assemble verified components
  into screens last.
- Detect plateaus. Without it the agent flips a value back and forth chasing a
  fraction of a percent forever. Stop when two consecutive iterations do not
  improve SSIM meaningfully.
- Persist per-attempt artifacts. Writing render, diff, critique, and a scores log
  into a task directory gives a clean handoff and an audit trail of what was
  tried and why it stopped, and lets you resume without re-deriving state.

## One upstream lever

If the Figma file uses Code Connect to map design components to real Flutter
widgets, the MCP output points the agent at the right components directly, which
cuts the number of correction loops before the gate is even in play.
