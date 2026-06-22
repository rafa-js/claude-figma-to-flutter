# Target: <task-id>

- Figma: file `<file_key>`, node `<node_id>`, frame `<name>`
- Builds: `lib/ui/components/<Widget>.dart`
- Capture test: `test/golden/<frame>_capture_test.dart`

## Frame geometry

- Logical size: <W>x<H>
- Export scale (DPR): <s>
- Reference pixel dims: <W*s>x<H*s>

## Gate

- ssim_min: 0.95
- iteration_cap: 8
- diff threshold: 0.10

## Notes

- Fonts used: <families and weights>
- Code Connect mapped components: <yes/no, which>
- Anything hard to infer from the node tree (states, dynamic content): <...>
