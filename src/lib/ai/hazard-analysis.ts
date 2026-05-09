import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import type { ActorType, CameraRole, HazardEvent, HazardType, PerceptionResult, TrackedObject } from "@/lib/contracts";
import { getSponsorConfig } from "@/lib/config/server";

export type AnalyzeFrameInput = {
  imageBase64?: string;
  lat?: number;
  lng?: number;
  speedMps?: number;
  headingDeg?: number;
  camera?: CameraRole;
  perception?: PerceptionResult;
};

export type AnalyzeFrameOutput = Pick<
  HazardEvent,
  "type" | "severity" | "confidence" | "spokenAlert" | "explanation" | "objects"
>;

const hazardTypes: HazardType[] = [
  "close_pass",
  "vehicle_approach",
  "pedestrian_conflict",
  "pothole",
  "road_obstruction",
  "blocked_bike_lane",
  "door_zone",
  "hard_brake",
  "intersection_conflict",
];

const actorTypes: ActorType[] = ["rider", "car", "truck", "bus", "bike", "scooter", "pedestrian", "cone", "obstacle"];

const hazardSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    type: { type: SchemaType.STRING, format: "enum", enum: hazardTypes },
    severity: { type: SchemaType.NUMBER, description: "Risk score from 0 to 100." },
    confidence: { type: SchemaType.NUMBER, description: "Model confidence from 0 to 1." },
    spokenAlert: { type: SchemaType.STRING, description: "Short rider-safe voice warning, under 9 words." },
    explanation: { type: SchemaType.STRING, description: "One-sentence explanation of the hazard evidence." },
    objects: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING, format: "enum", enum: actorTypes },
          confidence: { type: SchemaType.NUMBER },
          bbox: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER }, minItems: 4, maxItems: 4, nullable: true },
          distanceM: { type: SchemaType.NUMBER, nullable: true },
          ttcSec: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ["id", "type", "confidence"],
      },
    },
  },
  required: ["type", "severity", "confidence", "spokenAlert", "explanation", "objects"],
};

export function analyzeFrameStub(input: AnalyzeFrameInput): AnalyzeFrameOutput {
  if (input.perception?.tracks.length) return outputFromPerception(input.perception);

  if (input.camera === "rear") {
    return {
      type: "vehicle_approach",
      severity: 84,
      confidence: 0.86,
      spokenAlert: "Vehicle closing from behind.",
      explanation: "Rear camera context suggests an approaching vehicle in the rider buffer zone.",
      objects: [
        {
          id: `obj-rear-${Date.now()}`,
          type: "car",
          confidence: 0.86,
          bbox: [0.12, 0.28, 0.48, 0.72],
          position: { x: -1.6, y: 0, z: -5.2 },
          velocity: { x: 0.1, y: 0, z: 7.8 },
          distanceM: 5.2,
          ttcSec: 1.4,
        },
      ],
    };
  }

  if ((input.speedMps ?? 0) > 5.5) {
    return {
      type: "intersection_conflict",
      severity: 79,
      confidence: 0.82,
      spokenAlert: "Cross traffic risk ahead.",
      explanation: "Forward camera and rider speed indicate a possible conflict zone ahead.",
      objects: [],
    };
  }

  return {
    type: "road_obstruction",
    severity: 62,
    confidence: 0.8,
    spokenAlert: "Road hazard ahead.",
    explanation: "Forward camera detected an obstruction or surface anomaly in the rider path.",
    objects: [],
  };
}

export async function analyzeFrameWithGemini(input: AnalyzeFrameInput): Promise<AnalyzeFrameOutput | null> {
  const { gemini } = getSponsorConfig();
  const image = parseImage(input.imageBase64);
  if (!gemini.apiKey || !image) return null;

  const genAI = new GoogleGenerativeAI(gemini.apiKey);
  const model = genAI.getGenerativeModel({
    model: gemini.model,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: hazardSchema,
      temperature: 0.2,
      maxOutputTokens: 700,
    },
  });

  const result = await model.generateContent([
    {
      text: `Analyze this road-safety frame from a Guardian Road phone sensor. Return only JSON matching the schema.
Context:
- latitude: ${formatNumber(input.lat)}
- longitude: ${formatNumber(input.lng)}
- speedMps: ${formatNumber(input.speedMps)}
- headingDeg: ${formatNumber(input.headingDeg)}
- camera: ${input.camera ?? "front"}
- local perception: ${perceptionSummary(input.perception)}

Use the allowed hazard types exactly: ${hazardTypes.join(", ")}.
Score severity by near-term rider/driver risk. Treat local perception as a tracking prior, but override it when the image contradicts it. Keep spokenAlert short enough for real-time voice playback. If no clear hazard is visible, return road_obstruction with low severity and low confidence rather than inventing a specific object.`,
    },
    { inlineData: image },
  ]);

  const parsed = parseJsonObject(result.response.text());
  return normalizeAnalysis(parsed, input);
}

function outputFromPerception(perception: PerceptionResult): AnalyzeFrameOutput {
  return {
    type: perception.hazardDraft.type,
    severity: perception.hazardDraft.severity,
    confidence: perception.hazardDraft.confidence,
    spokenAlert: perception.hazardDraft.spokenAlert,
    explanation: perception.hazardDraft.explanation,
    objects: perception.tracks,
  };
}

function perceptionSummary(perception?: PerceptionResult) {
  if (!perception) return "none";
  const tracks = perception.tracks
    .slice(0, 6)
    .map((track) => `${track.id}:${track.type}:${track.relativeLocation ?? "unknown"}:d=${formatNumber(track.distanceM)}:ttc=${formatNumber(track.ttcSec)}:risk=${track.riskScore}`)
    .join("; ");
  return `risk=${perception.risk.type}/${perception.risk.severity}, tracks=[${tracks || "none"}]`;
}

function parseImage(imageBase64?: string) {
  const trimmed = imageBase64?.trim();
  if (!trimmed) return null;

  const dataUriMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(trimmed);
  if (dataUriMatch) {
    return { mimeType: dataUriMatch[1], data: dataUriMatch[2] };
  }

  return { mimeType: "image/jpeg", data: trimmed };
}

function normalizeAnalysis(value: unknown, input: AnalyzeFrameInput): AnalyzeFrameOutput {
  const fallback = analyzeFrameStub(input);
  if (!isRecord(value)) return fallback;

  const type = hazardTypes.includes(value.type as HazardType) ? (value.type as HazardType) : fallback.type;
  const severity = clamp(toNumber(value.severity, fallback.severity), 0, 100);
  const confidence = clamp(toNumber(value.confidence, fallback.confidence), 0, 1);
  const spokenAlert = toNonEmptyString(value.spokenAlert, fallback.spokenAlert).slice(0, 160);
  const explanation = toNonEmptyString(value.explanation, fallback.explanation).slice(0, 500);
  const objects = Array.isArray(value.objects) ? value.objects.map(normalizeObject).filter((item): item is TrackedObject => Boolean(item)) : [];

  return { type, severity, confidence, spokenAlert, explanation, objects: objects.length ? objects : (input.perception?.tracks ?? []) };
}

function normalizeObject(value: unknown): TrackedObject | null {
  if (!isRecord(value)) return null;
  const type = actorTypes.includes(value.type as ActorType) ? (value.type as ActorType) : "obstacle";
  const confidence = clamp(toNumber(value.confidence, 0.5), 0, 1);
  const id = toNonEmptyString(value.id, `obj-${type}-${Math.round(confidence * 100)}`);
  const bbox = Array.isArray(value.bbox) ? normalizeBbox(value.bbox) : undefined;
  const distanceM = value.distanceM === undefined || value.distanceM === null ? undefined : Math.max(0, toNumber(value.distanceM, 0));
  const ttcSec = value.ttcSec === undefined || value.ttcSec === null ? undefined : Math.max(0, toNumber(value.ttcSec, 0));

  return { id, type, confidence, bbox, distanceM, ttcSec };
}

function normalizeBbox(values: unknown[]): [number, number, number, number] | undefined {
  if (values.length !== 4) return undefined;
  const bbox = values.map((value) => clamp(toNumber(value, 0), 0, 1));
  return [bbox[0], bbox[1], bbox[2], bbox[3]];
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toNonEmptyString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value?: number) {
  return Number.isFinite(value) ? String(value) : "unknown";
}
