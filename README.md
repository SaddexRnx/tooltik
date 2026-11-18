# ToolTik

Prepare a video so TikTok keeps more of its detail, entirely in your browser. Drop a file, get back an upload-optimized version. Nothing is uploaded, there is no server, no account, and no analytics.

One thing to be upfront about: this is not guaranteed. TikTok changes its systems often and always applies its own compression on top. ToolTik improves the input you give it, it does not turn off TikTok's compression. Results vary from video to video.

## How it works

ToolTik rewrites the MP4 container without touching the actual video and audio bytes. It offers four preparation methods:

- **Ghost frames**
- **Hygiene remux**
- **Timescale divide**
- **Edit list signal**

Each method is checked for eligibility against your specific file (codec, frame rate, existing edit list), and ones that do not apply are skipped with a reason instead of failing.

Before a download is offered, the output goes through four validation gates:

1. Structure, cross-checked against MP4Box.js as an independent parser
2. Media payload, compared byte by byte against the source
3. Full decode through WebCodecs with PSNR and SSIM checks
4. Audio

If any gate fails, there is no download button. No warnings you can ignore, the download simply is not there.

## Quick start

```bash
git clone https://github.com/SaddexRnx/tooltik.git
cd tooltik
npm install
npm run dev
```

Development runs on http://localhost:3000. For production:

```bash
npm run build
npm run start
```

Requires Node 20+ and npm 10+. No ffmpeg, no backend, no environment variables.

Other scripts:

```bash
npm run lint
npm test                        # 840-check structural suite
npx tsx tests/bench.ts          # benchmarks
node tests/e2e/run.cjs          # 76-check browser e2e, needs a server on 127.0.0.1:7789
npx tsx tests/make-fixtures.ts  # regenerate test fixtures
```

## Testing

The rule is simple: no passing evidence, no download.

The 840-check structural suite runs the real browser-targeted library in Node against fixtures, asserts every invariant, cross-checks with MP4Box.js, includes negative fixtures that must fail closed, verifies SHA-256 against FIPS vectors, and checks translation key parity. The 76-check browser suite runs the four gates in real WebCodecs, checks downloads and hashes, and instruments the network to confirm zero external requests.

## Layout

```
app/                    Next.js App Router (static, client-rendered)
components/             dropzone, cards, comparison table, toggles
hooks/use-patcher.ts    orchestration and progress
lib/
  i18n/                 en.ts is the source of truth, 8 typed dictionaries
  mp4/                  zero-dependency ISOBMFF parser and transformer
  engines/              the four patch implementations
  methods/              eligibility and method runner
  validate/             the four fail-closed gates
  integrity/            SHA-256 in a Web Worker
  reports/              JSON report schema
tests/                  structural suite, benchmarks, fixtures, e2e
```

Design decisions worth knowing:

- The whole file is never loaded. `scanTopLevel()` reads 16 byte headers and only the metadata box is parsed. Output blobs stream from the original file with `slice()`.
- Nothing is re-encoded, so media bytes stay identical.
- The MP4 core has zero dependencies, and the project keeps it that way.
- Eligibility is checked before execution, so unsupported methods are skipped rather than failing.

## Languages and themes

Nine languages: English, Spanish, Portuguese, French, Arabic (full RTL), Hindi, Chinese, Russian, and Japanese. `en.ts` is the source of truth and the build fails if a dictionary is missing a key or has an extra one.

Three themes: warm cream light, slate-teal dark, and a plum and gold tinted dark. Animations respect `prefers-reduced-motion`. There is also a developer details mode, hidden by default and toggled from the header, that reveals gate timings, hashes, and parser cross-checks.

## Limits

- H.264 (AVC) in MP4 or MOV only. HEVC inputs are detected and refused with the codec named in the message.
- Up to 4 GB.
- Download requires WebCodecs H.264 support, so Chromium browsers are fully supported. Elsewhere the decode gate fails closed.
- Memory use is the metadata box plus a bit of overhead, usually a few dozen MB even for multi-GB files. Hashing runs in 8 MB slices in a worker.

## Troubleshooting

**Preview looks glitchy on desktop.** Usually fine in the mobile app.

**Still compressed after upload.** TikTok always compresses. See the note at the top.

**"Already processed" warning.** Start from your original file, not an output.

**"Uses H.265 (HEVC)" error.** Convert first: `ffmpeg -i in.mov -c:v libx264 -c:a aac out.mp4`, or set the codec to H.264 in your editor's export settings.

**Large files are slow.** Work is staged with cooperative yields. Keep the tab focused.

## Contributing

Pull requests are welcome. Run `npm test && npm run build` before opening one, add new strings to all nine dictionaries, keep the MP4 core dependency-free, and never add analytics or server calls.

## Privacy

No video leaves the device. The e2e suite instruments the page and sees zero outbound requests. There are no copyright circumvention features here, and the project is not affiliated with TikTok or ByteDance.

## License

MIT © Saddek Renane
