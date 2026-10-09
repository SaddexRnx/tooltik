/**
 * SHA-256 hashing entry points for source-file identity.
 *
 * The algorithm core lives in ./sha256-core.js (plain JS + JSDoc) so the
 * exact same implementation runs on the main thread, inside the browser
 * worker and under Node tests.
 *
 * Browser hashing runs in a Web Worker built from the raw text of the core
 * file inlined into a Blob URL. A bundler-generated worker entry
 * (`new Worker(new URL("./x.worker.ts", import.meta.url))`) deadlocks the
 * Next 16 Turbopack build, so the worker is assembled at runtime instead;
 * the CSP explicitly allows `worker-src blob:` for this. Any worker problem
 * falls back to the main-thread implementation, which produces identical
 * digests. Node always takes the main-thread path.
 */

import { Sha256, sha256Hex } from "./sha256-core.js";

export { Sha256, sha256Hex };

const READ_CHUNK = 8 * 1024 * 1024;

/**
 * Main-thread hashing: slices the Blob so peak memory stays bounded and
 * yields to the event loop between chunks so the UI keeps painting.
 */
async function sha256FileMainThread(file: Blob): Promise<string> {
  const hasher = new Sha256();
  for (let offset = 0; offset < file.size; offset += READ_CHUNK) {
    const slice = await file
      .slice(offset, Math.min(offset + READ_CHUNK, file.size))
      .arrayBuffer();
    hasher.update(new Uint8Array(slice));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return hasher.digestHex();
}

// --- worker offload (browser only; Node tests use the main thread) ----------

/** Appended to the raw core source to form the worker module. */
const WORKER_GLUE = `
const READ_CHUNK = 8 * 1024 * 1024;
self.onmessage = async (ev) => {
  const { id, file } = ev.data;
  try {
    const hasher = new Sha256();
    for (let offset = 0; offset < file.size; offset += READ_CHUNK) {
      const slice = await file.slice(offset, Math.min(offset + READ_CHUNK, file.size)).arrayBuffer();
      hasher.update(new Uint8Array(slice));
    }
    self.postMessage({ id, ok: true, hex: hasher.digestHex() });
  } catch (err) {
    self.postMessage({ id: id, ok: false, error: String((err && err.message) || err) });
  }
};
`;

interface PendingHash {
  resolve: (hex: string) => void;
  reject: (err: Error) => void;
}

let sharedWorker: Worker | null = null;
let workerUnavailable = false;
let nextJobId = 1;
let workerSourcePromise: Promise<string | null> | null = null;
const pending = new Map<number, PendingHash>();

function rejectAllPending(reason: Error): void {
  for (const [, job] of pending) job.reject(reason);
  pending.clear();
}

/**
 * Raw text of sha256-core.js plus the worker glue. The `?raw` import goes
 * through the Turbopack rule in next.config.ts (local raw-string loader).
 * Only evaluated in the browser; Node never reaches it.
 */
function loadWorkerSource(): Promise<string | null> {
  if (!workerSourcePromise) {
    workerSourcePromise = (async () => {
      if (typeof Worker === "undefined" || typeof document === "undefined") return null;
      try {
        const mod = await import("./sha256-core.js?raw");
        const src: unknown = mod.default;
        if (typeof src !== "string" || !src.includes("class Sha256")) return null;
        return `${src}\n${WORKER_GLUE}`;
      } catch {
        return null;
      }
    })();
  }
  return workerSourcePromise;
}

/** Lazily creates the hashing worker; null when unavailable (Node, CSP, …). */
async function getSha256Worker(): Promise<Worker | null> {
  if (workerUnavailable) return null;
  if (sharedWorker) return sharedWorker;
  if (typeof Worker === "undefined") {
    workerUnavailable = true;
    return null;
  }
  const source = await loadWorkerSource();
  if (source === null) {
    workerUnavailable = true;
    return null;
  }
  try {
    // One Blob URL for the session; the worker lives as long as the page.
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const worker = new Worker(url, { type: "module" });
    worker.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { id: number; ok: boolean; hex?: string; error?: string };
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.ok && typeof data.hex === "string") job.resolve(data.hex);
      else job.reject(new Error(data.error || "worker-hash-failed"));
    };
    worker.onerror = () => {
      // The worker script failed to load or crashed: permanently fall back
      // to the main thread for this session.
      workerUnavailable = true;
      try {
        worker.terminate();
      } catch {
        // ignore
      }
      sharedWorker = null;
      rejectAllPending(new Error("sha256 worker failed"));
    };
    sharedWorker = worker;
    return worker;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

/**
 * Hashes a Blob/File as the source/output identity (SHA-256, hex).
 *
 * In the browser the work is offloaded to a Web Worker so the main thread
 * stays responsive; any worker problem (not available, script error, bad
 * reply) silently falls back to the main-thread implementation, which
 * produces identical digests. Node always takes the main-thread path.
 */
export async function sha256File(file: Blob): Promise<string> {
  const worker = await getSha256Worker();
  if (worker) {
    const id = nextJobId++;
    try {
      const hex = await new Promise<string>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, file });
      });
      if (/^[0-9a-f]{64}$/.test(hex)) {
        // Evidence flag for the e2e run: proves the worker path was taken.
        (globalThis as unknown as { __toolt_sha_worker_used?: boolean }).__toolt_sha_worker_used =
          true;
        return hex;
      }
    } catch {
      // fall through to the main thread
    } finally {
      pending.delete(id);
    }
  }
  return sha256FileMainThread(file);
}
