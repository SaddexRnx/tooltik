/**
 * Simplified Chinese UI strings. Type-checked against `en.ts`, so a missing
 * or extra translation key is a build error.
 */

import type { Dictionary } from "./en";

export const zh: Dictionary = {
  // header / chrome
  "meta.title": "ToolT | 更高质量的 TikTok 上传，100% 在你的浏览器中",
  "meta.description":
    "在你的浏览器中为 TikTok 准备更高质量的视频。不上传、无服务器、无追踪。",
  "brand.name": "ToolT",
  "nav.theme": "主题",
  "nav.theme.light": "浅色",
  "nav.theme.dark": "深色",
  "nav.theme.tint": "深色彩色",
  "nav.language": "切换语言",
  "nav.devMode": "开发者详情",
  "nav.devMode.show": "显示开发者详情",
  "nav.devMode.hide": "隐藏开发者详情",

  "simple.videoSafe": "视频的像素保持完全不变。",
  "simple.checksDone": "下载前已自动验证。",

  // honesty banner
  "honesty.title": "诚实的预期",
  "honesty.body":
    "此方法并非 100% 保证有效。TikTok 经常更新其系统，随时可能失效。",

  // hero
  "hero.title.before": "以",
  "hero.title.highlight": "更高质量",
  "hero.title.after": "一键上传至 TikTok",
  "hero.subtitle":
    "拖入一个视频，得到保留细节与流畅度的上传版本。一切都在你的浏览器内完成，你的素材不会被发送到任何地方。",
  "hero.badge.local": "100% 隐私",
  "hero.badge.noUpload": "零上传",
  "hero.badge.noAccount": "永久免费",

  // dropzone
  "drop.title": "在此拖放你的视频",
  "drop.subtitle": "或",
  "drop.browse": "浏览文件",
  "drop.formats": "MP4 或 MOV，H.264 (AVC)，最大 4 GB",
  "drop.selectAria": "选择要准备的视频文件",
  "drop.dragging": "松开以加载你的视频",

  // stepper
  "step.label": "准备进度",
  "step.drop": "拖入",
  "step.inspect": "检查",
  "step.prepare": "准备",
  "step.download": "下载",

  // errors
  "error.title": "无法处理此文件",
  "error.retry": "换一个文件",
  "error.not-video": "不接受此类型的视频。请选择 MP4 或 MOV 文件。",
  "error.no-moov": "无法读取此视频。文件可能已损坏或格式不受支持。",
  "error.no-mdat": "此文件似乎不完整或已损坏。",
  "error.no-video": "在此文件中未找到视频轨道。",
  "error.unsupported-codec":
    "此文件使用 {codec}，此处不支持。请导出为 H.264/MP4 后重试。",
  "error.unsupported-boxes": "不接受此类型的视频。",
  "error.fragmented":
    "此视频以流式格式保存，无法在此处理。请先转换为普通 MP4 文件后再试。",
  "error.too-large": "暂不支持大于 4 GB 的文件。",
  "error.corrupt": "文件似乎已损坏或被截断。",
  "error.timescale-indivisible":
    "此文件的帧时序无法精确整除，因此该方法不适用。",
  "error.already-has-edit-list":
    "此文件已包含编辑列表，因此该方法不适用。",
  "error.unknown": "出现了问题。你的原始文件未被修改。",

  // file info
  "info.resolution": "分辨率",
  "info.fps": "帧率",
  "info.duration": "时长",
  "info.size": "文件大小",
  "info.videoCodec": "视频编码",
  "info.audioCodec": "音频编码",
  "info.audioNone": "无音频",
  "info.fastStart": "上传布局",
  "info.fastStart.yes": "已针对上传优化",
  "info.fastStart.no": "将会被优化",
  "info.alreadyPatched": "此视频已被处理过。请处理你的原始文件。",
  "info.decoded": "已解码帧",
  "info.decoded.unavailable": "不可用",
  "info.decoded.errors": "个错误",
  "info.decodeMode.full": "全量解码",
  "info.decodeMode.sampled": "抽样解码",
  "info.rotation": "旋转",
  "info.crosscheck.agree": "独立解析器与我们对文件的解读一致",
  "info.crosscheck.conflict": "冲突：两个解析器对此文件的解读不一致",
  "info.crosscheck.notrun": "此文件无法进行独立解析器检查",

  // decoded-content analysis
  "quality.black": "黑帧",
  "quality.duplicates": "重复帧",
  "quality.clipped": "全白帧",
  "quality.sharpness": "平均清晰度",

  // method chooser
  "method.title": "方法",
  "method.containerOnly": "仅容器重写",
  "method.reencode": "重新编码媒体",
  "method.videoUntouched": "视频未改动",
  "method.audioUntouched": "音频未改动",
  "method.reencodesVideo": "视频被重新编码",
  "method.reencodesAudio": "音频被重新编码",
  "method.videoLabel": "视频",
  "method.audioLabel": "音频",
  "method.evidence": "证据：结果 {outcome}，机制 {mechanism}",
  "flag.yes": "是",
  "flag.no": "否",
  "flag.failed": "失败",

  // method eligibility + classification
  "method.eligible": "适用于此文件",
  "method.notEligible": "不适用于此文件",
  "method.cannotRun": "该方法不适用于此文件",
  "method.runAll": "运行所有方法",
  "method.changesTiming": "改变帧时序",
  "method.changesMetadata": "改变元数据",
  "method.reason.codec-not-avc": "需要 H.264/AVC 视频",
  "method.reason.fps-unsupported": "需要 60fps 或 120fps 视频",
  "method.reason.timescale-indivisible": "此文件的帧时序无法精确整除",
  "method.reason.already-has-edit-list": "此文件已有编辑列表",
  "method.reason.unsupported": "此文件不支持",
  "method.reason.eligibility-error": "无法对此文件检查该方法",
  "method.reason.cancelled": "在此方法运行前已停止",
  "info.fragmentedNormalized":
    "来源以分片流式保存，在分析之前已规范化为普通 MP4。",

  // method comparison
  "compare.title": "方法对比",
  "compare.desc":
    "每种方法都从你的原始文件独立运行。结果仅是本地验证。",
  "compare.running": "正在运行方法…",
  "compare.cancel": "取消",
  "compare.stage.queued": "排队中",
  "compare.stage.patching": "准备中…",
  "compare.stage.structural": "结构检查…",
  "compare.stage.payload": "载荷检查…",
  "compare.stage.audio": "音频检查…",
  "compare.stage.decoded": "帧解码…",
  "compare.stage.done": "完成",
  "compare.status.passed": "通过",
  "compare.status.failed": "失败",
  "compare.status.unsupported": "不适用",
  "compare.status.skipped": "跳过",
  "compare.col.status": "状态",
  "compare.col.patch": "修补用时",
  "compare.col.structural": "结构",
  "compare.col.payload": "载荷",
  "compare.col.frames": "帧",
  "compare.col.audio": "音频",
  "compare.col.overall": "总体",
  "compare.use": "使用此结果",
  "compare.selectHint": "选择一个结果以查看并下载。",
  "compare.noOutput": "没有可查看的结果",
  "result.timingWarning":
    "此方法改变了声明的帧时序；本地播放器的显示可能与源不同。",
  "result.localOnly": "仅本地验证。未在任何 TikTok 上进行实测。",
  "action.exportReport": "下载报告 (JSON)",

  // quality report
  "report.title": "质量检查",
  "report.chip.video": "视频 {value}",
  "report.chip.audio": "音频 {value}",
  "report.finding.ok": "没有需要标记的内容",
  "report.finding.vfr": "检测到不均匀的帧时序",
  "report.finding.metadata": "找到录制日期或额外标签；准备时会移除",
  "report.finding.bitrate-high": "码率非常高（{value}）；TikTok 反正会压缩它",
  "report.finding.bitrate-low": "此分辨率下码率偏低（{value}）",
  "report.finding.resolution": "高于 1080p；TikTok 会缩小",
  "report.finding.bitdepth": "{value} 色深；在 TikTok 上会转换为 8 位",
  "report.finding.audio-low": "音频码率偏低（{value}）",
  "report.finding.gop": "关键帧间隔过远（每 {value} 帧一次）",

  // prepare options
  "options.title": "选项",
  "option.scrub": "移除日期和额外标签",
  "option.scrub.desc": "录制日期和零散元数据会从准备好的文件中移除。",
  "option.flatten": "使用恒定帧时序",
  "option.flatten.desc": "时序不均匀时推荐；上传后播放更平稳。",

  // buttons
  "action.patch": "准备我的视频",
  "action.download": "下载我的视频",
  "action.downloadHint": "已保存为 {name}",
  "action.reset": "重新开始",
  "action.another": "处理另一个视频",

  // progress
  "progress.title": "正在准备你的视频",
  "progress.stage.validate": "正在检查你的视频…",
  "progress.stage.first-sample": "正在优化帧…",
  "progress.stage.audio": "正在均衡音频…",
  "progress.stage.metadata": "正在调整质量…",
  "progress.stage.assemble": "正在打包…",
  "progress.stage.done": "完成",
  "progress.validating.structural": "正在检查结构完整性…",
  "progress.validating.payload": "正在检查媒体保留…",
  "progress.validating.decoded": "正在对比已解码帧…",
  "progress.validating.audio": "正在检查音频保留…",
  "progress.validating.done": "验证完成",
  "progress.hint": "一切都在此设备上完成。没有上传任何内容。",

  // results
  "result.title": "你的视频已就绪",
  "result.subtitle": "流畅度与清晰度已保留，可以为 TikTok 上传了。",
  "result.stats": "摘要",
  "result.stat.input": "原始大小",
  "result.stat.output": "处理后大小",
  "result.stat.delta": "差异",
  "result.stat.duration": "时长",
  "result.highlights": "你将获得",
  "result.highlight.ready": "为流畅的 60 FPS 上传做好准备",
  "result.highlight.quality": "质量已保留，零重编码",
  "result.highlight.fast": "已针对更快的上传进行优化",
  "result.highlight.private": "仅在你的设备上处理",
  "result.integrity.verified": "源文件已验证",
  "result.integrity.failed": "验证失败：源文件已改变。下载已禁用。",
  "result.integrity.unverified": "无法验证源文件。下载已禁用。",
  "result.section.source": "来源",
  "result.section.method": "方法",
  "result.section.validation": "验证",
  "result.source.resolution": "分辨率",
  "result.source.duration": "时长",
  "result.source.codec": "视频编码",
  "result.source.audio": "音频",
  "result.source.container": "容器",
  "result.source.size": "文件大小",
  "result.gate.structural": "结构有效",
  "result.gate.payload": "媒体已保留",
  "result.gate.decoded": "已解码帧验证通过",
  "result.gate.audio": "音频已保留",
  "result.validation.total": "{ms} ms 内完成检查",
  "result.status.verified": "本地已验证",
  "result.status.failed": "验证失败",
  "result.tiktok.notTested":
    "未在 TikTok 上实测。本地检查无法证明任何平台会如何处理此文件。",

  // upload guide
  "guide.title": "如何上传以获得最佳效果",
  "guide.eyebrow": "分步指南",
  "guide.step1.title": "使用电脑浏览器",
  "guide.step1.body":
    "使用电脑上的 Edge、Brave 或 Chrome 上传。桌面端上传对画质的保留远好于手机上传。",
  "guide.step2.title": "打开 TikTok Studio",
  "guide.step2.body":
    "前往 tiktok.com 或 TikTok Studio，从电脑上传处理后的文件。",
  "guide.step3.title": "在手机上查看",
  "guide.step3.body":
    "视频在桌面预览中可能有显示问题，但在手机 App 中通常可以正常播放。",
  "guide.notice":
    "即使经过处理，TikTok 仍会应用它自己的压缩。效果因视频而异。",

  // footer
  "footer.privacy":
    "隐私：视频完全在你的浏览器内处理。没有服务器、上传、分析或 Cookie。",
  "footer.disclaimer": "与 TikTok 或字节跳动无关联。请自行承担使用风险。",
  "footer.noCopyright":
    "ToolT 不会修改指纹、感知哈希或任何与版权检测相关的内容。",

  // states
  "status.reading": "正在读取你的视频…",
};
