#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillRoot = path.resolve(__dirname, "..");

function usage() {
  console.error(`Usage:
  node /path/to/img-to-figma/scripts/capture_with_chrome.mjs --url <react-dev-url> --out <figma-capture.txt> [--viewport 1440x900] [--script <capture-js>]

Example:
  cd /path/to/react-project
  node /path/to/img-to-figma/scripts/capture_with_chrome.mjs --url http://127.0.0.1:5173 --out ./figma-capture.txt --viewport 1440x900`);
}

function readArgs(argv) {
  const args = {
    script: path.join(skillRoot, "assets", "capture-for-design.js"),
    viewport: "1440x900",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--")) continue;
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    args[key.slice(2)] = value;
    i += 1;
  }

  if (!args.url || !args.out) {
    usage();
    process.exit(2);
  }

  return args;
}

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/i.exec(value);
  if (!match) {
    throw new Error(`Invalid viewport "${value}". Use WIDTHxHEIGHT, for example 1440x900.`);
  }
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function originFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`Invalid URL "${value}".`);
  }
}

async function withTimeout(promise, ms, label) {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms.`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timer]);
  } finally {
    clearTimeout(timeout);
  }
}

async function loadPlaywrightCore() {
  try {
    return await import("playwright-core");
  } catch (error) {
    try {
      const cwdRequire = createRequire(path.join(process.cwd(), "package.json"));
      const resolved = cwdRequire.resolve("playwright-core");
      return await import(pathToFileURL(resolved).href);
    } catch {
      throw new Error(
        "Missing playwright-core. Run this helper from an environment where playwright-core is installed, or install it in the React project with `npm i -D playwright-core`.",
        { cause: error },
      );
    }
  }
}

const args = readArgs(process.argv.slice(2));
const scriptPath = path.resolve(args.script);
const outPath = path.resolve(args.out);

if (!existsSync(scriptPath)) {
  throw new Error(`Capture script not found: ${scriptPath}`);
}

const captureSource = readFileSync(scriptPath, "utf8");
const viewport = parseViewport(args.viewport);
const origin = originFromUrl(args.url);
const { chromium } = await loadPlaywrightCore();

const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
});
let context;

try {
  context = await browser.newContext({ viewport });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });

  const page = await context.newPage();
  await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => document.body && document.body.children.length > 0, null, { timeout: 10000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  const payload = await withTimeout(page.evaluate(captureSource), 45000, "Figma capture");
  if (typeof payload !== "string" || !payload.startsWith("<span data-h2d=\"<!--(figh2d)")) {
    throw new Error("Capture did not return a Figma text/html payload.");
  }

  writeFileSync(outPath, payload, "utf8");
  console.log(outPath);
} finally {
  if (context) await context.close().catch(() => {});
  await browser.close();
}
