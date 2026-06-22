# flutter-ui-skill

This repo is **a Claude Code plugin marketplace**, not a Flutter project. It
hosts the `figma-to-flutter` plugin, which ships:

- A model-invoked **skill** (`figma-to-flutter`): a closed render-and-compare
  loop that replicates a Figma frame in Flutter and verifies it against the
  original until a fidelity gate passes.
- A user-invoked **command** (`/figma-to-flutter:setup`): one-time
  per-Flutter-repo setup that copies the harness templates and wires fonts,
  assets, Python deps, and Figma access.

When working in this repo you are editing the plugin itself. There is no
`pubspec.yaml`, no `lib/`, no `flutter test` to run here — the templates
under `skills/figma-to-flutter/assets/templates/` are copied into *target*
Flutter repos and only compile there.

## Layout

```
.claude-plugin/
  plugin.json                # plugin manifest (name, version, description)
  marketplace.json           # self-hosted marketplace catalog
skills/
  figma-to-flutter/
    SKILL.md                 # skill entry — frontmatter + per-frame workflow
    references/              # deep-dive docs SKILL.md points at
      design.md                rationale: why two evaluators, why per-component
      setup.md                 Figma MCP/REST, DPR matching, fonts, determinism
      file-layout.md           repo + task directory layout the skill expects
      critique-prompt.md       Step 5 critique template (verbatim, placeholders)
    scripts/                 # helpers the skill invokes
      figma_pull.ts            Step 0 ingest (REST stub; MCP is preferred)
      diff.py                  Step 4 SSIM + pixel-mismatch gate
      loop.ts                  optional CI orchestrator
    assets/templates/        # files copied into the *target* Flutter repo
      render_to_png.dart       RepaintBoundary capture test
      fonts.dart               FontLoader for the Figma fonts
      target.md                per-task target/gate config
      checkpoint.md            per-task handoff contract
commands/
  setup.md                   # /figma-to-flutter:setup — one-time setup
README.md                    # user-facing install + end-to-end usage
CLAUDE.md                    # this file — notes for agents working on the plugin
```

After install, Claude Code resolves the plugin root via
`${CLAUDE_PLUGIN_ROOT}`. The `/figma-to-flutter:setup` command uses that to find
`skills/figma-to-flutter/assets/templates/` when copying into target repos.

## The loop, in one paragraph

Two evaluators with different jobs. SSIM + pixel-mismatch is the **gate**
(decides "are we done", default `ssim >= 0.95`). The multimodal critic is the
**steerer** (decides "what to fix next", token-level, ranked, capped at a few
items). Per frame: ingest → tokens → widget → render → diff → critique →
decide. Stop on gate met, iteration cap (default 8), or plateau (no meaningful
SSIM gain across two consecutive attempts). Never target SSIM = 1.0; font
hinting and subpixel rendering make exact match impossible.

State lives in `.claude/tasks/<task-id>/`, with `checkpoint.md` as the single
file a fresh session reads to resume.

## When editing this repo

- **Plugin and marketplace manifests.** `.claude-plugin/plugin.json` defines
  the install identity (`name`, `version`, `description`). Bumping `version`
  is what triggers user updates. `.claude-plugin/marketplace.json` is the
  self-hosted catalog — its top-level `name` (`flutter-ui-skill`) is what
  users reference in `/plugin install figma-to-flutter@flutter-ui-skill`.
  Renaming either breaks every existing install; treat them as load-bearing.
- **`skills/figma-to-flutter/SKILL.md` is the contract.** Its YAML
  frontmatter (`name`, `description`, `metadata.version`) is how the harness
  discovers and triggers the skill — do not break the schema. The
  `description` is also what other agents read to decide whether to invoke
  it, so keep the trigger phrasing broad. Paths inside SKILL.md (e.g.
  `references/setup.md`, `scripts/diff.py`) are sibling-relative — they
  resolve relative to SKILL.md, so the whole skill folder is a movable unit.
- **References are linked by name from `SKILL.md`.** If you rename or move a
  file under `references/`, update every `references/<file>.md` mention in
  `SKILL.md` to match.
- **`assets/templates/*.dart` are templates, not source.** Paths, imports, and
  constants in them are placeholders meant to be edited inside the *target*
  Flutter repo (e.g. `kFrameLogicalSize`, `kOutPath`, the `TODO: ...` widget
  import). Do not "fix" them to compile here — they do not run here.
- **`scripts/figma_pull.ts` is a fallback stub.** The skill prefers the
  official Figma MCP server (`https://mcp.figma.com/mcp`, installed via
  `claude plugin install figma@claude-plugins-official`); the REST script
  exists for when MCP is unavailable. Most of the distillation work (node-tree
  → spec, variables → tokens, asset export) is intentionally left as `TODO`
  for the agent to do per-frame against the real node.
- **`scripts/loop.ts` is optional.** Claude Code normally drives the loop
  directly by following `SKILL.md`. The script exists for CI / batch runs and
  does not invoke the model itself — the Step 5 critique is the agent's job.
- **Diff dependencies** for `scripts/diff.py`: `pillow`, `numpy`,
  `scikit-image`. Anything that loosens determinism (animations,
  `DateTime.now()`, network images, cross-OS captures) invalidates the gate —
  the determinism checklist in `references/setup.md` is load-bearing.

## When in doubt

- The "why" is in `references/design.md`. Read it before refactoring the loop
  shape or proposing a different evaluator split.
- The "how" for any single step is in `SKILL.md` (workflow) and the matching
  `references/*.md` (detail).
- Keep changes small and on-topic. This skill is intentionally compact — the
  value is in the loop discipline, not in feature surface.
