import type { PerceptionResult, FrameObservation } from "@/lib/perception/frame-pipeline";

export type PerceptionWorkerRequest = {
  id: string;
  frame: FrameObservation;
  previous?: FrameObservation;
};

export type PerceptionWorkerResponse =
  | { id: string; ok: true; result: PerceptionResult }
  | { id: string; ok: false; error: string };

export function createPerceptionWorker(scriptUrl = "/workers/perception-worker.js") {
  if (typeof window === "undefined") return null;
  return new Worker(scriptUrl, { type: "module" });
}

export function analyzeFrameInWorker(worker: Worker, frame: FrameObservation, previous?: FrameObservation) {
  const id = `perception-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise<PerceptionResult>((resolve, reject) => {
    const onMessage = (event: MessageEvent<PerceptionWorkerResponse>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener("message", onMessage);
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage({ id, frame, previous } satisfies PerceptionWorkerRequest);
  });
}
