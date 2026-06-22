/**
 * figma_pull.ts - ingest a Figma node into a task directory (Step 0).
 *
 * Produces, under .claude/tasks/<task-id>/:
 *   spec.json       distilled node tree (layout, auto-layout, constraints)
 *   variables.json  token / variable definitions
 *   reference.png   ground-truth export at a fixed scale
 *   assets/         exported icons and images
 *
 * Prefer the Figma MCP server when available (tools for code, images, and
 * variable definitions). This stub shows the REST fallback. Fill in the TODOs.
 *
 * Env:
 *   FIGMA_TOKEN   personal access token (REST fallback only)
 *
 * Usage:
 *   tsx figma_pull.ts --file <file_key> --node <node_id> --task <task-id> --scale 2
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

interface Args {
  file: string;
  node: string;
  task: string;
  scale: number;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string, d?: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 ? a[i + 1] : d;
  };
  return {
    file: get("file")!,
    node: get("node")!,
    task: get("task")!,
    scale: Number(get("scale", "2")),
  };
}

const FIGMA = "https://api.figma.com/v1";

async function figma(path: string): Promise<any> {
  const res = await fetch(`${FIGMA}${path}`, {
    headers: { "X-Figma-Token": process.env.FIGMA_TOKEN ?? "" },
  });
  if (!res.ok) throw new Error(`Figma ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  const { file, node, task, scale } = parseArgs();
  const dir = join(".claude", "tasks", task);
  await mkdir(join(dir, "assets"), { recursive: true });

  // 1. Node tree. TODO: distill to the layout fields you actually use
  //    (auto-layout mode, padding, itemSpacing, constraints, fills, typography)
  //    rather than dumping the raw tree.
  const nodes = await figma(`/files/${file}/nodes?ids=${encodeURIComponent(node)}`);
  await writeFile(join(dir, "spec.json"), JSON.stringify(nodes, null, 2));

  // 2. Variables / tokens. TODO: map to your Dart token names.
  //    Local variables require the Enterprise variables endpoint; otherwise read
  //    styles from the node tree. With MCP, use the variable-definitions tool.
  await writeFile(join(dir, "variables.json"), JSON.stringify({ todo: true }, null, 2));

  // 3. Reference export.
  const img = await figma(
    `/images/${file}?ids=${encodeURIComponent(node)}&format=png&scale=${scale}`
  );
  const url = img.images?.[node];
  if (!url) throw new Error("No image URL returned for node");
  const png = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(join(dir, "reference.png"), png);

  // 4. Assets. TODO: walk the tree for image/icon fills and export each, then
  //    write them under assets/ and reference them from the widget.

  console.log(`Wrote spec.json, variables.json, reference.png to ${dir}`);
  console.log("TODO: distill spec, map variables, export per-node assets.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
