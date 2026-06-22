---
description: One-time setup for the figma-to-flutter skill in this Flutter repo — copies harness templates, wires fonts and assets, checks Python and Figma access, and verifies the loop is ready to run.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
  - Glob
  - Grep
---

# /figma-to-flutter:setup — one-time setup for figma-to-flutter

You are running the one-time setup for the `figma-to-flutter` skill in the
current working directory. Your job is to walk the user through every step
that the loop needs before it can run on the first frame, doing as much as
you can yourself and asking only for things you cannot infer.

Be conservative: **never modify `pubspec.yaml`, `.gitignore`, or install
anything globally without confirmation**. Show the diff or command you intend
to run, then ask. Skip steps that are already done. Report a short summary at
the end with anything still blocking.

## Phase 0 — Locate the skill

You need the skill directory to copy templates from. This command ships
inside the `figma-to-flutter` plugin; the skill lives under the plugin root.
Try, in order:

1. `${CLAUDE_PLUGIN_ROOT}/skills/figma-to-flutter/` (set automatically when
   the plugin is installed via `/plugin install`).
2. `${CLAUDE_PROJECT_DIR}/.claude/plugins/*/figma-to-flutter/skills/figma-to-flutter/`
3. `$HOME/.claude/plugins/*/figma-to-flutter/skills/figma-to-flutter/`
4. Fallback for standalone (non-plugin) installs:
   `$HOME/.claude/skills/figma-to-flutter/` and
   `${CLAUDE_PROJECT_DIR}/.claude/skills/figma-to-flutter/`.

If none exist, ask the user for the absolute path to the skill repo. Store
the resolved path as `SKILL_DIR` for the rest of the run.

Confirm it is the right directory by checking that `SKILL_DIR/SKILL.md`
exists and its frontmatter has `name: figma-to-flutter`.

## Phase 1 — Verify this is a Flutter project

Run `ls pubspec.yaml` at the cwd. If it does not exist, stop and ask the user
whether they intended to run this from the root of a Flutter project. Do not
proceed without a `pubspec.yaml`.

Read `pubspec.yaml` and note:

- Whether the `flutter` section already lists `assets:` and `fonts:`.
- Whether `flutter_test` is in `dev_dependencies`. If not, plan to add it.

## Phase 2 — Gather design inputs

Ask the user (one `AskUserQuestion` call, multi-question, only the ones you
cannot infer):

1. **Figma file URL** — to extract `file_key` and at least one example
   `node_id`. Optional at setup time; needed before the first run.
2. **Font families and weights** used in the design (e.g. "Inter Regular,
   Medium, SemiBold, Bold"). If they don't know yet, default to Inter at
   Regular/Medium/SemiBold/Bold and tell them they can re-run setup later.
3. **Export scale (DPR)** used by their Figma export — typically `1` or `2`.
   Default to `2` if unsure.
4. **Figma access method** — Figma MCP plugin (recommended) or REST token.

Record the answers for later phases.

## Phase 3 — Create the directory skeleton

Create these directories if missing (use `mkdir -p`):

- `lib/theme/`
- `lib/ui/components/`
- `lib/ui/screens/`
- `test/harness/`
- `test/golden/`
- `assets/fonts/`
- `assets/figma/`
- `.claude/tasks/`

Report which ones you created vs. which were already there.

## Phase 4 — Copy the harness templates

Copy these files from the skill to the target repo. Do **not** overwrite
existing files without asking.

| From (SKILL_DIR)                           | To (cwd)                          |
| ------------------------------------------ | --------------------------------- |
| `assets/templates/render_to_png.dart`      | `test/harness/render_to_png.dart` |
| `assets/templates/fonts.dart`              | `test/harness/fonts.dart`         |
| `assets/templates/target.md`               | `.claude/tasks/_target_template.md` |
| `assets/templates/checkpoint.md`           | `.claude/tasks/_checkpoint_template.md` |

After copying, patch `test/harness/fonts.dart` so the `FontLoader` registers
the families and weights the user gave in Phase 2. Replace the `TODO` line
and the example `addFont` calls accordingly. Leave a `// TODO: drop the .ttf
files into assets/fonts/` comment so it is obvious if any are missing.

In `test/harness/render_to_png.dart`, leave `kFrameLogicalSize` and
`kOutPath` as placeholders — those are per-frame and the skill sets them when
it generates each capture test.

## Phase 5 — Wire `pubspec.yaml`

Show the user the exact YAML you want to add under the `flutter:` section,
then ask for confirmation before editing. The block should include:

```yaml
flutter:
  assets:
    - assets/figma/
    - assets/fonts/
  fonts:
    - family: <Family>
      fonts:
        - asset: assets/fonts/<Family>-Regular.ttf
        - asset: assets/fonts/<Family>-Medium.ttf
          weight: 500
        - asset: assets/fonts/<Family>-SemiBold.ttf
          weight: 600
        - asset: assets/fonts/<Family>-Bold.ttf
          weight: 700
```

Substitute the actual family/weight list from Phase 2. If a `fonts:` or
`assets:` block already exists, merge rather than duplicate.

Remind the user they still need to drop the `.ttf` files into
`assets/fonts/` themselves — you cannot fetch licensed font files for them.
List the exact filenames you expect.

If `flutter_test` is missing from `dev_dependencies`, propose adding it and
ask before editing.

## Phase 6 — `.gitignore`

Propose appending the following to `.gitignore` (show the diff, then ask):

```
# figma-to-flutter loop artefacts
.claude/tasks/*/attempts/
.claude/tasks/*/reference.png
.claude/tasks/*/spec.json
.claude/tasks/*/variables.json
```

Rationale: per-attempt renders, diffs, and the raw Figma exports are
regenerable and noisy in PRs. `checkpoint.md` and `target.md` stay tracked
because they are the handoff contract.

## Phase 7 — Python diff dependencies

Run `python3 -c "import PIL, numpy, skimage"` and check the exit code.

- If it succeeds, log "diff deps OK" and skip.
- If it fails, show the user the install command and ask whether to run it:

  ```bash
  python3 -m pip install pillow numpy scikit-image
  ```

  If the user wants a venv instead, ask for the path and run
  `python3 -m venv <path> && <path>/bin/pip install ...` instead.

Do not install globally without an explicit yes.

## Phase 8 — Figma access

Based on the Phase 2 choice:

**MCP path:**

1. Check if the Figma plugin is already installed: ask the user to run
   `claude plugin list` in their terminal and paste the result, or use
   whatever the current session exposes. (You cannot install plugins
   programmatically.)
2. If it is not installed, tell the user to run:
   ```bash
   claude plugin install figma@claude-plugins-official
   ```
   and confirm once they have.

**REST path:**

1. Check whether `FIGMA_TOKEN` is set in the environment
   (`echo "${FIGMA_TOKEN:+set}"`).
2. If unset, ask the user to create a personal access token at
   `https://www.figma.com/settings` and export it in their shell profile:
   ```bash
   export FIGMA_TOKEN=<token>
   ```
3. Do **not** offer to write the token to a file in the repo. Make sure it
   is in their shell rc, not committed anywhere.

Do not echo or log the token value at any point.

## Phase 9 — Determinism baseline

Open (or create) `test/harness/determinism.dart` and ensure it has helpers
to disable animations and stub network images. If the user already has a
test setup file, ask before adding a new one. Leave a short comment in the
file pointing at `references/setup.md` in the skill for the full checklist.

If the project uses `cached_network_image` or similar, point that out and
suggest where to stub it for tests.

## Phase 10 — Verify

Run a sanity check, in order:

1. `flutter pub get` — confirm `pubspec.yaml` is still valid.
2. `python3 scripts/diff.py --help` against the skill path — confirm the
   diff script runs and its deps resolve. (Use `SKILL_DIR/scripts/diff.py`.)
3. List the contents of `test/harness/` and `.claude/tasks/` so the user
   can see what is now in place.

Do **not** run `flutter test` here — there is no capture test wired to a
real widget yet. That happens per-frame when the skill is invoked.

## Phase 11 — Report

Print a short summary:

- What was created, copied, or edited (file list).
- What was already in place and skipped.
- What is still **blocking the first run** (e.g. font `.ttf`s not dropped
  in, Figma access not confirmed, Python deps refused).
- The exact next step:
  > "Setup complete. To implement the first frame, give me the Figma URL
  > and the screen you want to start with, and invoke the figma-to-flutter
  > skill."

If anything is blocking, format the blocker as a checklist the user can
walk through and re-run `/figma-to-flutter:setup` to verify.

## Guardrails

- Show diffs or commands before applying them. The user has not
  pre-approved any edits to `pubspec.yaml`, `.gitignore`, or their shell
  config.
- Skip steps that are already satisfied; do not redo work.
- Never write or log a `FIGMA_TOKEN` value.
- Never run `flutter clean`, `git ...` operations, or anything that touches
  files outside the patterns above without asking.
- If a phase fails, stop and ask the user; do not silently move on.
