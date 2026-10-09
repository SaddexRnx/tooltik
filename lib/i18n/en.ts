/**
 * English UI strings. This file is the source of truth for translation keys:
 * `ar.ts` and `fr.ts` are type-checked against it, so a missing translation
 * is a build error.
 *
 * House rules: never mention internal mechanics in user-facing copy, and
 * never use em dashes in UI strings.
 */

export const en = {
  // header / chrome
  "meta.title": "ToolT | Higher-quality TikTok uploads, 100% in your browser",
  "meta.description":
    "Prepare your video for TikTok with better quality, entirely in your browser. No uploads, no servers, no tracking.",
  "brand.name": "ToolT",
  "nav.theme": "Theme",
  "nav.theme.light": "Light",
  "nav.theme.dark": "Dark",
  "nav.theme.tint": "Dark tinted",
  "nav.language": "Switch language",
  "nav.devMode": "Developer details",
  "nav.devMode.show": "Show developer details",
  "nav.devMode.hide": "Hide developer details",

  // simple-mode reassurance strips (shown when developer details are hidden)
  "simple.videoSafe": "Your video pixels stay exactly as they are.",
  "simple.checksDone": "Verified automatically before you download.",

  // honesty banner
  "honesty.title": "Honest expectations",
  "honesty.body":
    "This method is not 100% guaranteed. TikTok updates its systems often, and it may stop working at any time.",

  // hero
  "hero.title.before": "Upload to TikTok in",
  "hero.title.highlight": "higher quality",
  "hero.title.after": "with one drop",
  "hero.subtitle":
    "Drop a video, get back an upload that keeps its detail and smoothness. Everything happens right inside your browser, so your footage never travels anywhere.",
  "hero.badge.local": "100% private",
  "hero.badge.noUpload": "Zero uploads",
  "hero.badge.noAccount": "Free forever",

  // dropzone
  "drop.title": "Drop your video here",
  "drop.subtitle": "or",
  "drop.browse": "browse files",
  "drop.formats": "MP4 or MOV, H.264 (AVC), up to 4 GB",
  "drop.selectAria": "Select a video file to prepare",
  "drop.dragging": "Release to load your video",

  // stepper
  "step.label": "Preparation progress",
  "step.drop": "Drop",
  "step.inspect": "Inspect",
  "step.prepare": "Prepare",
  "step.download": "Download",

  // errors
  "error.title": "This file can't be processed",
  "error.retry": "Try another file",
  "error.not-video": "This type of video is not accepted. Please choose an MP4 or MOV file.",
  "error.no-moov": "We couldn't read this video. The file may be damaged or in an unsupported format.",
  "error.no-mdat": "This file looks incomplete or corrupted.",
  "error.no-video": "No video track found in this file.",
  "error.unsupported-codec":
    "This file uses {codec}, which is not supported here. Export it as H.264/MP4 and try again.",
  "error.unsupported-boxes": "This type of video is not accepted.",
  "error.fragmented":
    "This video was saved in a streaming format that can't be processed here. Convert it to a regular MP4 file first, then try again.",
  "error.too-large": "Files larger than 4 GB aren't supported yet.",
  "error.corrupt": "The file appears to be corrupted or truncated.",
  "error.timescale-indivisible":
    "This file's frame timing cannot be divided exactly, so this method does not apply.",
  "error.already-has-edit-list":
    "This file already contains an edit list, so this method does not apply.",
  "error.unknown": "Something went wrong. Your original file was not modified.",

  // file info
  "info.resolution": "Resolution",
  "info.fps": "Frame rate",
  "info.duration": "Duration",
  "info.size": "File size",
  "info.videoCodec": "Video codec",
  "info.audioCodec": "Audio codec",
  "info.audioNone": "No audio",
  "info.fastStart": "Upload layout",
  "info.fastStart.yes": "Optimized for upload",
  "info.fastStart.no": "Will be optimized",
  "info.alreadyPatched": "This video was already processed. Process your original file instead.",
  "info.decoded": "Decoded frames",
  "info.decoded.unavailable": "Not available",
  "info.decoded.errors": "errors",
  "info.decodeMode.full": "Full decode",
  "info.decodeMode.sampled": "Sampled decode",
  "info.rotation": "Rotation",
  "info.crosscheck.agree": "Independent parser agrees with our reading of this file",
  "info.crosscheck.conflict": "CONFLICT: the two parsers disagree about this file",
  "info.crosscheck.notrun": "Independent parser check not available for this file",

  // decoded-content analysis (baseline decode evidence)
  "quality.black": "Black frames",
  "quality.duplicates": "Duplicate frames",
  "quality.clipped": "Fully white frames",
  "quality.sharpness": "Sharpness avg",

  // method chooser
  "method.title": "Method",
  "method.containerOnly": "Container-only rewrite",
  "method.reencode": "Re-encodes media",
  "method.videoUntouched": "Video untouched",
  "method.audioUntouched": "Audio untouched",
  "method.reencodesVideo": "Video re-encoded",
  "method.reencodesAudio": "Audio re-encoded",
  "method.videoLabel": "Video",
  "method.audioLabel": "Audio",
  "method.evidence": "Evidence: outcome {outcome}, mechanism {mechanism}",
  "flag.yes": "Yes",
  "flag.no": "No",
  "flag.failed": "Failed",

  // method eligibility + classification
  "method.eligible": "Eligible for this file",
  "method.notEligible": "Not eligible for this file",
  "method.cannotRun": "This method does not apply to this file",
  "method.runAll": "Run all methods",
  "method.changesTiming": "Changes frame timing",
  "method.changesMetadata": "Changes metadata",
  "method.reason.codec-not-avc": "Requires H.264/AVC video",
  "method.reason.fps-unsupported": "Requires 60fps or 120fps video",
  "method.reason.timescale-indivisible": "Frame timing cannot be divided exactly in this file",
  "method.reason.already-has-edit-list": "This file already has an edit list",
  "method.reason.unsupported": "Not supported for this file",
  "method.reason.eligibility-error": "Could not check this method for this file",
  "method.reason.cancelled": "Stopped before this method ran",
  "info.fragmentedNormalized":
    "Source was streamed in fragments and was normalized to a regular MP4 before analysis.",

  // method comparison
  "compare.title": "Method comparison",
  "compare.desc":
    "Each method ran independently from your original file. Results are local validation only.",
  "compare.running": "Running methods…",
  "compare.cancel": "Cancel",
  "compare.stage.queued": "Queued",
  "compare.stage.patching": "Preparing…",
  "compare.stage.structural": "Structure check…",
  "compare.stage.payload": "Payload check…",
  "compare.stage.audio": "Audio check…",
  "compare.stage.decoded": "Frame decode…",
  "compare.stage.done": "Finished",
  "compare.status.passed": "Passed",
  "compare.status.failed": "Failed",
  "compare.status.unsupported": "Not eligible",
  "compare.status.skipped": "Skipped",
  "compare.col.status": "Status",
  "compare.col.patch": "Patch time",
  "compare.col.structural": "Structure",
  "compare.col.payload": "Payload",
  "compare.col.frames": "Frames",
  "compare.col.audio": "Audio",
  "compare.col.overall": "Overall",
  "compare.use": "Use this result",
  "compare.selectHint": "Select a result to review and download it.",
  "compare.noOutput": "No result to review",
  "result.timingWarning":
    "This method changes the declared frame timing; local players may show the video differently from the source.",
  "result.localOnly": "Local validation only. No live TikTok test has been performed.",
  "action.exportReport": "Download report (JSON)",

  // quality report
  "report.title": "Quality check",
  "report.chip.video": "Video {value}",
  "report.chip.audio": "Audio {value}",
  "report.finding.ok": "Nothing to flag",
  "report.finding.vfr": "Uneven frame timing detected",
  "report.finding.metadata": "Recording dates or extra tags found; removed when you prepare",
  "report.finding.bitrate-high": "Very high bitrate ({value}); TikTok will compress it anyway",
  "report.finding.bitrate-low": "Low bitrate ({value}) for this resolution",
  "report.finding.resolution": "Above 1080p; TikTok will downscale it",
  "report.finding.bitdepth": "{value} color; converted to 8-bit on TikTok",
  "report.finding.audio-low": "Audio bitrate is low ({value})",
  "report.finding.gop": "Keyframes are far apart (every {value} frames)",

  // prepare options
  "options.title": "Options",
  "option.scrub": "Remove dates & extra tags",
  "option.scrub.desc": "Recording dates and stray metadata are stripped from the prepared file.",
  "option.flatten": "Use constant frame timing",
  "option.flatten.desc": "Recommended when timing is uneven; keeps playback steady after upload.",

  // buttons
  "action.patch": "Prepare my video",
  "action.download": "Download my video",
  "action.downloadHint": "Saved as {name}",
  "action.reset": "Start over",
  "action.another": "Process another video",

  // progress
  "progress.title": "Preparing your video",
  "progress.stage.validate": "Checking your video…",
  "progress.stage.first-sample": "Optimizing frames…",
  "progress.stage.audio": "Balancing audio…",
  "progress.stage.metadata": "Tuning quality…",
  "progress.stage.assemble": "Packing everything up…",
  "progress.stage.done": "Done",
  "progress.validating.structural": "Checking structural integrity…",
  "progress.validating.payload": "Checking media preservation…",
  "progress.validating.decoded": "Comparing decoded frames…",
  "progress.validating.audio": "Checking audio preservation…",
  "progress.validating.done": "Validation complete",
  "progress.hint": "Everything happens on this device. Nothing is uploaded.",

  // results
  "result.title": "Your video is ready",
  "result.subtitle": "Smoothness and clarity preserved, ready for TikTok.",
  "result.stats": "Summary",
  "result.stat.input": "Original size",
  "result.stat.output": "Processed size",
  "result.stat.delta": "Difference",
  "result.stat.duration": "Duration",
  "result.highlights": "What you get",
  "result.highlight.ready": "Ready for smooth 60 FPS uploads",
  "result.highlight.quality": "Quality preserved, nothing re-encoded",
  "result.highlight.fast": "Optimized for faster uploading",
  "result.highlight.private": "Processed only on your device",
  "result.integrity.verified": "Source file verified",
  "result.integrity.failed": "Verification failed: the source file changed. Download is disabled.",
  "result.integrity.unverified": "Unable to verify the source file. Download is disabled.",
  "result.section.source": "Source",
  "result.section.method": "Method",
  "result.section.validation": "Validation",
  "result.source.resolution": "Resolution",
  "result.source.duration": "Duration",
  "result.source.codec": "Video codec",
  "result.source.audio": "Audio",
  "result.source.container": "Container",
  "result.source.size": "File size",
  "result.gate.structural": "Structurally valid",
  "result.gate.payload": "Media preserved",
  "result.gate.decoded": "Decoded frames verified",
  "result.gate.audio": "Audio preserved",
  "result.validation.total": "Checked in {ms} ms",
  "result.status.verified": "LOCALLY VERIFIED",
  "result.status.failed": "VALIDATION FAILED",
  "result.tiktok.notTested":
    "Not tested on TikTok. Local checks cannot prove how any platform will process this file.",

  // upload guide
  "guide.title": "How to upload for best results",
  "guide.eyebrow": "Step by step",
  "guide.step1.title": "Use a computer browser",
  "guide.step1.body":
    "Upload from a PC using Edge, Brave, or Chrome. Desktop uploads preserve quality far better than phone uploads.",
  "guide.step2.title": "Open TikTok Studio",
  "guide.step2.body":
    "Go to tiktok.com or TikTok Studio and upload the processed file from your computer.",
  "guide.step3.title": "Check on your phone",
  "guide.step3.body":
    "The video may look glitchy in the desktop preview but usually plays normally in the mobile app.",
  "guide.notice":
    "Even after processing, TikTok still applies its own compression. Results vary from video to video.",

  // footer
  "footer.privacy":
    "Privacy: videos are processed entirely in your browser. There are no servers, no uploads, no analytics, and no cookies.",
  "footer.disclaimer": "Not affiliated with TikTok or ByteDance. Use at your own risk.",
  "footer.noCopyright":
    "ToolT does not modify fingerprints, perceptual hashes, or anything related to copyright detection.",

  // states
  "status.reading": "Reading your video…",
} as const;

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;
