/** Human-readable formatting helpers for file/media values. */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

export function formatDelta(bytes: number): string {
  const sign = bytes > 0 ? "+" : bytes < 0 ? "−" : "";
  return `${sign}${formatBytes(Math.abs(bytes))}`;
}

/** Formats seconds as `m:ss` or `h:mm:ss`. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "N/A";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Formats FPS: integers stay clean, decimals keep at most 2 places. */
export function formatFps(fps: number): string {
  if (!Number.isFinite(fps) || fps <= 0) return "N/A";
  const rounded = Math.round(fps * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.005) return String(Math.round(rounded));
  return String(rounded);
}

export function formatBitrate(bps: number | null | undefined): string {
  if (!bps || !Number.isFinite(bps) || bps <= 0) return "N/A";
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
}

/** `1920x1080` with a proper multiplication sign (RTL-safe). */
export function formatResolution(width: number, height: number): string {
  if (!width || !height) return "N/A";
  return `${width}\u00d7${height}`;
}

/** Sample rate in kHz, e.g. `48 kHz`. */
export function formatSampleRate(hz: number): string {
  if (!hz) return "N/A";
  return `${Math.round(hz / 100) / 10} kHz`;
}

/** Output filename: `my clip.mp4` → `my clip_patched.mp4`. */
export function patchedFileName(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${base}_patched.mp4`;
}
