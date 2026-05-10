"use client";

import { useEffect, useRef } from "react";

const COLS = 96;
const ROWS = 32;
const HORIZON = 6;

// Hazards approaching from the vanishing point. Phase 0..1 maps to
// distance: 0 = at the horizon, 1 = at the rider's feet.
const HAZARDS: Array<{ side: "L" | "R"; offset: number; label: string }> = [
  { side: "L", offset: 0.0, label: "!" },
  { side: "R", offset: 0.28, label: "!" },
  { side: "L", offset: 0.61, label: "!" },
  { side: "R", offset: 0.83, label: "!" },
];

// Distance markers along the right shoulder, scrolling forward.
const DISTANCE_LABELS = ["80M", "60M", "40M", "20M"] as const;

// Side-of-the-road easter eggs. Each sprite is a small ASCII piece dropped
// on the shoulder at a random distance; it scrolls forward with the road.
// Most are roadway-relevant; a couple are pure goofs.
const SPRITES: ReadonlyArray<readonly string[]> = [
  // Clawd — Claude Code's anthropic-octopus mascot, small and waving
  [
    "  .---.  ",
    " ( ^_^ ) ",
    "  )___(  ",
    " //|||\\\\ ",
  ],
  // Side-profile bike
  [
    "   __o ",
    " _ \\<_ ",
    "(_)/(_)",
  ],
  // Hatchback
  [
    " _____  ",
    "|_   _\\ ",
    "(o)-(o) ",
  ],
  // Kick scooter
  [
    "  __    ",
    " /  |   ",
    "O---o   ",
  ],
  // Traffic cone
  [
    "   ^    ",
    "  /=\\   ",
    " /===\\  ",
    "_______ ",
  ],
  // Stop sign
  [
    " ,---.  ",
    "/STOP \\ ",
    "\\-----/ ",
    "   |    ",
  ],
  // Deer
  [
    " (\\_/)  ",
    " (o.o)  ",
    " /| |\\  ",
  ],
  // Dog
  [
    "  /^ ^\\  ",
    " ( o.o ) ",
    "  > ^ <  ",
  ],
  // Mailbox
  [
    " _____  ",
    "|[]_[]| ",
    "   |    ",
  ],
  // Fire hydrant
  [
    "  _o_   ",
    " | T |  ",
    " |___|  ",
  ],
  // Pine tree
  [
    "   /\\   ",
    "  /  \\  ",
    " /____\\ ",
    "   ||   ",
  ],
  // Coffee cup
  [
    " ___ _  ",
    "|   | ) ",
    "|___|/  ",
  ],
  // Skateboard
  [
    "  ___   ",
    " /___\\  ",
    " O   O  ",
  ],
  // Pedestrian
  [
    "  o   ",
    " /|\\  ",
    " / \\  ",
  ],
  // Bus
  [
    " _______  ",
    "|[][][]|  ",
    "(o)===(o) ",
  ],
  // ASCII heart for Davis
  [
    " /\\  /\\ ",
    " \\    / ",
    "  \\  /  ",
    "   \\/   ",
  ],
  // Bicycle "share the road" placard
  [
    " .---.  ",
    "| (o-o)|",
    " '---'  ",
  ],
];

const SPRITE_PERIOD = 4200; // one sprite cycle, ms
const SPRITE_LANES = 2; // alternating left + right at offset phases

// Forward-motion clock: position units that scroll toward the viewer. One
// "unit" is one cell of road. Higher = faster apparent speed.
const SPEED = 0.025; // cells per ms — ~25 cells/sec at center
const HAZARD_PERIOD = 1700; // ms for one hazard to traverse the road
const DISTANCE_PERIOD = 1700;

function buildFrame(t: number): { chars: string[]; accents: Set<string> } {
  const grid: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(" "));
  const accents = new Set<string>();
  const cx = COLS / 2;
  const scroll = t * SPEED;

  // Horizon: a brisk shimmer of dots; the offset visibly walks left.
  const horizonShimmer = Math.floor(t / 60) % 6;
  for (let x = 0; x < COLS; x++) {
    if ((x + horizonShimmer) % 4 !== 0) grid[HORIZON][x] = "·";
  }

  // Sky flecks — visible pulse rather than a slow fade.
  const flecks: Array<[number, number]> = [
    [2, 8], [3, 24], [1, 41], [4, 58], [2, 73], [3, 88], [1, 14], [4, 31], [2, 47], [3, 81],
  ];
  for (const [y, x] of flecks) {
    if (((Math.floor(t / 220) + x) % 5) !== 0) grid[y][x] = "·";
  }

  // Road — perspective lines + scrolling stripes + depth-graded surface.
  for (let y = HORIZON + 1; y < ROWS; y++) {
    const depth = (y - HORIZON) / (ROWS - HORIZON);
    const halfWidth = 2 + depth * (cx - 3);
    const left = Math.round(cx - halfWidth);
    const right = Math.round(cx + halfWidth);

    if (left >= 0 && left < COLS) grid[y][left] = depth > 0.55 ? "│" : "|";
    if (right >= 0 && right < COLS) grid[y][right] = depth > 0.55 ? "│" : "|";

    // Center dashed stripe — scrolls toward the viewer. Faster + denser.
    const stripePhase = (scroll * 1.8 + y * 0.6) % 3;
    if (stripePhase < 1.4 && y > HORIZON + 2) {
      const xc = Math.round(cx);
      grid[y][xc] = depth > 0.5 ? "█" : "▓";
    }

    // Side stripes — scroll in sync. Adds parallax so the motion is obvious.
    const sidePhase = (scroll * 1.8 + y * 0.6 + 1.5) % 3;
    if (sidePhase < 0.9 && depth > 0.3) {
      const lx = Math.round(cx - halfWidth * 0.55);
      const rx = Math.round(cx + halfWidth * 0.55);
      if (grid[y][lx] === " ") grid[y][lx] = depth > 0.6 ? "▒" : "·";
      if (grid[y][rx] === " ") grid[y][rx] = depth > 0.6 ? "▒" : "·";
    }
  }

  // Speed-lines on the road surface — short streaks that scroll forward.
  for (let i = 0; i < 18; i++) {
    const seedX = (i * 37) % 100;
    const trackPhase = (scroll * 0.9 + i * 0.3) % 1;
    const y = Math.round(HORIZON + 1 + trackPhase * (ROWS - HORIZON - 2));
    const depth = (y - HORIZON) / (ROWS - HORIZON);
    if (depth < 0.15) continue;
    const halfWidth = 2 + depth * (cx - 3);
    const left = Math.round(cx - halfWidth) + 2;
    const right = Math.round(cx + halfWidth) - 2;
    if (right <= left) continue;
    const offset = ((seedX / 100) * (right - left)) | 0;
    const x = left + offset;
    if (x >= 0 && x < COLS && grid[y][x] === " ") {
      grid[y][x] = depth > 0.65 ? "═" : depth > 0.4 ? "-" : "·";
    }
  }

  // Approaching hazards — `[!]` walking toward the rider.
  for (const haz of HAZARDS) {
    const phase = ((t / HAZARD_PERIOD) + haz.offset) % 1;
    if (phase < 0.04) continue;
    const y = Math.round(HORIZON + phase * (ROWS - HORIZON - 1));
    if (y < HORIZON || y >= ROWS) continue;
    const depth = (y - HORIZON) / (ROWS - HORIZON);
    const halfWidth = 2 + depth * (cx - 3);
    const lane = haz.side === "L" ? cx - halfWidth - 3 : cx + halfWidth + 3;
    const xi = Math.round(lane);
    if (xi >= 0 && xi < COLS) {
      grid[y][xi] = haz.label;
      accents.add(`${y},${xi}`);
      if (depth > 0.3) {
        if (xi - 1 >= 0) {
          grid[y][xi - 1] = "[";
          accents.add(`${y},${xi - 1}`);
        }
        if (xi + 1 < COLS) {
          grid[y][xi + 1] = "]";
          accents.add(`${y},${xi + 1}`);
        }
      }
      // Trail line — the hazard's path back toward the horizon. Adds clear
      // forward motion when the hazard is close.
      if (depth > 0.5) {
        const trailY = y - 1;
        if (trailY > HORIZON && grid[trailY][xi] === " ") {
          grid[trailY][xi] = "·";
        }
      }
    }
  }

  // Distance markers — scroll on the right shoulder.
  const distancePhase = (t / DISTANCE_PERIOD) % 1;
  for (let i = 0; i < DISTANCE_LABELS.length; i++) {
    const phase = (distancePhase + i / DISTANCE_LABELS.length) % 1;
    const y = Math.round(HORIZON + phase * (ROWS - HORIZON - 1));
    if (y < HORIZON + 2 || y >= ROWS - 1) continue;
    const depth = (y - HORIZON) / (ROWS - HORIZON);
    if (depth < 0.18) continue;
    const halfWidth = 2 + depth * (cx - 3);
    const xi = Math.round(cx + halfWidth + 5);
    const label = DISTANCE_LABELS[i];
    // Clear a small slot so the label isn't broken by the speed-line streaks.
    for (let k = -1; k < label.length + 1; k++) {
      const x = xi + k;
      if (x >= 0 && x < COLS) grid[y][x] = " ";
    }
    for (let k = 0; k < label.length; k++) {
      const x = xi + k;
      if (x >= 0 && x < COLS) grid[y][x] = label[k];
    }
  }

  // Easter-egg sprites on the shoulders. Two lanes phased apart so something
  // is almost always passing by. Each cycle picks a stable sprite from the
  // library and a side; the sprite scrolls with the road.
  const labels = [
    "CLAWD", "BIKE", "CAR", "SCOOTER", "CONE", "STOP", "DEER", "DOG",
    "MAIL", "HYDRANT", "TREE", "COFFEE", "SKATE", "PED", "BUS", "DAVIS<3", "SHARE",
  ];
  for (let lane = 0; lane < SPRITE_LANES; lane++) {
    const phaseOffset = lane === 0 ? 0 : 0.5;
    const cycle = t / SPRITE_PERIOD + phaseOffset;
    const phase = cycle % 1;
    const cycleIndex = Math.floor(cycle);
    if (phase < 0.18 || phase > 0.96) continue;

    const pick = ((cycleIndex * 17 + lane * 11) % SPRITES.length + SPRITES.length) % SPRITES.length;
    const sprite = SPRITES[pick];
    const spriteW = sprite[0].length;

    // Position the sprite's TOP so the bottom row stays in-bounds.
    const topY = Math.round(HORIZON + 1 + phase * (ROWS - HORIZON - sprite.length - 1));
    if (topY + sprite.length >= ROWS) continue;
    // Anchor depth to the bottom of the sprite — that's where it "stands".
    const footY = topY + sprite.length - 1;
    const depth = (footY - HORIZON) / (ROWS - HORIZON);
    if (depth < 0.22) continue;
    const halfWidth = 2 + depth * (cx - 3);

    const side: "L" | "R" = ((cycleIndex + lane) % 2 === 0) ? "L" : "R";
    const anchorX = side === "L"
      ? Math.round(cx - halfWidth) - spriteW - 2
      : Math.round(cx + halfWidth) + 2;
    if (anchorX < 0 || anchorX + spriteW >= COLS) continue;

    for (let i = 0; i < sprite.length; i++) {
      const row = sprite[i];
      const y = topY + i;
      if (y <= HORIZON || y >= ROWS) continue;
      for (let j = 0; j < row.length; j++) {
        const ch = row[j];
        if (ch === " ") continue;
        const x = anchorX + j;
        if (x < 0 || x >= COLS) continue;
        grid[y][x] = ch;
        // Clawd gets the amber accent so it really pops as the easter egg.
        if (pick === 0) accents.add(`${y},${x}`);
      }
    }

    // Tiny label tag under near-distance sprites — names the thing.
    if (depth > 0.55) {
      const label = labels[pick] ?? "";
      const labelY = topY + sprite.length;
      if (label && labelY < ROWS - 1) {
        const labelX = anchorX + Math.max(0, Math.floor((spriteW - label.length) / 2));
        for (let k = 0; k < label.length; k++) {
          const x = labelX + k;
          if (x >= 0 && x < COLS) grid[labelY][x] = label[k];
        }
      }
    }
  }

  // Live HUD blink — top-left. Mimics a recording indicator that pulses with
  // the scene clock so the viewer can see the frame is actually updating.
  const blink = Math.floor(t / 500) % 2 === 0;
  if (blink) {
    grid[1][2] = "●";
    accents.add(`1,2`);
    const lab = "REC";
    for (let k = 0; k < lab.length; k++) {
      grid[1][4 + k] = lab[k];
      accents.add(`1,${4 + k}`);
    }
  }

  return { chars: grid.map((row) => row.join("")), accents };
}

function escapeHtml(ch: string): string {
  if (ch === "<") return "&lt;";
  if (ch === ">") return "&gt;";
  if (ch === "&") return "&amp;";
  return ch;
}

function renderHtml(chars: string[], accents: Set<string>): string {
  let out = "";
  for (let y = 0; y < chars.length; y++) {
    const row = chars[y];
    for (let x = 0; x < row.length; x++) {
      const ch = escapeHtml(row[x]);
      if (accents.has(`${y},${x}`)) {
        out += `<span style="color:#E7C59A">${ch}</span>`;
      } else {
        out += ch;
      }
    }
    out += "\n";
  }
  return out;
}

export default function AsciiHero() {
  const ref = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const start = performance.now();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tickOnce = (now: number) => {
      const t = reduced ? (now - start) * 0.25 : now - start;
      const { chars, accents } = buildFrame(t);
      el.innerHTML = renderHtml(chars, accents);
    };

    // Render the first frame immediately so SSR-empty doesn't flash.
    tickOnce(start);

    const loop = (now: number) => {
      tickOnce(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <pre
      ref={ref}
      aria-hidden
      className="ascii-hero font-mono text-[10px] sm:text-[11px] md:text-[12px] leading-[1.05] tracking-[0] text-polar-white/85 select-none whitespace-pre overflow-hidden"
    />
  );
}
