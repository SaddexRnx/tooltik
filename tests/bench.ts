/**
 * Real benchmark harness for the ToolT pipeline.
 *
 * Every number printed here is measured on the machine that runs this
 * script (warmup + timed iterations, in-memory Blobs, no disk I/O inside
 * the timed section). No estimates, no extrapolation.
 *
 * Covers: per-fixture pipeline ops, per-METHOD engine processing, per-GATE
 * validation timings (structure/payload/audio inside runValidation; the
 * decoded gate is browser-only and is called out as not measurable here),
 * and node RSS samples after each fixture section.
 *
 * Usage: npx tsx tests/bench.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cpus, platform, release, totalmem } from "node:os";
import { inspectMedia } from "../lib/mp4/inspect";
import { transformMedia } from "../lib/mp4/transform";
import { demuxVideo } from "../lib/reencode/demux";
import { Sha256, sha256File } from "../lib/integrity/sha256";
import { validateStructure } from "../lib/validate/structure";
import { comparePayload } from "../lib/validate/payload";
import { runValidation } from "../lib/validate/gates";
import { ENGINES } from "../lib/engines/registry";
import { computeEligibility, eligibilityFor } from "../lib/methods/eligibility";

interface Row {
  op: string;
  iters: number;
  minMs: number;
  medMs: number;
  maxMs: number;
  note: string;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function fmt(ms: number): string {
  return ms >= 100 ? ms.toFixed(0) : ms >= 1 ? ms.toFixed(1) : ms.toFixed(2);
}

async function bench(
  op: string,
  iters: number,
  fn: (i: number) => unknown,
  note = "",
): Promise<Row> {
  await fn(-1); // warmup, untimed
  const ms: number[] = [];
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    await fn(i);
    ms.push(performance.now() - t0);
  }
  return {
    op,
    iters,
    minMs: Math.min(...ms),
    medMs: median(ms),
    maxMs: Math.max(...ms),
    note,
  };
}

function toFile(bytes: Uint8Array, name: string): File {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([ab], name);
}

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function rssMb(): number {
  return process.memoryUsage.rss() / (1024 * 1024);
}

function rowFrom(op: string, ms: number[], note = ""): Row {
  return {
    op,
    iters: ms.length,
    minMs: Math.min(...ms),
    medMs: median(ms),
    maxMs: Math.max(...ms),
    note,
  };
}

async function benchFixture(path: string): Promise<Row[]> {
  const name = path.split(/[\\/]/).pop()!;
  const bytes = readFileSync(path);
  console.log(`\n--- ${name} (${mb(bytes.length)}) ---`);

  const file = toFile(bytes, name);
  const { info, context } = await inspectMedia(file);
  const patched = await transformMedia(context).then((o) => o.blob);
  const rows: Row[] = [];

  rows.push(await bench("inspectMedia", 5, () => inspectMedia(file)));

  rows.push(
    await bench("sha256File", 5, () => sha256File(file), `${mb(bytes.length)} read via Blob slices`),
  );

  rows.push(
    await bench(
      "transformMedia (patch)",
      3,
      async () => {
        const out = await transformMedia(context);
        if (out.blob.size <= file.size) throw new Error("patch did not grow output");
      },
      "container rewrite + validation of first sample",
    ),
  );

  rows.push(await bench("validateStructure (patched)", 5, () => validateStructure(patched)));

  rows.push(await bench("comparePayload (vide)", 3, () => comparePayload(file, patched, "vide")));

  rows.push(await bench("demuxVideo", 5, () => demuxVideo(context)));

  rows.push(
    await bench(
      "sha256Hex (pure JS, 200 KB)",
      5,
      () => {
        const h = new Sha256();
        h.update(bytes.subarray(0, 200_000));
        h.digestHex();
      },
      `${info.video.codecLabel} ${info.video.width}x${info.video.height}`,
    ),
  );

  // --- full pipeline (3 runnable gates; decode is browser-only) ------------
  rows.push(
    await bench(
      "runValidation (no decode)",
      3,
      () => runValidation(file, patched, { runDecode: false }),
      "structure + payload + audio; decoded gate fails closed in Node (browser-only)",
    ),
  );
  const rep = await runValidation(file, patched, { runDecode: false });
  for (const g of rep.gates) {
    rows.push(
      rowFrom(
        `  gate ${g.id}`,
        [g.ms],
        g.id === "decoded" ? "not run in Node (browser WebCodecs); 0 ms" : `pass=${g.pass}`,
      ),
    );
  }

  // --- per-method: every eligible engine processes this file ---------------
  const eligibility = computeEligibility(file, info);
  for (const engine of ENGINES) {
    const entry = eligibilityFor(eligibility, engine.id);
    if (!entry || entry.status === "unsupported") {
      rows.push({
        op: `engine ${engine.id}`,
        iters: 0,
        minMs: 0,
        medMs: 0,
        maxMs: 0,
        note: `not applicable: ${entry?.reason ?? "unknown"}`,
      });
      continue;
    }
    rows.push(
      await bench(
        `engine ${engine.id}`,
        3,
        async () => {
          const out = await engine.process(file, {});
          if (out.blob.size <= 0) throw new Error("engine produced an empty blob");
        },
        `${engine.name}; full rewrite from original`,
      ),
    );
  }

  return rows;
}

async function main(): Promise<void> {
  const dir = join(process.cwd(), "tests", "fixtures");
  const cpu = cpus();
  console.log("ToolT benchmarks (all numbers measured locally, in-memory)");
  console.log(
    `env: node ${process.version} · ${platform()} ${release()} · ` +
      `${cpu[0]?.model.trim() ?? "unknown cpu"} x${cpu.length} · ` +
      `${(totalmem() / (1024 ** 3)).toFixed(0)} GB RAM`,
  );
  console.log("method: 1 warmup + timed iterations; median/min/max wall time in ms");
  console.log(`rss at start: ${rssMb().toFixed(1)} MB (node, not the browser)`);

  const all: Row[] = [];
  let peakRss = rssMb();
  const fixtures = [
    "bbb_720_10s.mp4",
    "sample_5s.mp4",
    "synth_real60.mp4",
    "synth_120fps.mp4",
  ];
  for (const f of fixtures) {
    all.push(...(await benchFixture(join(dir, f))));
    const now = rssMb();
    if (now > peakRss) peakRss = now;
    console.log(`rss after ${f}: ${now.toFixed(1)} MB (node, not the browser)`);
  }

  console.log("\n=== results ===");
  console.log(
    "operation".padEnd(32) +
      "iters".padStart(6) +
      "min ms".padStart(10) +
      "med ms".padStart(10) +
      "max ms".padStart(10) +
      "  note",
  );
  for (const r of all) {
    console.log(
      r.op.padEnd(32) +
        String(r.iters).padStart(6) +
        fmt(r.minMs).padStart(10) +
        fmt(r.medMs).padStart(10) +
        fmt(r.maxMs).padStart(10) +
        (r.note ? `  ${r.note}` : ""),
    );
  }
  console.log(`\npeak node rss across all fixtures: ${peakRss.toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
