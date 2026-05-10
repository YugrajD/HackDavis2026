#!/usr/bin/env node
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const TEST_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://100.64.0.42:3000";
const previous = process.env.EXPO_PUBLIC_API_BASE_URL;

try {
  process.env.EXPO_PUBLIC_API_BASE_URL = TEST_API_BASE_URL;
  const buildConfig = require("../apps/mobile/app.config.js");
  const result = buildConfig({
    config: {
      name: "Guardian Road",
      slug: "guardian-road-mobile",
      extra: { existing: true },
    },
  });

  assert(result?.extra?.apiBaseUrl === TEST_API_BASE_URL, "app.config.js exposes EXPO_PUBLIC_API_BASE_URL as extra.apiBaseUrl");
  assert(result?.extra?.existing === true, "app.config.js preserves existing Expo extra config");
  assert(/^https?:\/\//.test(result.extra.apiBaseUrl), "apiBaseUrl is an absolute HTTP(S) URL");
  assert(!result.extra.apiBaseUrl.endsWith("/"), "apiBaseUrl should not end with a slash");

  const fallbackResult = buildConfig({ config: { extra: {} } });
  assert(fallbackResult.extra.apiBaseUrl === TEST_API_BASE_URL, "explicit env value wins over fallback");

  console.log("Mobile config smoke passed.");
  console.log(`- extra.apiBaseUrl=${result.extra.apiBaseUrl}`);
  console.log("- Expo config preserves existing extra fields");
} catch (error) {
  console.error(`Mobile config smoke failed: ${error.message}`);
  process.exit(1);
} finally {
  if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
