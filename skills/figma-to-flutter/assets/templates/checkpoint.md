# Checkpoint: <task-id>

The single file a fresh session reads to resume. Keep it current.

- Task id: <task-id>
- Figma: file `<file_key>`, node `<node_id>`, frame `<name>`
- Target widget: `lib/ui/components/<Widget>.dart`
- Reference: `reference.png` (<W>x<H>, scale <s>)
- Gate: SSIM >= <0.95>, iteration cap <8>

## Status

- State: in_progress | passed | stopped_plateau | stopped_cap
- Best attempt: <NNN>
- Best SSIM: <0.0> (pixel mismatch <0.0>%)
- Attempts run: <N>

## Current discrepancy list (ranked)

1. [high|med|low] <region>: <observed> vs <expected> -> <fix, token name>
2. ...

## Next action

<the single next edit to make, or "done" with stop reason>

## Stop reason (if stopped)

<gate met | plateau: SSIM flat across 2 attempts, residual cosmetic | cap reached>
