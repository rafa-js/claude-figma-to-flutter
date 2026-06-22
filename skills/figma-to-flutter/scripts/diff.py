#!/usr/bin/env python3
"""
diff.py - quantitative gate for the Figma->Flutter loop.

Compares a Flutter render against a Figma reference. Writes a highlighted diff
image and a scores.json (SSIM, pixel mismatch percent, both dimensions).

Usage:
    python diff.py --reference ref.png --render render.png --out ./attempts/001/ \
        [--ssim-min 0.95] [--threshold 0.10]

--threshold is the per-pixel normalized difference above which a pixel counts as
changed (absorbs anti-aliasing noise). The gate is on SSIM, not raw pixels.

Dependencies: pillow, numpy, scikit-image
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim


def load_rgb(path: str) -> Image.Image:
    return Image.open(path).convert("RGB")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reference", required=True)
    ap.add_argument("--render", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--ssim-min", type=float, default=0.95)
    ap.add_argument("--threshold", type=float, default=0.10)
    ap.add_argument("--attempt", type=int, default=0)
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    ref = load_rgb(args.reference)
    ren = load_rgb(args.render)

    ref_dims = list(ref.size)   # (w, h)
    ren_dims = list(ren.size)
    dims_match = ref_dims == ren_dims

    # If dimensions differ, resize the render to the reference so a score can be
    # produced, but flag it: a mismatch usually means the harness size or DPR is
    # wrong, and the score should not be trusted until that is fixed.
    if not dims_match:
        ren = ren.resize(ref.size, Image.LANCZOS)

    ref_arr = np.asarray(ref, dtype=np.float64) / 255.0
    ren_arr = np.asarray(ren, dtype=np.float64) / 255.0

    # SSIM over the three channels.
    score, ssim_map = ssim(
        ref_arr, ren_arr, channel_axis=2, data_range=1.0, full=True
    )

    # Per-pixel max-channel difference, thresholded.
    per_pixel = np.max(np.abs(ref_arr - ren_arr), axis=2)
    changed = per_pixel > args.threshold
    pixel_mismatch_pct = round(100.0 * float(changed.mean()), 3)

    # Highlight changed pixels in red over a dimmed reference.
    diff_vis = (ref_arr * 0.4 * 255).astype(np.uint8)
    diff_vis[changed] = [255, 0, 0]
    Image.fromarray(diff_vis, mode="RGB").save(out / "diff.png")

    passed = bool(dims_match and score >= args.ssim_min)
    scores = {
        "attempt": args.attempt,
        "ssim": round(float(score), 4),
        "pixel_mismatch_pct": pixel_mismatch_pct,
        "ref_dims": ref_dims,
        "render_dims": ren_dims,
        "dims_match": dims_match,
        "gate": {"ssim_min": args.ssim_min, "passed": passed},
    }
    (out / "scores.json").write_text(json.dumps(scores, indent=2))

    print(json.dumps(scores, indent=2))
    if not dims_match:
        print(
            "WARNING: dimensions differ "
            f"(ref {ref_dims} vs render {ren_dims}). "
            "Fix the harness physicalSize/devicePixelRatio before trusting the score."
        )
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
