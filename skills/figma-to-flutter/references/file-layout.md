# File layout

Two layers: persistent tooling in the repo, and one working directory per frame
under a task id.

```
lib/
  theme/
    tokens.dart            # generated tokens: colors, type, spacing, radii
    app_theme.dart
  ui/
    components/            # verified components, composed upward
    screens/
test/
  golden/
    <frame>_capture_test.dart  # RepaintBoundary capture at matched size + DPR
  harness/
    render_to_png.dart     # shared capture helper
    fonts.dart             # FontLoader for the exact Figma fonts
    determinism.dart       # no animations, fixed clock, mocked net images
tool/
  figma_pull.ts            # MCP/REST -> spec.json, variables.json, reference.png, assets
  diff.py                  # pixelmatch + SSIM -> scores.json + diff.png
  critique.ts             # calls the multimodal critic -> critique.{md,json}
  loop.ts                  # orchestrator (or let Claude Code drive directly)
assets/
  fonts/
  figma/                   # exported icons and images
.claude/
  tasks/
    <task-id>/             # one per frame or screen
      spec.json            # distilled node tree and layout
      variables.json       # token/variable defs from Figma
      reference.png        # ground truth, fixed dims and scale
      assets/              # frame-specific exports
      target.md            # which widget file this task builds, gate config
      attempts/
        001/
          render.png
          diff.png
          scores.json
          critique.md
        002/ ...
      checkpoint.md        # mandatory handoff
      loop.log             # append-only iteration log
```

## scores.json (per attempt)

```json
{ "attempt": 1, "ssim": 0.871, "pixel_mismatch_pct": 6.2,
  "ref_dims": [786, 1704], "render_dims": [786, 1704],
  "gate": { "ssim_min": 0.95, "passed": false } }
```

## checkpoint.md

The handoff contract: the one file a fresh session reads to resume. It holds the
task and node id, target widget path, gate config, best attempt and its score,
the current ranked discrepancy list, the next action, and a stop reason if
stopped. Everything else can be reconstructed from it plus the attempt history.
