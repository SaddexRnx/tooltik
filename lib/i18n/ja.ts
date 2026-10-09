/**
 * Japanese UI strings. Type-checked against `en.ts`, so a missing or extra
 * translation key is a build error.
 */

import type { Dictionary } from "./en";

export const ja: Dictionary = {
  // header / chrome
  "meta.title": "ToolT | より高画質な TikTok アップロード、100% ブラウザ内で",
  "meta.description":
    "ブラウザだけで TikTok 用に動画を準備。アップロードなし、サーバーなし、トラッキングなし。",
  "brand.name": "ToolT",
  "nav.theme": "テーマ",
  "nav.theme.light": "ライト",
  "nav.theme.dark": "ダーク",
  "nav.theme.tint": "ダーク（色付き）",
  "nav.language": "言語を切り替え",
  "nav.devMode": "開発者向け詳細",
  "nav.devMode.show": "開発者向け詳細を表示",
  "nav.devMode.hide": "開発者向け詳細を隠す",

  "simple.videoSafe": "動画のピクセルはまったく変わりません。",
  "simple.checksDone": "ダウンロード前に自動検証済み。",

  // honesty banner
  "honesty.title": "正直な expectations",
  "honesty.body":
    "この方法は 100% 保証ではありません。TikTok はシステムを頻繁に更新するため、いつ動かなくなるかもしれません。",

  // hero
  "hero.title.before": "ワンドロップで",
  "hero.title.highlight": "高画質のまま",
  "hero.title.after": "TikTok にアップロード",
  "hero.subtitle":
    "動画をドロップすると、ディテールと滑らかさを保ったアップロード用ファイルが得られます。すべてブラウザ内で完結し、映像はどこにも送信されません。",
  "hero.badge.local": "100% プライベート",
  "hero.badge.noUpload": "アップロードゼロ",
  "hero.badge.noAccount": "ずっと無料",

  // dropzone
  "drop.title": "ここに動画をドロップ",
  "drop.subtitle": "または",
  "drop.browse": "ファイルを選ぶ",
  "drop.formats": "MP4 または MOV、H.264 (AVC)、最大 4 GB",
  "drop.selectAria": "準備する動画ファイルを選択",
  "drop.dragging": "離して動画を読み込む",

  // stepper
  "step.label": "準備の進行状況",
  "step.drop": "ドロップ",
  "step.inspect": "調査",
  "step.prepare": "準備",
  "step.download": "ダウンロード",

  // errors
  "error.title": "このファイルは処理できません",
  "error.retry": "別のファイルを試す",
  "error.not-video": "この種類の動画は受け付けません。MP4 か MOV ファイルを選んでください。",
  "error.no-moov": "この動画を読み込めませんでした。ファイルが壊れているか、未対応の形式の可能性があります。",
  "error.no-mdat": "このファイルは不完全または破損しているようです。",
  "error.no-video": "このファイルに映像トラックが見つかりません。",
  "error.unsupported-codec":
    "このファイルは {codec} を使用していますが、ここでは対応していません。H.264/MP4 で書き出してから再度お試しください。",
  "error.unsupported-boxes": "この種類の動画は受け付けません。",
  "error.fragmented":
    "この動画はストリーミング形式で保存されており、ここでは処理できません。まず通常の MP4 ファイルに変換してから再度お試しください。",
  "error.too-large": "4 GB 超のファイルはまだ対応していません。",
  "error.corrupt": "ファイルは破損しているか、途中で切れているようです。",
  "error.timescale-indivisible":
    "このファイルのフレームタイミングは正確に割り切れないため、この方法は適用できません。",
  "error.already-has-edit-list":
    "このファイルにはすでにエディットリストがあるため、この方法は適用できません。",
  "error.unknown": "問題が発生しました。元のファイルは変更されていません。",

  // file info
  "info.resolution": "解像度",
  "info.fps": "フレームレート",
  "info.duration": "長さ",
  "info.size": "ファイルサイズ",
  "info.videoCodec": "映像コーデック",
  "info.audioCodec": "音声コーデック",
  "info.audioNone": "音声なし",
  "info.fastStart": "アップロード構成",
  "info.fastStart.yes": "アップロード最適化済み",
  "info.fastStart.no": "最適化されます",
  "info.alreadyPatched": "この動画はすでに処理されています。元のファイルを処理してください。",
  "info.decoded": "デコード済みフレーム",
  "info.decoded.unavailable": "利用不可",
  "info.decoded.errors": "エラー",
  "info.decodeMode.full": "全フレームデコード",
  "info.decodeMode.sampled": "サンプリングデコード",
  "info.rotation": "回転",
  "info.crosscheck.agree": "独立パーサーもこのファイルの解析に同意しています",
  "info.crosscheck.conflict": "不一致：2 つのパーサーの解析結果が違います",
  "info.crosscheck.notrun": "このファイルでは独立パーサーによる検証はできません",

  // decoded-content analysis
  "quality.black": "黒いフレーム",
  "quality.duplicates": "重複フレーム",
  "quality.clipped": "真っ白なフレーム",
  "quality.sharpness": "平均シャープネス",

  // method chooser
  "method.title": "方式",
  "method.containerOnly": "コンテナのみ書き換え",
  "method.reencode": "メディアを再エンコード",
  "method.videoUntouched": "映像に触れない",
  "method.audioUntouched": "音声に触れない",
  "method.reencodesVideo": "映像を再エンコード",
  "method.reencodesAudio": "音声を再エンコード",
  "method.videoLabel": "映像",
  "method.audioLabel": "音声",
  "method.evidence": "根拠：結果 {outcome}、仕組み {mechanism}",
  "flag.yes": "はい",
  "flag.no": "いいえ",
  "flag.failed": "失敗",

  // method eligibility + classification
  "method.eligible": "このファイルに利用可能",
  "method.notEligible": "このファイルには利用不可",
  "method.cannotRun": "この方式はこのファイルに適用できません",
  "method.runAll": "全方式を実行",
  "method.changesTiming": "フレームタイミングを変更",
  "method.changesMetadata": "メタデータを変更",
  "method.reason.codec-not-avc": "H.264/AVC 動画が必要",
  "method.reason.fps-unsupported": "60fps か 120fps の動画が必要",
  "method.reason.timescale-indivisible": "このファイルのフレームタイミングは正確に割り切れません",
  "method.reason.already-has-edit-list": "このファイルにはすでにエディットリストがあります",
  "method.reason.unsupported": "このファイルでは未対応",
  "method.reason.eligibility-error": "このファイルに対するこの方式の判定ができませんでした",
  "method.reason.cancelled": "この方式の実行前に停止されました",
  "info.fragmentedNormalized":
    "ソースはフラグメントで記録されていたため、分析の前に通常の MP4 に正規化されました。",

  // method comparison
  "compare.title": "方式の比較",
  "compare.desc":
    "各方式は元のファイルから独立して実行されました。結果はローカル検証のみです。",
  "compare.running": "方式を実行中…",
  "compare.cancel": "キャンセル",
  "compare.stage.queued": "待機中",
  "compare.stage.patching": "準備中…",
  "compare.stage.structural": "構造チェック…",
  "compare.stage.payload": "ペイロードチェック…",
  "compare.stage.audio": "音声チェック…",
  "compare.stage.decoded": "フレームデコード…",
  "compare.stage.done": "完了",
  "compare.status.passed": "合格",
  "compare.status.failed": "不合格",
  "compare.status.unsupported": "対象外",
  "compare.status.skipped": "スキップ",
  "compare.col.status": "状態",
  "compare.col.patch": "処理時間",
  "compare.col.structural": "構造",
  "compare.col.payload": "ペイロード",
  "compare.col.frames": "フレーム",
  "compare.col.audio": "音声",
  "compare.col.overall": "総合",
  "compare.use": "この結果を使う",
  "compare.selectHint": "結果を選ぶと確認とダウンロードができます。",
  "compare.noOutput": "確認できる結果がありません",
  "result.timingWarning":
    "この方式は宣言されるフレームタイミングを変更します。ローカルプレーヤーでは元の動画と見え方が異なることがあります。",
  "result.localOnly": "ローカル検証のみ。TikTok での実テストは行っていません。",
  "action.exportReport": "レポートをダウンロード (JSON)",

  // quality report
  "report.title": "品質チェック",
  "report.chip.video": "映像 {value}",
  "report.chip.audio": "音声 {value}",
  "report.finding.ok": "指摘事項なし",
  "report.finding.vfr": "不均一なフレームタイミングを検出",
  "report.finding.metadata": "録画日時や余分なタグがあります。準備時に削除されます",
  "report.finding.bitrate-high": "ビットレートが非常に高い（{value}）。TikTok はいずれにせよ圧縮します",
  "report.finding.bitrate-low": "この解像度に対してビットレートが低い（{value}）",
  "report.finding.resolution": "1080p 超。TikTok が縮小します",
  "report.finding.bitdepth": "{value} 色。TikTok では 8 ビットに変換されます",
  "report.finding.audio-low": "音声ビットレートが低い（{value}）",
  "report.finding.gop": "キーフレーム間隔が広すぎます（{value} フレームごと）",

  // prepare options
  "options.title": "オプション",
  "option.scrub": "日付と余分なタグを削除",
  "option.scrub.desc": "録画日時や散在するメタデータを準備済みファイルから取り除きます。",
  "option.flatten": "一定のフレームタイミングを使う",
  "option.flatten.desc": "タイミングが不均一なときに推奨。アップロード後も再生が安定します。",

  // buttons
  "action.patch": "動画を準備する",
  "action.download": "動画をダウンロード",
  "action.downloadHint": "{name} として保存済み",
  "action.reset": "やり直す",
  "action.another": "別の動画を処理",

  // progress
  "progress.title": "動画を準備しています",
  "progress.stage.validate": "動画をチェック中…",
  "progress.stage.first-sample": "フレームを最適化中…",
  "progress.stage.audio": "音声を均している…",
  "progress.stage.metadata": "品質を調整中…",
  "progress.stage.assemble": "まとめています…",
  "progress.stage.done": "完了",
  "progress.validating.structural": "構造の整合性を確認中…",
  "progress.validating.payload": "メディアの保存を確認中…",
  "progress.validating.decoded": "デコード済みフレームを比較中…",
  "progress.validating.audio": "音声の保存を確認中…",
  "progress.validating.done": "検証完了",
  "progress.hint": "すべてこのデバイス上で行われます。何もアップロードされません。",

  // results
  "result.title": "動画の準備ができました",
  "result.subtitle": "滑らかさと明瞭さを保ったまま、TikTok へアップロードできます。",
  "result.stats": "概要",
  "result.stat.input": "元のサイズ",
  "result.stat.output": "処理後のサイズ",
  "result.stat.delta": "差分",
  "result.stat.duration": "長さ",
  "result.highlights": "得られるもの",
  "result.highlight.ready": "滑らかな 60 FPS アップロードに対応",
  "result.highlight.quality": "画質を保持、再エンコードなし",
  "result.highlight.fast": "より速いアップロード向けに最適化",
  "result.highlight.private": "あなたのデバイス上だけで処理",
  "result.integrity.verified": "ソースファイルを検証済み",
  "result.integrity.failed": "検証失敗：ソースファイルが変わりました。ダウンロードは無効です。",
  "result.integrity.unverified": "ソースファイルを検証できませんでした。ダウンロードは無効です。",
  "result.section.source": "ソース",
  "result.section.method": "方式",
  "result.section.validation": "検証",
  "result.source.resolution": "解像度",
  "result.source.duration": "長さ",
  "result.source.codec": "映像コーデック",
  "result.source.audio": "音声",
  "result.source.container": "コンテナ",
  "result.source.size": "ファイルサイズ",
  "result.gate.structural": "構造が有効",
  "result.gate.payload": "メディアが保持されている",
  "result.gate.decoded": "デコード済みフレームの検証済み",
  "result.gate.audio": "音声が保持されている",
  "result.validation.total": "{ms} ms でチェック",
  "result.status.verified": "ローカル検証済み",
  "result.status.failed": "検証失敗",
  "result.tiktok.notTested":
    "TikTok では未テスト。ローカル検証では、どのプラットフォームがこのファイルをどう処理するかは証明できません。",

  // upload guide
  "guide.title": "より良い結果のためのアップロード方法",
  "guide.eyebrow": "ステップバイステップ",
  "guide.step1.title": "パソコンのブラウザを使う",
  "guide.step1.body":
    "PC から Edge、Brave、Chrome でアップロードしてください。デスクトップからのアップロードはスマホよりはるかに画質を保てます。",
  "guide.step2.title": "TikTok Studio を開く",
  "guide.step2.body":
    "tiktok.com または TikTok Studio にアクセスし、処理済みファイルを PC からアップロードします。",
  "guide.step3.title": "スマホで確認",
  "guide.step3.body":
    "デスクトップのプレビューでは乱れて見えることがありますが、モバイルアプリでは通常どおり再生されます。",
  "guide.notice":
    "処理後でも TikTok は独自の圧縮を行います。結果は動画ごとに異なります。",

  // footer
  "footer.privacy":
    "プライバシー：動画は完全にブラウザ内で処理されます。サーバー、アップロード、解析、Cookie はありません。",
  "footer.disclaimer": "TikTok や ByteDance とは無関係です。自己責任でご利用ください。",
  "footer.noCopyright":
    "ToolT はフィンガープリント、知覚ハッシュ、著作権検出に関わる一切を変更しません。",

  // states
  "status.reading": "動画を読み込んでいます…",
};
