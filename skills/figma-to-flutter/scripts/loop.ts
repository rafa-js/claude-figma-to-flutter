/**
 * loop.ts - orchestrator for the per-frame loop (Steps 2 to 6).
 *
 * This is optional. In Claude Code you can drive the loop directly by following
 * SKILL.md. This stub is for when you want a scripted runner (CI, batch of
 * frames). It does not call the model itself; the critique step (Step 5) is the
 * agent's job. Wire that to your driver of choice.
 *
 * Usage:
 *   tsx loop.ts --task <task-id> [--ssim-min 0.95] [--max-iter 8]
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface Scores {
  ssim: number;
  pixel_mismatch_pct: number;
  dims_match: boolean;
  gate: { passed: boolean };
}

function arg(k: string, d?: string): string | undefined {
  const a = process.argv.slice(2);
  const i = a.indexOf(`--${k}`);
  return i >= 0 ? a[i + 1] : d;
}

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

const task = arg("task")!;
const ssimMin = Number(arg("ssim-min", "0.95"));
const maxIter = Number(arg("max-iter", "8"));
const taskDir = join(".claude", "tasks", task);

let prevSsim = -1;
let plateauCount = 0;

for (let i = 1; i <= maxIter; i++) {
  const attemptDir = join(taskDir, "attempts", pad(i));
  mkdirSync(attemptDir, { recursive: true });

  // Step 2-3: generate/edit widget then render. The render is produced by the
  // golden capture test. Wire your generation step here if scripting it.
  // execFileSync("flutter", ["test", `test/golden/${task}_capture_test.dart`, "--update-goldens"]);

  // Step 4: quantitative diff.
  execFileSync("python", [
    join(__dirname, "diff.py"),
    "--reference", join(taskDir, "reference.png"),
    "--render", join(attemptDir, "render.png"),
    "--out", attemptDir,
    "--ssim-min", String(ssimMin),
    "--attempt", String(i),
  ], { stdio: "inherit" });

  const scores: Scores = JSON.parse(
    readFileSync(join(attemptDir, "scores.json"), "utf8")
  );

  if (!scores.dims_match) {
    console.error("Dimension mismatch. Fix harness size/DPR before continuing.");
    process.exit(2);
  }

  // Step 5 (agent): produce critique.md / critique.json for this attempt by
  // following references/critique-prompt.md against reference.png, render.png,
  // and diff.png. This runner expects that file to exist before deciding.
  if (!existsSync(join(attemptDir, "critique.json"))) {
    console.log(`Attempt ${i}: ssim ${scores.ssim}. Awaiting critique (Step 5).`);
    break;
  }

  // Step 6: decide.
  if (scores.gate.passed) {
    console.log(`PASS at attempt ${i} (ssim ${scores.ssim}).`);
    break;
  }

  // Plateau detection.
  if (prevSsim >= 0 && scores.ssim - prevSsim < 0.003) {
    plateauCount++;
    if (plateauCount >= 2) {
      console.log(`Plateau at attempt ${i} (ssim ${scores.ssim}). Stopping.`);
      break;
    }
  } else {
    plateauCount = 0;
  }
  prevSsim = scores.ssim;
}

console.log("Update checkpoint.md with best attempt, score, and stop reason.");
