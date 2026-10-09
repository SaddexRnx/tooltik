/**
 * Arabic UI strings. Type-checked against `en.ts`: every English key must
 * exist here (and nothing extra), so translations can never drift silently.
 */

import type { Dictionary } from "./en";

export const ar: Dictionary = {
  // header / chrome
  "meta.title": "ToolT | جودة أعلى لرفع مقاطع تيك توك، 100% داخل متصفحك",
  "meta.description":
    "جهّز فيديوك لتيك توك بجودة أفضل، بالكامل داخل متصفحك. لا رفع ولا خوادم ولا تتبّع.",
  "brand.name": "ToolT",
  "nav.theme": "المظهر",
  "nav.theme.light": "فاتح",
  "nav.theme.dark": "داكن",
  "nav.theme.tint": "داكن مُظلّل",
  "nav.language": "تغيير اللغة",
  "nav.devMode": "تفاصيل المطور",
  "nav.devMode.show": "إظهار تفاصيل المطور",
  "nav.devMode.hide": "إخفاء تفاصيل المطور",

  "simple.videoSafe": "تظل وحدات البكسل في الفيديو كما هي تمامًا.",
  "simple.checksDone": "تم التحقق تلقائيًا قبل التنزيل.",

  // honesty banner
  "honesty.title": "توقعات صادقة",
  "honesty.body":
    "هذه الطريقة ليست مضمونة بنسبة 100%. يغيّر تيك توك أنظمه باستمرار وقد تتوقف عن العمل في أي وقت.",

  // hero
  "hero.title.before": "ارفع على تيك توك بجودة",
  "hero.title.highlight": "أعلى",
  "hero.title.after": "بسحبة واحدة",
  "hero.subtitle":
    "أفلت الفيديو واحصل على رفع يحتفاظ بتفاصيله ونعومته. كل شيء يحدث داخل متصفحك، فلا يسافر ملفك إلى أي مكان.",
  "hero.badge.local": "خصوصية 100%",
  "hero.badge.noUpload": "لا يوجد رفع",
  "hero.badge.noAccount": "مجاني للأبد",

  // dropzone
  "drop.title": "أسقط الفيديو هنا",
  "drop.subtitle": "أو",
  "drop.browse": "اختر ملفًا",
  "drop.formats": "MP4 أو MOV، ‏H.264 (AVC)، حتى 4 غيغابايت",
  "drop.selectAria": "اختر ملف فيديو للتحضير",
  "drop.dragging": "أفلت لإفلات الفيديو",

  // stepper
  "step.label": "تقدم التحضير",
  "step.drop": "الإفلات",
  "step.inspect": "الفحص",
  "step.prepare": "التحضير",
  "step.download": "التنزيل",

  // errors
  "error.title": "لا يمكن معالجة هذا الملف",
  "error.retry": "جرّب ملفًا آخر",
  "error.not-video": "نوع الفيديو هذا غير مقبول. اختر ملف MP4 أو MOV.",
  "error.no-moov": "تعذّرت قراءة هذا الفيديو. قد يكون الملف تالفًا أو بصيغة غير مدعومة.",
  "error.no-mdat": "يبدو هذا الملف غير مكتمل أو تالفًا.",
  "error.no-video": "لم يتم العثور على مسار فيديو داخل هذا الملف.",
  "error.unsupported-codec":
    "يستخدم هذا الملف {codec} وهو غير مدعوم هنا. صدّره بترميز H.264/MP4 ثم أعد المحاولة.",
  "error.unsupported-boxes": "نوع الفيديو هذا غير مقبول.",
  "error.fragmented":
    "تم حفظ هذا الفيديو بتنسيق بث لا يمكن معالجته هنا. حوّله أولاً إلى ملف MP4 عادي ثم أعد المحاولة.",
  "error.too-large": "الملفات الأكبر من 4 غيغابايت غير مدعومة حاليًا.",
  "error.corrupt": "يبدو أن الملف تالف أو مبتور.",
  "error.timescale-indivisible":
    "لا يمكن تقسيم توقيت إطارات هذا الفيديو بدقة، لذا لا تنطبق هذه الطريقة.",
  "error.already-has-edit-list":
    "يحتوي هذا الملف بالفعل على قائمة تحرير، لذا لا تنطبق هذه الطريقة.",
  "error.unknown": "حدث خطأ ما. لم يتم تعديل ملفك الأصلي.",

  // file info
  "info.resolution": "الدقة",
  "info.fps": "معدل الإطارات",
  "info.duration": "المدة",
  "info.size": "حجم الملف",
  "info.videoCodec": "ترميز الفيديو",
  "info.audioCodec": "ترميز الصوت",
  "info.audioNone": "بدون صوت",
  "info.fastStart": "تخطيط الرفع",
  "info.fastStart.yes": "مُحسّن للرفع",
  "info.fastStart.no": "سيتم تحسينه",
  "info.alreadyPatched": "تمت معالجة هذا الفيديو مسبقًا. عالج ملفك الأصلي بدلًا منه.",
  "info.decoded": "الإطارات المفكّكة",
  "info.decoded.unavailable": "غير متاح",
  "info.decoded.errors": "أخطاء",
  "info.decodeMode.full": "فك كامل",
  "info.decodeMode.sampled": "فك بالعينة",
  "info.rotation": "التدوير",
  "info.crosscheck.agree": "المحلّل المستقل يؤكد قراءتنا لهذا الملف",
  "info.crosscheck.conflict": "تعارض: المحلّلان يختلفان حول هذا الملف",
  "info.crosscheck.notrun": "فحص المحلّل المستقل غير متاح لهذا الملف",

  // decoded-content analysis (baseline decode evidence)
  "quality.black": "إطارات سوداء",
  "quality.duplicates": "إطارات مكررة",
  "quality.clipped": "إطارات بيضاء بالكامل",
  "quality.sharpness": "متوسط الحدة",

  // method chooser
  "method.title": "الطريقة",
  "method.containerOnly": "إعادة كتابة الحاوية فقط",
  "method.reencode": "يعيد ترميز الوسائط",
  "method.videoUntouched": "الفيديو لم يتغيّر",
  "method.audioUntouched": "الصوت لم يتغيّر",
  "method.reencodesVideo": "تم إعادة ترميز الفيديو",
  "method.reencodesAudio": "تم إعادة ترميز الصوت",
  "method.videoLabel": "الفيديو",
  "method.audioLabel": "الصوت",
  "method.evidence": "الأدلة: النتيجة {outcome}، الآلية {mechanism}",
  "flag.yes": "نعم",
  "flag.no": "لا",
  "flag.failed": "فشل",

  // method eligibility + classification
  "method.eligible": "ينطبق على هذا الملف",
  "method.notEligible": "لا ينطبق على هذا الملف",
  "method.cannotRun": "هذه الطريقة لا تنطبق على هذا الملف",
  "method.runAll": "تشغيل جميع الطرق",
  "method.changesTiming": "يغيّر توقيت الإطارات",
  "method.changesMetadata": "يغيّر البيانات الوصفية",
  "method.reason.codec-not-avc": "يتطلب فيديو H.264/AVC",
  "method.reason.fps-unsupported": "يتطلب فيديو بمعدل 60 أو 120 إطارًا في الثانية",
  "method.reason.timescale-indivisible": "لا يمكن تقسيم توقيت هذا الملف بدقة",
  "method.reason.already-has-edit-list": "يحتوي هذا الملف بالفعل على قائمة تحرير",
  "method.reason.unsupported": "غير مدعوم لهذا الملف",
  "method.reason.eligibility-error": "تعذّر تقييم هذه الطريقة لهذا الملف",
  "method.reason.cancelled": "تم الإيقاف قبل تشغيل هذه الطريقة",
  "info.fragmentedNormalized": "كان المصدر مقسّمًا إلى مقاطع وتمت تهيئته إلى MP4 عادي قبل التحليل.",

  // method comparison
  "compare.title": "مقارنة الطرق",
  "compare.desc": "شُغّلت كل طريقة بشكل مستقل من ملفك الأصلي. النتائج اختبار محلي فقط.",
  "compare.running": "جارٍ تشغيل الطرق…",
  "compare.cancel": "إلغاء",
  "compare.stage.queued": "في الانتظار",
  "compare.stage.patching": "جارٍ التحضير…",
  "compare.stage.structural": "جارٍ فحص البنية…",
  "compare.stage.payload": "جارٍ فحص المحتوى…",
  "compare.stage.audio": "جارٍ فحص الصوت…",
  "compare.stage.decoded": "جارٍ فك ترميز الإطارات…",
  "compare.stage.done": "اكتمل",
  "compare.status.passed": "نجاح",
  "compare.status.failed": "فشل",
  "compare.status.unsupported": "لا ينطبق",
  "compare.status.skipped": "تم التخطي",
  "compare.col.status": "الحالة",
  "compare.col.patch": "وقت التحضير",
  "compare.col.structural": "البنية",
  "compare.col.payload": "المحتوى",
  "compare.col.frames": "الإطارات",
  "compare.col.audio": "الصوت",
  "compare.col.overall": "الإجمالي",
  "compare.use": "استخدام هذه النتيجة",
  "compare.selectHint": "اختر نتيجة لمراجعتها وتنزيلها.",
  "compare.noOutput": "لا توجد نتيجة للمراجعة",
  "result.timingWarning":
    "هذه الطريقة تغيّر توقيت الإطارات المعلن؛ قد يعرض المشغل المحلي الفيديو بشكل مختلف عن المصدر.",
  "result.localOnly": "تحقق محلي فقط. لم يُجرى أي اختبار مباشر على تيك توك.",
  "action.exportReport": "تنزيل التقرير (JSON)",

  // quality report
  "report.title": "فحص الجودة",
  "report.chip.video": "الفيديو {value}",
  "report.chip.audio": "الصوت {value}",
  "report.finding.ok": "لا توجد ملاحظات",
  "report.finding.vfr": "تم رصد معدل إطار غير منتظم",
  "report.finding.metadata": "وُجدت تواريخ تسجيل أو وسوم إضافية؛ تُزال عند التحضير",
  "report.finding.bitrate-high": "معدل بت عالٍ جدًا ({value})؛ سيضغطه تيك توك على أي حال",
  "report.finding.bitrate-low": "معدل بت منخفض ({value}) لهذه الدقة",
  "report.finding.resolution": "أعلى من 1080p؛ سيعيد تيك توك تصغيره",
  "report.finding.bitdepth": "ألوان {value}؛ تُحوَّل إلى 8 بت على تيك توك",
  "report.finding.audio-low": "معدل بت الصوت منخفض ({value})",
  "report.finding.gop": "الإطارات المفتاحية بعيدة (كل {value} إطار)",

  // prepare options
  "options.title": "الخيارات",
  "option.scrub": "إزالة التواريخ والوسوم الزائدة",
  "option.scrub.desc": "تُزال تواريخ التسجيل والبيانات الوصفية المتبقية من الملف المُحضَّر.",
  "option.flatten": "استخدام معدل إطار ثابت",
  "option.flatten.desc":
    "موصى به عندما يكون المعدّل غير منتظم؛ يحافظ على ثبات التشغيل بعد الرفع.",

  // buttons
  "action.patch": "جهّز الفيديو",
  "action.download": "تنزيل الفيديو",
  "action.downloadHint": "سيُحفظ باسم {name}",
  "action.reset": "البدء من جديد",
  "action.another": "معالجة فيديو آخر",

  // progress
  "progress.title": "جارٍ تحضير الفيديو",
  "progress.stage.validate": "جارٍ التحقق من الفيديو…",
  "progress.stage.first-sample": "جارٍ تحسين الإطارات…",
  "progress.stage.audio": "جارٍ موازنة الصوت…",
  "progress.stage.metadata": "جارٍ ضبط الجودة…",
  "progress.stage.assemble": "جارٍ تجميع كل شيء…",
  "progress.stage.done": "تم",
  "progress.validating.structural": "جارٍ التحقق من التكامل البنائي…",
  "progress.validating.payload": "جارٍ التحقق من حفظ الوسائط…",
  "progress.validating.decoded": "جارٍ مقارنة الإطارات المفكّكة…",
  "progress.validating.audio": "جارٍ التحقق من حفظ الصوت…",
  "progress.validating.done": "اكتملت المصادقة",
  "progress.hint": "كل شيء يحدث على هذا الجهاز. لا يُرفع أي شيء.",

  // results
  "result.title": "فيديوك جاهز",
  "result.subtitle": "النعومة والوضوح محفوظان وجاهزان لتيك توك.",
  "result.stats": "الملخص",
  "result.stat.input": "الحجم الأصلي",
  "result.stat.output": "الحجم بعد المعالجة",
  "result.stat.delta": "الفرق",
  "result.stat.duration": "المدة",
  "result.highlights": "ما الذي تحصل عليه",
  "result.highlight.ready": "جاهز لرفع سلس بـ60 إطارًا",
  "result.highlight.quality": "الجودة محفوظة دون أي إعادة ترميز",
  "result.highlight.fast": "مُحسّن لرفع أسرع",
  "result.highlight.private": "تُعالج على جهازك فقط",
  "result.integrity.verified": "تم التحقق من الملف المصدر",
  "result.integrity.failed": "فشل التحقق: تغيّر الملف المصدر. تم تعطيل التنزيل.",
  "result.integrity.unverified": "تعذر التحقق من الملف المصدر. تم تعطيل التنزيل.",
  "result.section.source": "المصدر",
  "result.section.method": "الطريقة",
  "result.section.validation": "المصادقة",
  "result.source.resolution": "الدقة",
  "result.source.duration": "المدة",
  "result.source.codec": "ترميز الفيديو",
  "result.source.audio": "الصوت",
  "result.source.container": "الحاوية",
  "result.source.size": "حجم الملف",
  "result.gate.structural": "صالح بنيويًا",
  "result.gate.payload": "الوسائط محفوظة",
  "result.gate.decoded": "تم التحقق من الإطارات المفكّكة",
  "result.gate.audio": "الصوت محفوظ",
  "result.validation.total": "تم الفحص في {ms} مللي ثانية",
  "result.status.verified": "مُصادَق محليًا",
  "result.status.failed": "فشل التصديق",
  "result.tiktok.notTested":
    "لم يُختبر على تيك توك. الفحوصات المحلية لا تثبت كيف ستتعامل أي منصة مع هذا الملف.",

  // upload guide
  "guide.title": "كيف ترفع بأفضل نتيجة",
  "guide.eyebrow": "خطوة بخطوة",
  "guide.step1.title": "استخدم متصفح حاسوب",
  "guide.step1.body":
    "ارفع من الحاسوب عبر Edge أو Brave أو Chrome. الرفع من الحاسوب يحافظ على الجودة بكثير أفضل من الرفع بالهاتف.",
  "guide.step2.title": "افتح TikTok Studio",
  "guide.step2.body":
    "انتقل إلى tiktok.com أو TikTok Studio وارفع الملف المعالج من حاسوبك.",
  "guide.step3.title": "تحقّق من هاتفك",
  "guide.step3.body":
    "قد يبدو المقطع مشوشًا في معاينة الحاسوب لكنه غالبًا يعمل بشكل طبيعي في تطبيق الهاتف.",
  "guide.notice":
    "حتى بعد المعالجة، يواصل تيك توك تطبيق ضغطه الخاص. والنتائج تختلف من مقطع لآخر.",

  // footer
  "footer.privacy":
    "الخصوصية: تُعالَج مقاطعك بالكامل داخل متصفحك. لا خوادم ولا رفع ولا تحليلات ولا ملفات تعريف ارتباط.",
  "footer.disclaimer": "غير تابع لـ TikTok أو ByteDance. الاستخدام على مسؤوليتك.",
  "footer.noCopyright":
    "لا يعدّل ToolT البصمات ولا التجزئة الإدراكية ولا أي شيء متعلق بكشف حقوق النشر.",

  // states
  "status.reading": "جارٍ قراءة الفيديو…",
};
