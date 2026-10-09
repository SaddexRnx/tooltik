/**
 * End-to-end browser run against the production build (npm run start, :7789).
 *
 * Verifies, in a real Chromium:
 *   1. Network privacy     – every request observed during the session goes to
 *                            127.0.0.1:7789; no beacon/WebSocket/upload.
 *   2. Security headers    – CSP + supporting headers served by next start.
 *   3. Full flow           – drop file → inspect (baseline decode, decoded-content
 *                            tiles, cross-check) → prepare → four validation
 *                            gates → result.
 *   4. Gate 3 in-browser   – WebCodecs really decodes and compares frames.
 *   5. Download            – gated link fires a real download; file is saved.
 *   6. JSON report export  – report schema, validation evidence, output sha256
 *                            matches the downloaded bytes.
 *   7. Multi-method run    – "Run all methods" on a fixture eligible for all
 *                            four engines; every row reaches a terminal status;
 *                            a passed row is promoted to the result screen.
 *   8. Worker fallback     – a second flow with `Worker` removed: main-thread
 *                            SHA-256 must verify (digests equal Node crypto)
 *                            and the worker-used flag must stay unset.
 *
 * Evidence: tests/e2e/report.json + screenshots (tests/e2e/*.png).
 * Exit code 0 only when every check passes.
 *
 * Usage: node tests/e2e/run.cjs
 *   E2E_FIXTURE=<name>.mp4       primary flow fixture   (default bbb_720_10s.mp4)
 *   E2E_ALT_FIXTURE=<name>.mp4   comparison fixture     (default synth_real60.mp4)
 */

const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const pw = require("C:/Users/ilyes/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright");

const BASE = process.env.E2E_BASE || "http://127.0.0.1:7789";
const FIXTURE = process.env.E2E_FIXTURE
  ? path.join(__dirname, "..", "fixtures", process.env.E2E_FIXTURE)
  : path.join(__dirname, "..", "fixtures", "bbb_720_10s.mp4");
// Comparison fixture: real H.264 samples, 60 fps, no edit list - eligible
// for ALL four methods and decodable in the browser.
const ALT_FIXTURE = process.env.E2E_ALT_FIXTURE
  ? path.join(__dirname, "..", "fixtures", process.env.E2E_ALT_FIXTURE)
  : path.join(__dirname, "..", "fixtures", "synth_real60.mp4");
const SHOTS = __dirname;

const checks = [];
function check(cond, msg) {
  checks.push({ pass: !!cond, msg });
  console.log(`${cond ? "  \u2713" : "  \u2717"} ${msg}`);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Returns { videoDecoder, h264ConfigSupported }. */
function probeWebCodecs() {
  return (async () => {
    if (!("VideoDecoder" in globalThis)) return { videoDecoder: false, h264ConfigSupported: false };
    try {
      const support = await VideoDecoder.isConfigSupported({
        codec: "avc1.64001f",
        codedWidth: 128,
        codedHeight: 128,
      });
      return { videoDecoder: true, h264ConfigSupported: !!support.supported };
    } catch (e) {
      return { videoDecoder: true, h264ConfigSupported: false, error: String(e) };
    }
  })();
}

async function launchWithH264() {
  const attempts = [
    { label: "bundled chromium", options: {} },
    { label: "chrome channel", options: { channel: "chrome" } },
    { label: "msedge channel", options: { channel: "msedge" } },
  ];
  for (const attempt of attempts) {
    let browser;
    try {
      browser = await pw.chromium.launch({ headless: true, ...attempt.options });
    } catch {
      continue;
    }
    const page = await browser.newPage();
    let probe;
    try {
      // WebCodecs needs a secure context: 127.0.0.1 qualifies, about:blank does not.
      await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30_000 });
      probe = await page.evaluate(probeWebCodecs);
    } catch (e) {
      probe = { videoDecoder: false, h264ConfigSupported: false, error: String(e) };
    }
    await page.close();
    if (probe.h264ConfigSupported) return { browser, attempt: attempt.label, probe };
    console.log(`  (probe failed on ${attempt.label}: ${JSON.stringify(probe)})`);
    await browser.close();
  }
  return null;
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE,
    fixture: path.basename(FIXTURE),
    fixtureBytes: fs.statSync(FIXTURE).size,
    altFixture: path.basename(ALT_FIXTURE),
    checks: [],
    network: {},
    security: {},
    flow: {},
    comparison: null,
    exportedReports: [],
    download: null,
    downloadComparison: null,
    websockets: [],
    consoleErrors: [],
    pageErrors: [],
    screenshots: [],
  };

  console.log("=== e2e: launch ===");
  const launched = await launchWithH264();
  check(!!launched, "Chromium with H.264 WebCodecs support available");
  if (!launched) {
    report.failReason = "no chromium with H.264 support";
    finish(report);
    return;
  }
  report.browser = launched.attempt;
  report.webCodecsProbe = launched.probe;
  const browser = launched.browser;

  const context = await browser.newContext();
  const page = await context.newPage();

  // In-page network instrumentation: fetch/XHR/beacon recording survives
  // anything the page does; WebSocket construction is caught page-side too.
  await context.addInitScript(() => {
    const rec = { fetch: [], xhr: [], beacons: [], ws: [] };
    window.__net = rec;
    const resolve = (u) => {
      try {
        return new URL(String(u), location.href).href;
      } catch {
        return String(u);
      }
    };
    const origFetch = window.fetch;
    if (typeof origFetch === "function") {
      window.fetch = function (input, init) {
        try {
          const url = input && typeof input === "object" && "url" in input ? input.url : input;
          const method =
            (init && init.method) ||
            (input && typeof input === "object" && input.method) ||
            "GET";
          rec.fetch.push({ url: resolve(url), method: String(method).toUpperCase() });
        } catch {}
        return origFetch.apply(this, arguments);
      };
    }
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__netMethod = method;
      this.__netUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      try {
        rec.xhr.push({
          method: String(this.__netMethod || "GET").toUpperCase(),
          url: resolve(this.__netUrl),
        });
      } catch {}
      return origSend.apply(this, arguments);
    };
    if (navigator.sendBeacon) {
      const origBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        try {
          rec.beacons.push({ url: resolve(url) });
        } catch {}
        return origBeacon(url, data);
      };
    }
    const OrigWS = window.WebSocket;
    if (typeof OrigWS === "function") {
      window.WebSocket = new Proxy(OrigWS, {
        construct(target, args) {
          try {
            rec.ws.push({ url: String(args[0]) });
          } catch {}
          return new target(...args);
        },
      });
    }
  });

  const requests = [];
  page.on("request", (r) => {
    requests.push({ method: r.method(), url: r.url(), resourceType: r.resourceType() });
  });
  page.on("websocket", (ws) => {
    report.websockets.push(ws.url());
  });
  page.on("console", (m) => {
    if (m.type() === "error") report.consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => report.pageErrors.push(String(e).slice(0, 300)));

  console.log("=== e2e: load + drop file ===");
  await page.goto(BASE, { waitUntil: "load" });

  // --- security headers ---------------------------------------------------
  const headResp = await page.request.get(BASE + "/");
  const head = headResp.headers();
  report.security = {
    csp: head["content-security-policy"] || null,
    xFrameOptions: head["x-frame-options"] || null,
    nosniff: head["x-content-type-options"] || null,
    referrerPolicy: head["referrer-policy"] || null,
    permissionsPolicy: head["permissions-policy"] || null,
    poweredBy: head["x-powered-by"] || null,
    status: headResp.status(),
  };
  check(
    !!report.security.csp && report.security.csp.includes("frame-ancestors 'none'"),
    "CSP header served (frame-ancestors 'none')",
  );
  check(
    !!report.security.csp &&
      report.security.csp.includes("connect-src 'self'") &&
      report.security.csp.includes("img-src 'self' blob:"),
    "CSP restricts connect/img to self+blob+data",
  );
  check(
    !!report.security.csp && report.security.csp.includes("script-src 'self'"),
    "CSP script-src limited to self (+inline for Next runtime)",
  );
  check(!report.security.poweredBy, "X-Powered-By header removed");
  check(report.security.nosniff === "nosniff", "X-Content-Type-Options: nosniff");
  check(report.security.xFrameOptions === "DENY", "X-Frame-Options: DENY");

  await page.setInputFiles('input[type="file"]', FIXTURE);

  // --- inspect phase: file info card appears ------------------------------
  const prepareBtn = page.getByRole("button", { name: /prepare my video/i });
  await prepareBtn.waitFor({ state: "visible", timeout: 120_000 });
  report.flow.inspectDone = true;
  await page.screenshot({ path: path.join(SHOTS, "e2e-ready.png"), fullPage: true });
  report.screenshots.push("e2e-ready.png");

  const bodyText = await page.locator("body").innerText();
  fs.writeFileSync(path.join(SHOTS, "e2e-ready.dom.txt"), bodyText);
  const decodedTile = await page
    .locator("div", { hasText: /^Decoded frames/ })
    .first()
    .innerText()
    .catch(() => "");
  report.flow.infoCard = {
    decodedFramesRow: /Decoded frames/i.test(bodyText),
    decodedTile: decodedTile.slice(0, 200),
    decodeMode: /Full decode/i.test(bodyText)
      ? "full"
      : /Sampled decode/i.test(bodyText)
        ? "sampled"
        : /Not available/i.test(bodyText)
          ? "unavailable"
          : "unknown",
    crossCheckAgree: /Independent parser agrees/i.test(bodyText),
    crossCheckConflict: /CONFLICT/i.test(bodyText),
    methodSection: /Method/i.test(bodyText),
    methodGhostFrame: /ghost/i.test(bodyText),
    // Decoded-content analysis tiles (baseline decode evidence).
    contentBlackTile: /black frames\s*\d+\/\d+/i.test(bodyText),
    contentDuplicatesTile: /duplicate frames\s*\d+\/\d+/i.test(bodyText),
    contentClippedTile: /fully white frames\s*\d+\/\d+/i.test(bodyText),
    contentSharpnessTile: /sharpness avg\s*[\d.-]+/i.test(bodyText),
  };
  check(report.flow.infoCard.decodedFramesRow, "file info shows baseline decoded-frames evidence");
  check(
    report.flow.infoCard.decodeMode !== "unknown",
    `decode mode labelled (got "${report.flow.infoCard.decodeMode}")`,
  );
  check(
    report.flow.infoCard.crossCheckAgree && !report.flow.infoCard.crossCheckConflict,
    "input cross-check: independent parser agrees, no conflict",
  );
  check(report.flow.infoCard.methodSection, "method chooser section present");
  check(
    report.flow.infoCard.contentBlackTile && report.flow.infoCard.contentDuplicatesTile,
    "decoded-content tiles: black + duplicate frame counts shown",
  );
  check(
    report.flow.infoCard.contentClippedTile && report.flow.infoCard.contentSharpnessTile,
    "decoded-content tiles: fully-white + sharpness shown",
  );

  // --- patch + validate ---------------------------------------------------
  console.log("=== e2e: patch + three-gate validation ===");
  const t0 = Date.now();
  await prepareBtn.click();
  await sleep(1500);
  await page.screenshot({ path: path.join(SHOTS, "e2e-progress.png"), fullPage: true });
  report.screenshots.push("e2e-progress.png");

  const resultHeading = page.getByText(/your video is ready/i).first();
  let resultShown = true;
  try {
    await resultHeading.waitFor({ state: "visible", timeout: 300_000 });
  } catch {
    resultShown = false;
  }
  report.flow.resultShown = resultShown;
  report.flow.patchToResultMs = Date.now() - t0;
  check(resultShown, `result screen appeared (patch+validate ${report.flow.patchToResultMs} ms)`);

  await page.screenshot({ path: path.join(SHOTS, "e2e-result.png"), fullPage: true });
  report.screenshots.push("e2e-result.png");

  const resultText = await page.locator("body").innerText();
  fs.writeFileSync(path.join(SHOTS, "e2e-result.dom.txt"), resultText);
  report.flow.result = {
    statusLine: (
      resultText.match(
        /LOCALLY VERIFIED|VALIDATION FAILED|Verification failed:[^\n]*|Unable to verify[^\n]*/,
      ) || ["(none)"]
    )[0],
    statusVerified: /LOCALLY VERIFIED/i.test(resultText),
    statusFailed: /VALIDATION FAILED/i.test(resultText),
    integrityFailed: /Verification failed/i.test(resultText),
    integrityUnverified: /Unable to verify/i.test(resultText),
    gateStructural: /Structurally valid/i.test(resultText),
    gatePayload: /Media preserved/i.test(resultText),
    gateDecoded: /Decoded frames verified/i.test(resultText),
    gateAudio: /Audio preserved/i.test(resultText),
    sectionSource: /Source/i.test(resultText),
    sectionMethod: /Method/i.test(resultText),
    sectionValidation: /Validation/i.test(resultText),
    tiktokDisclaimer: /Not tested on TikTok/i.test(resultText),
    checkedInMs: (resultText.match(/Checked in ([\d,]+) ms/i) || [])[1] || null,
    integrityVerified: /source file verified/i.test(resultText),
  };
  check(report.flow.result.statusVerified, "status: LOCALLY VERIFIED");
  check(!report.flow.result.statusFailed, "status: no VALIDATION FAILED marker");
  check(
    report.flow.result.gateStructural &&
      report.flow.result.gatePayload &&
      report.flow.result.gateDecoded &&
      report.flow.result.gateAudio,
    "all four gates shown as passed (structural / payload / decoded / audio)",
  );
  check(
    report.flow.result.sectionSource && report.flow.result.sectionMethod && report.flow.result.sectionValidation,
    "result has SOURCE / METHOD / VALIDATION sections",
  );
  // Per-gate: each gate row exists and carries no "Failed" badge.
  for (const [key, label] of [
    ["structural", "Structurally valid"],
    ["payload", "Media preserved"],
    ["decoded", "Decoded frames verified"],
    ["audio", "Audio preserved"],
  ]) {
    const row = page.locator("li", { hasText: label }).first();
    const rowText = await row.innerText().catch(() => "");
    report.flow.result[`gateRow_${key}`] = rowText.replace(/\n/g, " | ").slice(0, 220);
    check(
      rowText.includes(label) && !/\bFailed\b/i.test(rowText),
      `gate row "${label}" present with no Failed badge`,
    );
  }
  check(
    report.flow.result.integrityFailed || report.flow.result.integrityUnverified
      ? true
      : report.flow.result.integrityVerified,
    `integrity outcome recorded: ${
      report.flow.result.integrityFailed
        ? "failed"
        : report.flow.result.integrityUnverified
          ? "unverified"
          : "verified"
    } (status line: ${report.flow.result.statusLine})`,
  );
  check(report.flow.result.tiktokDisclaimer, "always-visible 'Not tested on TikTok' disclaimer");
  check(report.flow.result.integrityVerified, "source-integrity check shows verified");
  check(
    report.flow.result.checkedInMs !== null,
    `validation total reported (${report.flow.result.checkedInMs} ms)`,
  );
  // Gate 3 evidence: decoded-frame gate passed WITH a measured duration > 0
  // means WebCodecs actually ran in this browser.
  check(
    report.flow.result.gateDecoded && Number(String(report.flow.result.checkedInMs).replace(/,/g, "")) > 0,
    "gate 3 executed in-browser (WebCodecs decode ran)",
  );

  // --- download -----------------------------------------------------------
  console.log("=== e2e: download ===");
  const downloadBtn = page.getByRole("link", { name: /download my video/i });
  const downloadVisible = await downloadBtn.isVisible().catch(() => false);
  check(downloadVisible, "download link enabled after all gates passed");
  if (downloadVisible) {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      downloadBtn.click(),
    ]);
    const savedTo = path.join(SHOTS, "downloaded-output.mp4");
    await download.saveAs(savedTo);
    const bytes = fs.readFileSync(savedTo);
    report.download = {
      suggestedFilename: download.suggestedFilename(),
      savedAs: path.basename(savedTo),
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    };
    check(bytes.length > 10_000, `downloaded file saved (${bytes.length} bytes)`);
    check(
      bytes.length !== report.fixtureBytes,
      `downloaded size differs from source (patched layout)`,
    );
  }

  // --- sha256 worker offload (browser path) --------------------------------
  const shaWorkerUsed = await page.evaluate(() =>
    Boolean(window.__toolt_sha_worker_used),
  );
  report.shaWorkerUsed = shaWorkerUsed;
  check(
    shaWorkerUsed,
    "sha256 hashing ran in the Web Worker (worker path, not main-thread fallback)",
  );

  // --- JSON report export --------------------------------------------------
  console.log("=== e2e: JSON report export ===");
  const exportBtn = page.getByRole("button", { name: /download report \(json\)/i });
  const exportVisible = await exportBtn.isVisible().catch(() => false);
  check(exportVisible, "'Download report (JSON)' button on result screen");
  if (exportVisible) {
    const [reportDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      exportBtn.click(),
    ]);
    const reportPath = path.join(SHOTS, "exported-report.json");
    await reportDownload.saveAs(reportPath);
    let rep = null;
    try {
      rep = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    } catch (e) {
      rep = null;
      report.exportedReports.push({ parseError: String(e) });
    }
    if (rep) {
      report.exportedReports.push({
        savedAs: path.basename(reportPath),
        suggestedFilename: reportDownload.suggestedFilename(),
        schema: rep.schema,
        methodId: rep.method && rep.method.id,
        validationPass: rep.validation && rep.validation.pass,
        outputSha256: rep.output && rep.output.sha256,
        sourceSha256: rep.source && rep.source.sha256,
        hasComparison: Array.isArray(rep.comparison),
        evidenceLocalTestStatus:
          rep.method && rep.method.evidence ? rep.method.evidence.localTestStatus : null,
      });
    }
    check(!!rep && rep.schema === "toolt-preparation-report/1", "report schema is toolt-preparation-report/1");
    check(!!rep && rep.validation && rep.validation.pass === true, "report records validation.pass = true");
    check(
      !!rep && !!rep.output && !!rep.output.sha256 && !!report.download &&
        rep.output.sha256 === report.download.sha256,
      "report output.sha256 equals SHA-256 of the downloaded file",
    );
    check(
      !!rep && !!rep.source && rep.source.sha256 !== null && rep.source.sha256Scope === "source-file-identity",
      "report records source sha256 with file-identity scope",
    );
    check(
      !!rep && !!rep.method && !!rep.method.evidence && typeof rep.method.evidence.localTestStatus === "string",
      "report embeds the method evidence entry verbatim",
    );
  }

  // --- multi-method comparison --------------------------------------------
  console.log("=== e2e: multi-method comparison ===");
  if (!fs.existsSync(ALT_FIXTURE)) {
    check(false, `comparison fixture exists (${path.basename(ALT_FIXTURE)})`);
  } else {
    const anotherBtn = page.getByRole("button", { name: /process another video/i });
    const anotherVisible = await anotherBtn.isVisible().catch(() => false);
    check(anotherVisible, "'Process another video' button present");
    if (anotherVisible) {
      await anotherBtn.click();
      // Retry the drop: the dropzone remounts on the phase transition.
      let dropped = false;
      for (let i = 0; i < 10 && !dropped; i++) {
        try {
          await page.setInputFiles('input[type="file"]', ALT_FIXTURE);
          dropped = true;
        } catch {
          await sleep(500);
        }
      }
      check(dropped, `comparison fixture dropped (${path.basename(ALT_FIXTURE)})`);

      const prepareBtn2 = page.getByRole("button", { name: /prepare my video/i });
      let ready2 = true;
      try {
        await prepareBtn2.waitFor({ state: "visible", timeout: 120_000 });
      } catch {
        ready2 = false;
      }
      check(ready2, "comparison fixture inspected to ready state");
      await page.screenshot({ path: path.join(SHOTS, "e2e-comparison-ready.png"), fullPage: true });
      report.screenshots.push("e2e-comparison-ready.png");

      const runAllBtn = page.getByRole("button", { name: /^run all methods$/i });
      const runAllVisible = ready2 && (await runAllBtn.isVisible().catch(() => false));
      check(runAllVisible, "'Run all methods' button visible");
      if (runAllVisible) {
        const tc0 = Date.now();
        await runAllBtn.click();

        const compTitle = page.getByText(/method comparison/i).first();
        let compShown = true;
        try {
          await compTitle.waitFor({ state: "visible", timeout: 60_000 });
        } catch {
          compShown = false;
        }
        check(compShown, "comparison table appears while methods run");
        await page.screenshot({ path: path.join(SHOTS, "e2e-comparison-running.png"), fullPage: true });
        report.screenshots.push("e2e-comparison-running.png");

        const hint = page.getByText(/select a result to review and download it/i).first();
        let compDone = true;
        try {
          await hint.waitFor({ state: "visible", timeout: 300_000 });
        } catch {
          compDone = false;
        }
        const comparisonMs = Date.now() - tc0;
        check(compDone, `comparison run finished (all methods terminal after ${comparisonMs} ms)`);
        await page.screenshot({ path: path.join(SHOTS, "e2e-comparison.png"), fullPage: true });
        report.screenshots.push("e2e-comparison.png");

        const rowLoc = page.locator("table tbody tr");
        const rowCount = await rowLoc.count();
        const rowTexts = [];
        for (let i = 0; i < rowCount; i++) {
          rowTexts.push((await rowLoc.nth(i).innerText()).replace(/\n/g, " | "));
        }
        report.comparison = { finished: compDone, ms: comparisonMs, rowCount, rows: rowTexts };
        fs.writeFileSync(
          path.join(SHOTS, "e2e-comparison.rows.txt"),
          rowTexts.map((r, i) => `row ${i}: ${r}`).join("\n"),
        );
        check(rowCount === 4, `comparison table has 4 method rows (got ${rowCount})`);
        check(
          rowTexts.length > 0 &&
            rowTexts.every((t) => /Passed|Failed|Not eligible|Skipped/.test(t)),
          "every method row reached a terminal status",
        );
        const passedRows = rowTexts.filter((t) => /Passed/.test(t));
        report.comparison.passedRows = passedRows.length;
        check(
          passedRows.length === 4,
          `all four methods passed all four gates in-browser (got ${passedRows.length}/4)`,
        );
        check(
          rowTexts.some((t) => /Timescale division/.test(t) && !/Not eligible/.test(t)),
          "timescale-divide row ran in-browser (fixture eligible)",
        );
        check(
          rowTexts.some((t) => /Edit-list/.test(t) && !/Not eligible/.test(t)),
          "edit-list row ran in-browser (fixture eligible)",
        );

        // Promote a passed row to the main result.
        const passedRow = page
          .locator("table tbody tr")
          .filter({ hasText: "Passed" })
          .first();
        const useBtn = passedRow.getByRole("button", { name: /use this result/i });
        const useVisible = (await passedRow.count()) > 0 && (await useBtn.isVisible().catch(() => false));
        check(useVisible, "'Use this result' available on a passed row");
        if (useVisible) {
          const promotedRowText = (await passedRow.innerText()).replace(/\n/g, " | ");
          report.comparison.promoted = promotedRowText;
          await useBtn.click();
          const resultHeading2 = page.getByText(/your video is ready/i).first();
          let result2 = true;
          try {
            await resultHeading2.waitFor({ state: "visible", timeout: 120_000 });
          } catch {
            result2 = false;
          }
          check(result2, "promoted comparison row opens the result screen");
          await page.screenshot({ path: path.join(SHOTS, "e2e-comparison-result.png"), fullPage: true });
          report.screenshots.push("e2e-comparison-result.png");

          const body2 = await page.locator("body").innerText();
          fs.writeFileSync(path.join(SHOTS, "e2e-comparison-result.dom.txt"), body2);
          const gates2 = {
            structural: /Structurally valid/i.test(body2),
            payload: /Media preserved/i.test(body2),
            decoded: /Decoded frames verified/i.test(body2),
            audio: /Audio preserved/i.test(body2),
            verified: /LOCALLY VERIFIED/i.test(body2),
            tiktokDisclaimer: /Not tested on TikTok/i.test(body2),
          };
          report.comparison.promotedGates = gates2;
          check(
            gates2.structural && gates2.payload && gates2.decoded && gates2.audio,
            "promoted result shows all four gate rows",
          );
          check(gates2.verified, "promoted result status: LOCALLY VERIFIED");
          check(gates2.tiktokDisclaimer, "promoted result keeps the TikTok disclaimer");

          // Export the promoted result's report (must embed the comparison).
          const exportBtn2 = page.getByRole("button", { name: /download report \(json\)/i });
          if (await exportBtn2.isVisible().catch(() => false)) {
            const [repDl2] = await Promise.all([
              page.waitForEvent("download", { timeout: 60_000 }),
              exportBtn2.click(),
            ]);
            const p2 = path.join(SHOTS, "exported-report-comparison.json");
            await repDl2.saveAs(p2);
            let rep2 = null;
            try {
              rep2 = JSON.parse(fs.readFileSync(p2, "utf8"));
            } catch {}
            report.exportedReports.push({
              savedAs: path.basename(p2),
              schema: rep2 && rep2.schema,
              methodId: rep2 && rep2.method && rep2.method.id,
              validationPass: rep2 && rep2.validation && rep2.validation.pass,
              outputSha256: rep2 && rep2.output && rep2.output.sha256,
              comparisonRows: rep2 && Array.isArray(rep2.comparison) ? rep2.comparison.length : null,
            });
            check(
              !!rep2 && rep2.schema === "toolt-preparation-report/1",
              "promoted report schema is toolt-preparation-report/1",
            );
            check(
              !!rep2 && Array.isArray(rep2.comparison) && rep2.comparison.length === 4,
              `promoted report embeds all 4 comparison rows (got ${
                rep2 && Array.isArray(rep2.comparison) ? rep2.comparison.length : "none"
              })`,
            );
            check(
              !!rep2 && !!rep2.validation && rep2.validation.pass === true,
              "promoted report records validation.pass = true",
            );

            // Download the promoted output; its bytes must match the report hash.
            const dlBtn2 = page.getByRole("link", { name: /download my video/i });
            if (await dlBtn2.isVisible().catch(() => false)) {
              const [dl2] = await Promise.all([
                page.waitForEvent("download", { timeout: 60_000 }),
                dlBtn2.click(),
              ]);
              const out2 = path.join(SHOTS, "downloaded-comparison-output.mp4");
              await dl2.saveAs(out2);
              const bytes2 = fs.readFileSync(out2);
              report.downloadComparison = {
                suggestedFilename: dl2.suggestedFilename(),
                savedAs: path.basename(out2),
                bytes: bytes2.length,
                sha256: crypto.createHash("sha256").update(bytes2).digest("hex"),
              };
              check(bytes2.length > 1_000, `promoted output downloaded (${bytes2.length} bytes)`);
              check(
                !!rep2 && !!rep2.output && rep2.output.sha256 === report.downloadComparison.sha256,
                "promoted report output.sha256 equals the downloaded bytes",
              );
            } else {
              check(false, "download link enabled for passed promoted row");
            }
          } else {
            check(false, "'Download report (JSON)' on promoted result screen");
          }
        }
      }
    }
  }

  // --- sha256 fallback: Worker unavailable (main-thread hashing) ----------
  // Fresh context with `Worker` removed: sha256File must fall back to the
  // main-thread implementation and still produce digests identical to
  // Node's crypto for the same bytes.
  console.log("=== e2e: sha256 worker fallback (Worker unavailable) ===");
  const fallback = {};
  report.shaFallback = fallback;
  const ctx2 = await browser.newContext({ acceptDownloads: true });
  await ctx2.addInitScript(() => {
    Object.defineProperty(window, "Worker", { value: undefined, configurable: true });
  });
  const page2 = await ctx2.newPage();
  const fallbackErrors = [];
  page2.on("console", (m) => {
    if (m.type() === "error") fallbackErrors.push(m.text().slice(0, 300));
  });
  page2.on("pageerror", (e) => fallbackErrors.push(String(e).slice(0, 300)));
  page2.on("websocket", (ws) => report.websockets.push(ws.url()));
  page2.on("request", (r) => {
    requests.push({ method: r.method(), url: r.url(), resourceType: r.resourceType() });
  });
  try {
    await page2.goto(BASE, { waitUntil: "load" });
    const workerGone = await page2.evaluate(() => typeof Worker === "undefined");
    check(workerGone, "fallback run: Worker unavailable in the page (init script)");

    await page2.setInputFiles('input[type="file"]', FIXTURE);
    const prep2 = page2.getByRole("button", { name: /prepare my video/i });
    await prep2.waitFor({ state: "visible", timeout: 120_000 });
    await prep2.click();
    const heading2 = page2.getByText(/your video is ready/i).first();
    let shown2 = true;
    try {
      await heading2.waitFor({ state: "visible", timeout: 300_000 });
    } catch {
      shown2 = false;
    }
    fallback.resultShown = shown2;
    check(shown2, "fallback flow: result screen appeared (Worker-free hashing)");

    const text2 = await page2.locator("body").innerText();
    fallback.statusVerified = /LOCALLY VERIFIED/i.test(text2);
    check(
      fallback.statusVerified,
      "fallback flow: LOCALLY VERIFIED with main-thread SHA-256",
    );

    const flag2 = await page2.evaluate(() => Boolean(window.__toolt_sha_worker_used));
    fallback.workerFlag = flag2;
    check(!flag2, "fallback flow: sha worker flag stays unset (main-thread path taken)");

    const dl2 = page2.getByRole("link", { name: /download my video/i });
    const dl2Visible = await dl2.isVisible().catch(() => false);
    check(dl2Visible, "fallback flow: download link enabled after gates passed");
    if (dl2Visible) {
      const [download2] = await Promise.all([
        page2.waitForEvent("download", { timeout: 60_000 }),
        dl2.click(),
      ]);
      const to2 = path.join(SHOTS, "downloaded-output-fallback.mp4");
      await download2.saveAs(to2);
      const b2 = fs.readFileSync(to2);
      fallback.download = {
        bytes: b2.length,
        sha256: crypto.createHash("sha256").update(b2).digest("hex"),
      };
      check(
        !!report.download && fallback.download.sha256 === report.download.sha256,
        "fallback output sha256 equals the worker-path output sha256 (same deterministic patch)",
      );
    }

    const exp2 = page2.getByRole("button", { name: /download report \(json\)/i });
    const exp2Visible = await exp2.isVisible().catch(() => false);
    check(exp2Visible, "fallback flow: report export button present");
    if (exp2Visible) {
      const [rd2] = await Promise.all([
        page2.waitForEvent("download", { timeout: 60_000 }),
        exp2.click(),
      ]);
      const rp2 = path.join(SHOTS, "exported-report-fallback.json");
      await rd2.saveAs(rp2);
      let rep2 = null;
      try {
        rep2 = JSON.parse(fs.readFileSync(rp2, "utf8"));
      } catch {
        rep2 = null;
      }
      const fixtureSha = crypto
        .createHash("sha256")
        .update(fs.readFileSync(FIXTURE))
        .digest("hex");
      fallback.report = rep2
        ? {
            schema: rep2.schema,
            sourceShaMatches: !!rep2.source && rep2.source.sha256 === fixtureSha,
            outputShaMatches:
              !!rep2.output &&
              !!fallback.download &&
              rep2.output.sha256 === fallback.download.sha256,
            validationPass: !!(rep2.validation && rep2.validation.pass),
          }
        : null;
      check(
        !!rep2 && rep2.schema === "toolt-preparation-report/1",
        "fallback report: schema toolt-preparation-report/1",
      );
      check(
        !!rep2 && !!rep2.source && rep2.source.sha256 === fixtureSha,
        "fallback report: source sha256 equals Node crypto of the fixture (main-thread digest correct)",
      );
      check(
        !!rep2 &&
          !!rep2.output &&
          !!fallback.download &&
          rep2.output.sha256 === fallback.download.sha256,
        "fallback report: output sha256 equals Node crypto of the downloaded bytes",
      );
    }

    fallback.errors = fallbackErrors;
    check(
      fallbackErrors.length === 0,
      `fallback flow: no console/page errors (got ${fallbackErrors.length})`,
    );
  } finally {
    await ctx2.close();
  }

  // --- network privacy ----------------------------------------------------
  const hosts = {};
  const external = [];
  const sameOrigin = [];
  for (const r of requests) {
    let host;
    try {
      host = new URL(r.url).host;
    } catch {
      host = "(bad-url)";
    }
    hosts[host] = (hosts[host] || 0) + 1;
    if (r.url.startsWith(BASE)) sameOrigin.push(r);
    else if (!r.url.startsWith("data:") && !r.url.startsWith("blob:")) external.push(r);
  }
  report.network = {
    totalRequests: requests.length,
    hosts,
    sameOriginRequests: sameOrigin.length,
    externalRequests: external.map((r) => ({ method: r.method, url: r.url })),
    outboundVideoUploadObserved: external.some((r) =>
      ["POST", "PUT", "PATCH"].includes(r.method),
    ),
    blobUrlObjectUrlsUsed: requests.some((r) => r.url.startsWith("blob:")),
    summary:
      external.length === 0
        ? `Outbound video upload observed: NO; all ${requests.length} requests went to 127.0.0.1:7789 during this run (observed behavior, not proof of absence of all network activity).`
        : `Outbound requests observed: ${external.length} (see externalRequests)`,
  };
  console.log(`  network: ${report.network.summary}`);
  check(external.length === 0, "no non-localhost requests observed during the run");
  check(
    !report.network.outboundVideoUploadObserved,
    "no outbound POST/PUT/PATCH observed",
  );

  // In-page instrumentation: beacons, WebSocket constructions, fetch/XHR.
  const net = await page
    .evaluate(() => window.__net || { fetch: [], xhr: [], beacons: [], ws: [] })
    .catch(() => ({ fetch: [], xhr: [], beacons: [], ws: [], evaluateFailed: true }));
  const localOrBlob = (u) =>
    u.startsWith(BASE) || u.startsWith("data:") || u.startsWith("blob:");
  const externalFetch = (net.fetch || []).filter((r) => !localOrBlob(r.url));
  const externalXhr = (net.xhr || []).filter((r) => !localOrBlob(r.url));
  report.network.instrumented = {
    fetchCalls: (net.fetch || []).length,
    xhrCalls: (net.xhr || []).length,
    beaconCalls: (net.beacons || []).length,
    wsConstructed: (net.ws || []).length,
    pageSideWebsockets: report.websockets,
    externalFetch: externalFetch.slice(0, 10),
    externalXhr: externalXhr.slice(0, 10),
    nonGetFetch: (net.fetch || []).filter((r) => r.method !== "GET").map((r) => ({ method: r.method, url: r.url })),
    nonGetXhr: (net.xhr || []).filter((r) => r.method !== "GET").map((r) => ({ method: r.method, url: r.url })),
    evaluateFailed: !!net.evaluateFailed,
  };
  check(!net.evaluateFailed, "in-page network instrumentation installed");
  check(
    (net.beacons || []).length === 0,
    `no sendBeacon calls during the whole session (got ${(net.beacons || []).length})`,
  );
  check(
    (net.ws || []).length === 0 && report.websockets.length === 0,
    `no WebSocket connections (page-side ${(net.ws || []).length}, playwright-side ${report.websockets.length})`,
  );
  check(
    externalFetch.length === 0 && externalXhr.length === 0,
    `no external fetch/XHR (fetch ${externalFetch.length}, xhr ${externalXhr.length})`,
  );
  check(
    report.network.instrumented.nonGetFetch.length === 0 &&
      report.network.instrumented.nonGetXhr.length === 0,
    "no non-GET fetch/XHR calls (nothing uploaded)",
  );

  finish(report, browser);
}

function finish(report, browser) {
  report.finishedAt = new Date().toISOString();
  report.checks = checks;
  report.passed = checks.every((c) => c.pass);
  report.failedChecks = checks.filter((c) => !c.pass).map((c) => c.msg);
  fs.writeFileSync(
    path.join(__dirname, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    `\n${checks.filter((c) => c.pass).length}/${checks.length} e2e checks passed; report: tests/e2e/report.json`,
  );
  Promise.resolve(browser).then((b) => b && b.close()).finally(() => {
    process.exit(report.passed ? 0 : 1);
  });
}

main().catch((e) => {
  console.error("e2e crashed:", e);
  checks.push({ pass: false, msg: `e2e crashed: ${e && e.message}` });
  finish({ crashed: String(e) });
});
