#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prompts = process.argv.slice(2);
const inputs = prompts.length
  ? prompts
  : [
      "rear camera close pass on Russell Boulevard",
      "blocked bike lane with cones near campus",
      "pedestrian crosswalk conflict at a Davis intersection",
      "parked car door zone on a narrow street",
    ];

const outputDir = path.join(process.cwd(), "public", "generated", "scenarios");
await mkdir(outputDir, { recursive: true });

const scenarios = inputs.map((prompt) => generateScenario(prompt));
await writeFile(path.join(outputDir, "road-scenarios.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), scenarios }, null, 2)}\n`);
console.log(`Wrote ${scenarios.length} scenarios to public/generated/scenarios/road-scenarios.json`);

function generateScenario(prompt) {
  const seed = hashString(prompt);
  const picked = pickHazard(prompt, seed);
  const severity = Math.min(100, Math.max(0, 62 + (seed % 31)));
  const mode = /car|dashcam|driver/i.test(prompt) ? "car" : "bike";
  const camera = /behind|rear/i.test(prompt) ? "rear" : mode === "car" ? "dashcam" : "front";
  const origin = { lat: 38.5449 + ((seed % 17) - 8) * 0.00008, lng: -121.7405 + ((seed % 13) - 6) * 0.00008 };

  return {
    id: `scenario-${picked.type.replaceAll("_", "-")}-${seed.toString(36)}`,
    title: picked.title,
    prompt,
    mode,
    camera,
    origin,
    timeline: [
      { t: 0, type: picked.type, severity: Math.max(35, severity - 22), confidence: 0.58, spokenAlert: "Monitor traffic ahead.", explanation: `Early cue from scenario prompt: ${prompt}` },
      { t: 3.2, type: picked.type, severity, confidence: 0.82, spokenAlert: picked.alert, explanation: `${picked.title} generated for Guardian Road replay and perception testing.` },
    ],
    reconstructionHints: {
      splatPrompt: `Davis CA street scene, ${prompt}, safety reconstruction evidence, clear lane geometry`,
      cameraPath: [
        { t: 0, x: 0, y: 1.6, z: -6, yawDeg: 0 },
        { t: 1.6, x: 0.2, y: 1.55, z: -2.5, yawDeg: 3 },
        { t: 3.2, x: 0.4, y: 1.5, z: 1.5, yawDeg: 8 },
      ],
    },
  };
}

function pickHazard(prompt, seed) {
  const hazards = [
    { match: /close|pass|overtak|car|truck|bus/i, type: "close_pass", title: "Close pass reconstruction", alert: "Vehicle passing close." },
    { match: /door|parked/i, type: "door_zone", title: "Door-zone conflict", alert: "Door zone ahead." },
    { match: /pedestrian|crosswalk|walk/i, type: "pedestrian_conflict", title: "Crosswalk conflict", alert: "Pedestrian conflict ahead." },
    { match: /pothole|debris|cone|blocked|obstruction|surface/i, type: "road_obstruction", title: "Blocked lane hazard", alert: "Road hazard ahead." },
    { match: /intersection|turn|left|right|conflict/i, type: "intersection_conflict", title: "Intersection conflict", alert: "Cross traffic risk." },
  ];
  return hazards.find((item) => item.match.test(prompt)) ?? hazards[seed % hazards.length];
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}
