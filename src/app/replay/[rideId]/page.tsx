import { headers } from "next/headers";
import { ReplayConsole } from "@/components/replay/ReplayConsole";
import type { ReplayPayload } from "@/lib/contracts";

export const dynamic = "force-dynamic";

type ReplayPageProps = {
  params: Promise<{ rideId: string }>;
  searchParams?: Promise<{ event?: string }>;
};

type ReplayFetchState = {
  endpoint: string;
  ok: boolean;
  status: number | null;
  statusText: string;
  receivedAt: string;
  error?: string;
};

type ReplayFetchResult = {
  payload: ReplayPayload | null;
  state: ReplayFetchState;
};

export default async function ReplayPage({ params, searchParams }: ReplayPageProps) {
  const emptyQuery: { event?: string } = {};
  const [{ rideId }, query] = await Promise.all([params, searchParams ?? Promise.resolve(emptyQuery)]);
  const result = await fetchReplayPayload(rideId);

  return <ReplayConsole rideId={rideId} payload={result.payload} fetchState={result.state} initialEventId={query.event} />;
}

async function fetchReplayPayload(rideId: string): Promise<ReplayFetchResult> {
  const endpoint = `/api/replay/${encodeURIComponent(rideId)}`;
  const receivedAt = new Date().toISOString();

  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host") ?? "localhost:3000";
    const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const response = await fetch(`${protocol}://${host}${endpoint}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const json = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return {
        payload: null,
        state: {
          endpoint,
          ok: false,
          status: response.status,
          statusText: response.statusText,
          receivedAt,
          error: extractError(json) ?? `Replay API returned ${response.status}.`,
        },
      };
    }

    if (!isReplayPayload(json)) {
      return {
        payload: null,
        state: {
          endpoint,
          ok: false,
          status: response.status,
          statusText: "Invalid payload",
          receivedAt,
          error: "Replay API returned JSON, but it did not match the ReplayPayload contract.",
        },
      };
    }

    return {
      payload: json,
      state: {
        endpoint,
        ok: true,
        status: response.status,
        statusText: response.statusText,
        receivedAt,
      },
    };
  } catch (error) {
    return {
      payload: null,
      state: {
        endpoint,
        ok: false,
        status: null,
        statusText: "Fetch failed",
        receivedAt,
        error: error instanceof Error ? error.message : "Replay API request failed.",
      },
    };
  }
}

function isReplayPayload(value: unknown): value is ReplayPayload {
  if (!isRecord(value)) return false;
  const ride = value.ride;
  return isRecord(ride) && Array.isArray(ride.route) && Array.isArray(value.events) && Array.isArray(value.dangerSegments) && typeof value.generatedAt === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractError(value: unknown) {
  if (!isRecord(value)) return null;
  if (typeof value.error === "string") return value.error;
  if (typeof value.message === "string") return value.message;
  return null;
}
