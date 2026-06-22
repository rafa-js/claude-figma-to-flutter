# Setup details

## Figma access

Preferred: official Figma MCP server, remote endpoint `https://mcp.figma.com/mcp`.
Read tools cover code, images, and variable definitions. Install in Claude Code:

```bash
claude plugin install figma@claude-plugins-official
```

It is in beta and currently free during the beta period. Rate limits apply to the
read tools and follow the Figma REST API tiers.

Fallback: Figma REST API.

- Tree: `GET https://api.figma.com/v1/files/<file_key>/nodes?ids=<node_id>`
- Reference image: `GET https://api.figma.com/v1/images/<file_key>?ids=<node_id>&format=png&scale=2`
- Auth header: `X-Figma-Token: <personal_access_token>`

The file key and node id are both in a frame URL of the form
`https://www.figma.com/design/<file_key>/...?node-id=<node_id>`.

## Matching dimensions and DPR

The render and the reference must have the same pixel dimensions, or you normalize
one before diffing. Choose the harness `physicalSize` to match the Figma frame
logical size, and the `devicePixelRatio` to match the export scale, so
`logical_size * dpr` equals the exported pixel dimensions. If a frame is 393x852
logical and you export at scale 2, the reference is 786x1704, so render at
`devicePixelRatio = 2`.

## Fonts

Load every font the design uses before pumping the widget. Missing or substituted
fonts are the largest source of false differences because text covers a large
fraction of most screens.

```dart
Future<void> loadFonts() async {
  TestWidgetsFlutterBinding.ensureInitialized();
  final loader = FontLoader('Inter')
    ..addFont(rootBundle.load('assets/fonts/Inter-Regular.ttf'))
    ..addFont(rootBundle.load('assets/fonts/Inter-SemiBold.ttf'));
  await loader.load();
}
```

## Determinism checklist

- Disable or settle animations (pump to completion, or turn them off in tests).
- Replace `DateTime.now()` and any random values with fixed constants.
- Mock or stub network images so nothing loads over the wire.
- Run captures on a single OS in CI (Linux is the common choice) to avoid
  cross-platform font rendering drift.

## Diff dependencies

```bash
pip install pillow numpy scikit-image
```

`scripts/diff.py` resizes the render to the reference dimensions if they differ
(and warns), computes SSIM and pixel mismatch, and writes `diff.png` plus
`scores.json`.
