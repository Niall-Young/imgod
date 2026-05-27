#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

function usage() {
  console.error(`Usage:
  node ${path.basename(__filename)} --out <project-asset.png> [--since <marker-file>] [--root <codex-home>] [--min-bytes 2048]

Copies the newest image generated after --since from $CODEX_HOME/generated_images into --out.`);
}

function parseArgs(argv) {
  const args = {
    root: process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
    minBytes: 2048,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--")) continue;
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    args[key.slice(2)] = value;
    i += 1;
  }

  if (!args.out) {
    usage();
    process.exit(2);
  }

  args.out = path.resolve(args.out);
  args.root = path.resolve(args.root);
  args.minBytes = Number(args.minBytes);

  if (!Number.isFinite(args.minBytes) || args.minBytes < 0) {
    throw new Error("--min-bytes must be a non-negative number.");
  }

  return args;
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "skills" || entry.name === "plugins") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (IMAGE_EXTENSIONS.test(entry.name)) files.push(full);
  }
  return files;
}

const args = parseArgs(process.argv.slice(2));
const generatedRoot = path.join(args.root, "generated_images");
const searchRoot = existsSync(generatedRoot) ? generatedRoot : args.root;
const sinceTime = args.since && existsSync(args.since) ? statSync(args.since).mtimeMs : Date.now() - 15 * 60 * 1000;

const candidates = walk(searchRoot)
  .map((file) => ({ file, stat: statSync(file) }))
  .filter(({ file, stat }) => path.resolve(file) !== args.out && stat.size >= args.minBytes && stat.mtimeMs >= sinceTime)
  .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

if (candidates.length === 0) {
  console.error(`No generated image found under ${searchRoot} newer than ${new Date(sinceTime).toISOString()}.`);
  console.error("Do not create a vector/shape placeholder. Retry image generation, inspect $CODEX_HOME/generated_images, or stop and ask for a recoverable source image.");
  process.exit(1);
}

mkdirSync(path.dirname(args.out), { recursive: true });
copyFileSync(candidates[0].file, args.out);

console.log(args.out);
console.log(`source=${candidates[0].file}`);
