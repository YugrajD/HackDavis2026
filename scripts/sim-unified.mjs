#!/usr/bin/env node
/**
 * Unified mobile sim entry: Expo (React Native) or native Swift GuardianRoad Xcode project.
 *
 * Usage:
 *   npm run sim          → Expo (iOS Simulator on macOS, LAN dev server on Windows/Linux)
 *   npm run sim:native   → Open native Swift Xcode project (macOS only)
 *
 * One Simulator app at a time: use either Expo or native, not both.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mobile = path.join(root, "apps", "mobile");
const isMac = process.platform === "darwin";
const mode = process.argv.includes("native") ? "native" : "expo";

if (mode === "native") {
  if (!isMac) {
    console.error("Native GuardianRoad (Swift) requires macOS + Xcode.");
    process.exit(1);
  }
  const xcodeproj = path.join(root, "GuardianRoad.xcodeproj");
  console.log("\n  Opening Guardian Road native app in Xcode.\n  Press Run (⌘R) to launch the iOS Simulator.\n");
  const r = spawnSync("open", [xcodeproj], { stdio: "inherit", cwd: root });
  process.exit(r.status ?? 0);
}

if (isMac) {
  console.log("\n  Expo → iOS Simulator (builds dev client if needed; uses apps/mobile).\n");
  const r = spawnSync("npx", ["expo", "run:ios"], { stdio: "inherit", cwd: mobile, shell: true });
  process.exit(r.status ?? 1);
}

console.log("\n  Expo dev server (LAN). Scan the QR code in Expo Go, or use an Android emulator.\n");
console.log("  On macOS: `npm run sim` → iOS Simulator, or `npm run sim:native` for the Swift app.\n");
const r = spawnSync("npx", ["expo", "start", "--lan"], { stdio: "inherit", cwd: mobile, shell: true });
process.exit(r.status ?? 1);
