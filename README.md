<div align="center">

# 🎬 ToolTik

### Upload to TikTok in higher quality - with one drop.

**100% in your browser. Zero uploads. Zero servers. Zero tracking.**

[![Tests](https://img.shields.io/badge/tests-840%2F840%20passing-brightgreen?style=flat-square)](#testing)
[![E2E](https://img.shields.io/badge/e2e-76%20checks%20passing-success?style=flat-square)](#testing)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-087ea4?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ff69b4?style=flat-square)](#contributing)

</div>

---

ToolTik prepares your video so TikTok keeps more of its detail and smoothness. Drop a file, get back an upload-optimized version - all computed locally in your browser. Your footage never leaves the device: no uploads, no servers, no accounts, no analytics, no cookies.

> [!WARNING]
> ### ⚠️ Honest expectations
> This method is **not 100% guaranteed**. TikTok updates its systems often, and it may stop working at any time. Results vary from video to video, and TikTok always applies its own compression on top. ToolTik improves *the input it receives* - it does not disable compression.

---

## ✨ Features

| | |
|---|---|
| 🎬 **Lossless** | Nothing is re-encoded. Media bytes stay byte-identical, verified per gate. |
| 🧰 **Four preparation methods** | Ghost frames, hygiene remux, timescale divide, edit-list signal - eligibility-checked per file, with a side-by-side comparison table. |
| ✅ **Four validation gates** | Structure, media payload, decoded frames (WebCodecs), audio. Download is enabled **only** when all four pass - fail closed, no exceptions. |
| 👤 **Two-level UI** | A simple view for everyday users, and a developer-details mode (`</>` in the header) that reveals every technical detail: gate timings, hashes, parser cross-checks. |
| 🌍 **9 languages** | English, Español, Português, Français, العربية (full RTL), हिन्दी, 中文, Русский, 日本語. Type-checked key parity, instant switching, persisted preference. |
| 🌗 **3 beautiful themes** | Warm cream light, soft slate-teal dark, and a plum-and-gold tinted dark - with a gentle drifting aurora ambient animation. Reduced-motion aware. |
| 📄 **JSON report export** | Source/output SHA-256, gate evidence, method comparison rows. |
| 🔒 **Private by architecture** | Fully offline-capable static site. Files are read and rewritten via `Blob` slices - pixels never enter JavaScript memory. |

---

## 🚀 Quick start

```bash
git clone https://github.com/SaddexRnx/tooltik.git
cd tooltik
npm install
npm run dev       # development on http://localhost:3000
```

Production:

```bash
npm run build     # type-checked production build
npm run start     # serve the production build
```

**Requirements:** Node ≥ 20, npm ≥ 10. No ffmpeg, no backend, no environment variables.

Other scripts:

```bash
npm run lint                  # ESLint
npm test                      # 840-check structural test suite
npx tsx tests/bench.ts        # measured benchmarks
node tests/e2e/run.cjs        # 76-check browser e2e (needs server on 127.0.0.1:7789)
npx tsx tests/make-fixtures.ts  # regenerate synthetic edge-case fixtures
```

---

## 🧪 Testing

ToolTik is validated with a fail-closed philosophy: **no passing evidence, no download button.**

- **840-check structural suite** (`tests/run.ts`) - runs the real browser-targeted library in Node against fixtures: full pipeline per engine, every invariant asserted, cross-checked against **MP4Box.js** as an independent parser, negative fixtures that must fail closed, SHA-256 against FIPS vectors, i18n key parity.
- **76-check browser e2e** (`tests/e2e/run.cjs`, Playwright + bundled Chromium) - the four gates in real WebCodecs, downloads + SHA-256 identity, report exports, full method-comparison flow, worker and main-thread hash paths, and network instrumentation (no external requests).
- **Benchmarks** (`tests/bench.ts`) - per-op / per-method / per-gate timings and RSS, reported only from the machine that measured them.

---

## 🏗️ Architecture

```
app/                    # Next.js App Router (static, client-rendered tool)
  layout.tsx            # fonts, metadata, providers
  page.tsx              # phase state machine + smart scroll follow
  globals.css           # oklch design tokens, 3 themes, aurora animation
components/             # dropzone, info/result/error cards, comparison table,
                        # theme/language/dev-mode toggles, stepper, hero…
hooks/
  use-patcher.ts        # orchestration: inspect→prepare→validate, progress,
                        # integrity hashes, object-URL lifecycle, cancellation
lib/
  i18n/                 # en.ts (source of truth) + 8 typed dictionaries
  dev-mode.ts           # simple/dev view split store
  format.ts             # bytes / duration / fps / bitrate helpers
  mp4/                  # ⇨ ZERO-DEPENDENCY ISOBMFF CORE
    boxes.ts            # parser, error codes, table readers
    inspect.ts          # fast header scan + moov-only inspection
    transform.ts        # container rewrite pipeline
  engines/              # the four PatchEngine implementations
  methods/              # per-file eligibility + multi-method runner
  validate/             # the four fail-closed gates
    structure.ts        # gate 1 (+ independent MP4Box cross-check)
    payload.ts          # gate 2 (byte-level sample comparison)
    decode.ts           # gate 3 (WebCodecs full decode, PSNR/SSIM)
    audio.ts            # gate 4
  integrity/            # SHA-256 (Web Worker, main-thread fallback)
  reports/              # JSON report schema + comparison rows
loaders/raw-string.cjs   # Turbopack `?raw` rule for the worker source
tests/                  # 840-check suite, benchmarks, fixture generator, e2e
```

**Key design decisions**

- **Never load the whole file.** `scanTopLevel()` reads 16-byte headers; only the metadata box is loaded. Output `Blob`s stream media ranges straight from the original `File` via `slice()`.
- **Never re-encode.** All four methods rewrite container tables only; media bytes stay byte-identical (verified per gate).
- **Four gates, fail closed.** No WebCodecs evidence means no download - not a warning.
- **Eligibility before execution.** Each engine declares what it supports (codec, fps divisibility, existing edit list); unsupported methods are skipped with a translated reason, never failed.
- **The MP4 core has zero dependencies.** Keep it that way.

---

## 🌍 Internationalization & theming

- `lib/i18n/en.ts` is the **source of truth**; every other dictionary is typed as `Dictionary`, so a missing or extra translation key fails the build.
- Arabic sets `<html lang="ar" dir="rtl">`, flips logical CSS properties, and swaps to Noto Sans Arabic.
- Language lives in `localStorage` via `useSyncExternalStore` (server always renders English - no hydration mismatches). First visit follows the browser language.
- Themes: **Light** (warm cream + teal), **Dark** (soft slate-teal), **Dark tinted** (plum + gold) - pure `oklch` tokens, monochrome-forward surfaces, drifting aurora ambience, all animations collapse under `prefers-reduced-motion`.
- **Developer details mode**: technical sections are hidden by default; the `</>` header toggle reveals everything. The choice persists per visitor.

---

## 📋 Limits & browser support

| | |
|---|---|
| **Codec** | H.264 (AVC) in MP4/MOV only. HEVC/`hvc1` inputs are detected and refused with the detected codec named in the message. |
| **Size** | Up to 4 GB (larger is rejected with a friendly error). |
| **Browser** | Full verification (and download) requires WebCodecs H.264 support. Chromium-based browsers are fully supported; in others the decoded gate fails closed by design. |
| **Memory** | Metadata box plus small overhead - typically a few dozen MB even for multi-GB files. Hashing runs in 8 MB slices inside a Web Worker. |

---

## 🔧 Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Video looks glitchy in the desktop preview | Expected. It usually plays normally in the mobile app. |
| Still compressed after upload | TikTok always compresses. The tool improves the input it receives - it does not disable compression. |
| *"already processed"* warning | Process your original file instead of an output file. |
| *"uses H.265 (HEVC)"* error | Export as H.264/MP4: `ffmpeg -i in.mov -c:v libx264 -c:a aac out.mp4` (or set Codec: H.264 in CapCut/Premiere/Resolve export). |
| Large file seems slow | Work is staged with cooperative yields; multi-GB files take a moment. Keep the tab focused. |

---

## 🤝 Contributing

PRs are welcome! House rules:

1. **Run `npm test && npm run build` before every PR** - both must pass.
2. New UI strings must be added to **all 9 dictionaries** (the build enforces it).
3. Keep the MP4 core dependency-free.
4. Keep the honesty banner honest - if behavior changes, say so in plain language.
5. Never add analytics, beacons, or server calls. Privacy is architectural, not policy.

---

## 🔐 Privacy, ethics & disclaimers

- **No video ever leaves the device.** All processing is local. The e2e suite instruments the page and observes zero outbound external requests.
- **No copyright circumvention features.** ToolTik does not touch fingerprints, perceptual hashes, or anything related to copyright detection.
- Not affiliated with TikTok or ByteDance. Use at your own risk.

---

## 📜 License

[MIT](LICENSE) © Saddek Renane

---

<div align="center">

**Made with ❤️ for creators who care about quality.**

⭐ Star this repo if it saved your upload quality!

</div>
