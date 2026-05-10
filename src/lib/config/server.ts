import path from "node:path";

export type SponsorConfig = {
  gemini: {
    apiKey?: string;
    model: string;
  };
  anthropic: {
    apiKey?: string;
    model: string;
  };
  elevenLabs: {
    apiKey?: string;
    voiceId: string;
    modelId: string;
    outputFormat: string;
  };
};

export type StorageConfig = {
  mongo: {
    uri?: string;
    dbName: string;
  };
  media: {
    uploadRoot: string;
    publicPrefix: string;
    limits: {
      thumbnailBytes: number;
      clipBytes: number;
      requestBytes: number;
    };
  };
  reports: {
    exportRoot: string;
    publicPrefix: string;
  };
};

export type ServerConfig = {
  sponsors: SponsorConfig;
  storage: StorageConfig;
};

const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";
const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";
const DEFAULT_MONGODB_DB = "guardian-road";

const DEFAULT_MEDIA_LIMITS = {
  thumbnailBytes: 4 * 1024 * 1024,
  clipBytes: 12 * 1024 * 1024,
};

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function envOrDefault(name: string, fallback: string) {
  return optionalEnv(name) ?? fallback;
}

export function getSponsorConfig(): SponsorConfig {
  return {
    gemini: {
      apiKey: optionalEnv("GEMINI_API_KEY"),
      model: envOrDefault("GEMINI_MODEL", DEFAULT_GEMINI_MODEL),
    },
    anthropic: {
      apiKey: optionalEnv("ANTHROPIC_API_KEY"),
      model: envOrDefault("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL),
    },
    elevenLabs: {
      apiKey: optionalEnv("ELEVENLABS_API_KEY"),
      voiceId: envOrDefault("ELEVENLABS_VOICE_ID", DEFAULT_ELEVENLABS_VOICE_ID),
      modelId: envOrDefault("ELEVENLABS_MODEL_ID", DEFAULT_ELEVENLABS_MODEL_ID),
      outputFormat: envOrDefault("ELEVENLABS_OUTPUT_FORMAT", DEFAULT_ELEVENLABS_OUTPUT_FORMAT),
    },
  };
}

export function getStorageConfig(): StorageConfig {
  const requestBytes = DEFAULT_MEDIA_LIMITS.thumbnailBytes + DEFAULT_MEDIA_LIMITS.clipBytes + 1024 * 1024;

  return {
    mongo: {
      uri: optionalEnv("MONGODB_URI"),
      dbName: envOrDefault("MONGODB_DB", DEFAULT_MONGODB_DB),
    },
    media: {
      uploadRoot: path.join(process.cwd(), "public", "generated", "uploads"),
      publicPrefix: "/generated/uploads",
      limits: {
        ...DEFAULT_MEDIA_LIMITS,
        requestBytes,
      },
    },
    reports: {
      exportRoot: path.join(process.cwd(), "public", "generated", "reports"),
      publicPrefix: "/generated/reports",
    },
  };
}

export function getServerConfig(): ServerConfig {
  return {
    sponsors: getSponsorConfig(),
    storage: getStorageConfig(),
  };
}

/** Base URL for Python YOLO sidecar (no trailing slash), e.g. http://127.0.0.1:8000 */
export function getYoloServiceUrl(): string | undefined {
  return optionalEnv("YOLO_SERVICE_URL");
}
