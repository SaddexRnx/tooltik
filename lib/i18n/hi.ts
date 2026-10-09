/**
 * Hindi UI strings. Type-checked against `en.ts`, so a missing or extra
 * translation key is a build error.
 */

import type { Dictionary } from "./en";

export const hi: Dictionary = {
  // header / chrome
  "meta.title": "ToolT | बेहतर क्वालिटी वाले TikTok अपलोड, 100% आपके ब्राउज़र में",
  "meta.description":
    "अपने वीडियो को बेहतर क्वालिटी के साथ TikTok के लिए तैयार करें, पूरी तरह आपके ब्राउज़र में। कोई अपलोड नहीं, कोई सर्वर नहीं, कोई ट्रैकिंग नहीं।",
  "brand.name": "ToolT",
  "nav.theme": "थीम",
  "nav.theme.light": "लाइट",
  "nav.theme.dark": "डार्क",
  "nav.theme.tint": "रंगीन डार्क",
  "nav.language": "भाषा बदलें",
  "nav.devMode": "डेवलपर विवरण",
  "nav.devMode.show": "डेवलपर विवरण दिखाएँ",
  "nav.devMode.hide": "डेवलपर विवरण छिपाएँ",

  "simple.videoSafe": "आपके वीडियो के पिक्सेल बिल्कुल वैसे ही रहते हैं।",
  "simple.checksDone": "डाउनलोड से पहले स्वतः सत्यापित।",

  // honesty banner
  "honesty.title": "ईमानदार अपेक्षाएँ",
  "honesty.body":
    "यह तरीका 100% गारंटीड नहीं है। TikTok अक्सर अपने सिस्टम अपडेट करता है और यह कभी भी काम करना बंद कर सकता है।",

  // hero
  "hero.title.before": "TikTok पर अपलोड करें",
  "hero.title.highlight": "बेहतर क्वालिटी में",
  "hero.title.after": "एक ही ड्रॉप से",
  "hero.subtitle":
    "एक वीडियो ड्रॉप करें और बेहतर डिटेल व स्मूदनेस वाला अपलोड पाएँ। सब कुछ आपके ब्राउज़र के अंदर होता है, इसलिए आपकी फ़ुटेज कहीं नहीं जाती।",
  "hero.badge.local": "100% प्राइवेट",
  "hero.badge.noUpload": "ज़ीरो अपलोड",
  "hero.badge.noAccount": "हमेशा के लिए मुफ़्त",

  // dropzone
  "drop.title": "अपना वीडियो यहाँ ड्रॉप करें",
  "drop.subtitle": "या",
  "drop.browse": "फ़ाइलें चुनें",
  "drop.formats": "MP4 या MOV, H.264 (AVC), 4 GB तक",
  "drop.selectAria": "तैयार करने के लिए एक वीडियो फ़ाइल चुनें",
  "drop.dragging": "अपना वीडियो लोड करने के लिए छोड़ें",

  // stepper
  "step.label": "तैयारी की प्रगति",
  "step.drop": "ड्रॉप",
  "step.inspect": "जाँच",
  "step.prepare": "तैयार",
  "step.download": "डाउनलोड",

  // errors
  "error.title": "यह फ़ाइल प्रोसेस नहीं हो सकती",
  "error.retry": "दूसरी फ़ाइल आज़माएँ",
  "error.not-video": "इस तरह का वीडियो स्वीकार नहीं है। कृपया MP4 या MOV फ़ाइल चुनें।",
  "error.no-moov": "हम यह वीडियो नहीं पढ़ सके। फ़ाइल खराब हो सकती है या असमर्थित फॉर्मेट में है।",
  "error.no-mdat": "यह फ़ाइल अधूरी या दूषित लगती है।",
  "error.no-video": "इस फ़ाइल में कोई वीडियो ट्रैक नहीं मिला।",
  "error.unsupported-codec":
    "यह फ़ाइल {codec} इस्तेमाल करती है, जो यहाँ समर्थित नहीं है। इसे H.264/MP4 में एक्सपोर्ट करके फिर कोशिश करें।",
  "error.unsupported-boxes": "इस तरह का वीडियो स्वीकार नहीं है।",
  "error.fragmented":
    "यह वीडियो स्ट्रीमिंग फॉर्मेट में सेव हुआ था जिसे यहाँ प्रोसेस नहीं किया जा सकता। पहले इसे सामान्य MP4 फ़ाइल में बदलें, फिर कोशिश करें।",
  "error.too-large": "4 GB से बड़ी फ़ाइलें अभी समर्थित नहीं हैं।",
  "error.corrupt": "फ़ाइल दूषित या अधूरी लगती है।",
  "error.timescale-indivisible":
    "इस फ़ाइल का फ़्रेम टाइमिंग सटीक रूप से विभाजित नहीं हो सकता, इसलिए यह तरीका लागू नहीं होता।",
  "error.already-has-edit-list":
    "इस फ़ाइल में पहले से एडिट लिस्ट है, इसलिए यह तरीका लागू नहीं होता।",
  "error.unknown": "कुछ गड़बड़ हुई। आपकी मूल फ़ाइल बदली नहीं गई।",

  // file info
  "info.resolution": "रिज़ॉल्यूशन",
  "info.fps": "फ़्रेम दर",
  "info.duration": "अवधि",
  "info.size": "फ़ाइल आकार",
  "info.videoCodec": "वीडियो कोडेक",
  "info.audioCodec": "ऑडियो कोडेक",
  "info.audioNone": "कोई ऑडियो नहीं",
  "info.fastStart": "अपलोड लेआउट",
  "info.fastStart.yes": "अपलोड के लिए अनुकूलित",
  "info.fastStart.no": "अनुकूलित होगा",
  "info.alreadyPatched": "यह वीडियो पहले से प्रोसेस है। अपनी मूल फ़ाइल प्रोसेस करें।",
  "info.decoded": "डिकोड किए गए फ़्रेम",
  "info.decoded.unavailable": "उपलब्ध नहीं",
  "info.decoded.errors": "त्रुटियाँ",
  "info.decodeMode.full": "पूर्ण डिकोड",
  "info.decodeMode.sampled": "सैंपल्ड डिकोड",
  "info.rotation": "रोटेशन",
  "info.crosscheck.agree": "स्वतंत्र पार्सर इस फ़ाइल की हमारी पढ़ाई से सहमत है",
  "info.crosscheck.conflict": "संघर्ष: दोनों पार्सर इस फ़ाइल पर असहमत हैं",
  "info.crosscheck.notrun": "इस फ़ाइल के लिए स्वतंत्र पार्सर जाँच उपलब्ध नहीं है",

  // decoded-content analysis
  "quality.black": "काले फ़्रेम",
  "quality.duplicates": "डुप्लिकेट फ़्रेम",
  "quality.clipped": "पूरी तरह सफ़ेद फ़्रेम",
  "quality.sharpness": "औसत शार्पनेस",

  // method chooser
  "method.title": "तरीका",
  "method.containerOnly": "केवल-कंटेनर रीराइट",
  "method.reencode": "मीडिया री-एनकोड",
  "method.videoUntouched": "वीडियो अप्रभावित",
  "method.audioUntouched": "ऑडियो अप्रभावित",
  "method.reencodesVideo": "वीडियो री-एनकोड",
  "method.reencodesAudio": "ऑडियो री-एनकोड",
  "method.videoLabel": "वीडियो",
  "method.audioLabel": "ऑडियो",
  "method.evidence": "साक्ष्य: परिणाम {outcome}, तंत्र {mechanism}",
  "flag.yes": "हाँ",
  "flag.no": "नहीं",
  "flag.failed": "विफल",

  // method eligibility + classification
  "method.eligible": "इस फ़ाइल के लिए योग्य",
  "method.notEligible": "इस फ़ाइल के लिए अयोग्य",
  "method.cannotRun": "यह तरीका इस फ़ाइल पर लागू नहीं होता",
  "method.runAll": "सभी तरीके चलाएँ",
  "method.changesTiming": "फ़्रेम टाइमिंग बदलता है",
  "method.changesMetadata": "मेटाडेटा बदलता है",
  "method.reason.codec-not-avc": "H.264/AVC वीडियो आवश्यक",
  "method.reason.fps-unsupported": "60fps या 120fps वीडियो आवश्यक",
  "method.reason.timescale-indivisible": "इस फ़ाइल का फ़्रेम टाइमिंग सटीक विभाजित नहीं हो सकता",
  "method.reason.already-has-edit-list": "इस फ़ाइल में पहले से एडिट लिस्ट है",
  "method.reason.unsupported": "इस फ़ाइल के लिए समर्थित नहीं",
  "method.reason.eligibility-error": "इस फ़ाइल के लिए यह तरीका जाँच नहीं हो सका",
  "method.reason.cancelled": "यह तरीका चलने से पहले रुक गया",
  "info.fragmentedNormalized":
    "स्रोत टुकड़ों में स्ट्रीम हुआ था और विश्लेषण से पहले सामान्य MP4 में सामान्यीकृत हुआ।",

  // method comparison
  "compare.title": "तरीकों की तुलना",
  "compare.desc":
    "हर तरीका आपकी मूल फ़ाइल से स्वतंत्र रूप से चला। परिणाम केवल स्थानीय सत्यापन हैं।",
  "compare.running": "तरीके चल रहे हैं…",
  "compare.cancel": "रद्द करें",
  "compare.stage.queued": "क़तार में",
  "compare.stage.patching": "तैयार कर रहे हैं…",
  "compare.stage.structural": "संरचना जाँच…",
  "compare.stage.payload": "पेलोड जाँच…",
  "compare.stage.audio": "ऑडियो जाँच…",
  "compare.stage.decoded": "फ़्रेम डिकोड…",
  "compare.stage.done": "समाप्त",
  "compare.status.passed": "पास",
  "compare.status.failed": "विफल",
  "compare.status.unsupported": "अयोग्य",
  "compare.status.skipped": "छोड़ा गया",
  "compare.col.status": "स्थिति",
  "compare.col.patch": "पैच समय",
  "compare.col.structural": "संरचना",
  "compare.col.payload": "पेलोड",
  "compare.col.frames": "फ़्रेम",
  "compare.col.audio": "ऑडियो",
  "compare.col.overall": "कुल मिलाकर",
  "compare.use": "यह परिणाम उपयोग करें",
  "compare.selectHint": "समीक्षा और डाउनलोड के लिए एक परिणाम चुनें।",
  "compare.noOutput": "समीक्षा के लिए कोई परिणाम नहीं",
  "result.timingWarning":
    "यह तरीका घोषित फ़्रेम टाइमिंग बदलता है; स्थानीय प्लेयर वीडियो को स्रोत से अलग दिखा सकते हैं।",
  "result.localOnly": "केवल स्थानीय सत्यापन। कोई वास्तविक TikTok परीक्षण नहीं हुआ।",
  "action.exportReport": "रिपोर्ट डाउनलोड करें (JSON)",

  // quality report
  "report.title": "क्वालिटी जाँच",
  "report.chip.video": "वीडियो {value}",
  "report.chip.audio": "ऑडियो {value}",
  "report.finding.ok": "कुछ चिह्नित करने योग्य नहीं",
  "report.finding.vfr": "असमान फ़्रेम टाइमिंग पाया गया",
  "report.finding.metadata": "रिकॉर्डिंग तिथियाँ या अतिरिक्त टैग मिले; तैयार करते समय हट जाएँगे",
  "report.finding.bitrate-high": "बहुत उँचा बिटरेट ({value}); TikTok वैसे भी कंप्रेस करेगा",
  "report.finding.bitrate-low": "इस रिज़ॉल्यूशन के लिए बिटरेट कम ({value}) है",
  "report.finding.resolution": "1080p से ऊपर; TikTok इसे छोटा कर देगा",
  "report.finding.bitdepth": "{value} रंग; TikTok पर 8-बिट में बदल जाएगा",
  "report.finding.audio-low": "ऑडियो बिटरेट कम है ({value})",
  "report.finding.gop": "कीफ़्रेम बहुत दूर-दूर हैं (हर {value} फ़्रेम)",

  // prepare options
  "options.title": "विकल्प",
  "option.scrub": "तिथियाँ व अतिरिक्त टैग हटाएँ",
  "option.scrub.desc": "रिकॉर्डिंग तिथियाँ और बिखरे मेटाडेटा तैयार फ़ाइल से हटा दिए जाते हैं।",
  "option.flatten": "स्थिर फ़्रेम टाइमिंग उपयोग करें",
  "option.flatten.desc": "असमान टाइमिंग पर अनुशंसित; अपलोड के बाद प्लेबैक स्थिर रहता है।",

  // buttons
  "action.patch": "मेरा वीडियो तैयार करें",
  "action.download": "मेरा वीडियो डाउनलोड करें",
  "action.downloadHint": "{name} के रूप में सेव हुआ",
  "action.reset": "फिर से शुरू करें",
  "action.another": "दूसरा वीडियो प्रोसेस करें",

  // progress
  "progress.title": "आपका वीडियो तैयार हो रहा है",
  "progress.stage.validate": "आपका वीडियो जाँचा जा रहा है…",
  "progress.stage.first-sample": "फ़्रेम अनुकूलित हो रहे हैं…",
  "progress.stage.audio": "ऑडियो संतुलित हो रहा है…",
  "progress.stage.metadata": "क्वालिटी ट्यून हो रही है…",
  "progress.stage.assemble": "सब कुछ पैक हो रहा है…",
  "progress.stage.done": "पूर्ण",
  "progress.validating.structural": "संरचनात्मक अखंडता जाँची जा रही है…",
  "progress.validating.payload": "मीडिया संरक्षण जाँचा जा रहा है…",
  "progress.validating.decoded": "डिकोड किए गए फ़्रेम तुलने जा रहे हैं…",
  "progress.validating.audio": "ऑडियो संरक्षण जाँचा जा रहा है…",
  "progress.validating.done": "सत्यापन पूर्ण",
  "progress.hint": "सब कुछ इसी डिवाइस पर होता है। कुछ भी अपलोड नहीं होता।",

  // results
  "result.title": "आपका वीडियो तैयार है",
  "result.subtitle": "स्मूदनेस और स्पष्टता सुरक्षित, TikTok के लिए तैयार।",
  "result.stats": "सारांश",
  "result.stat.input": "मूल आकार",
  "result.stat.output": "प्रोसेस्ड आकार",
  "result.stat.delta": "अंतर",
  "result.stat.duration": "अवधि",
  "result.highlights": "आपको क्या मिलता है",
  "result.highlight.ready": "स्मूद 60 FPS अपलोड के लिए तैयार",
  "result.highlight.quality": "क्वालिटी सुरक्षित, कुछ भी री-एनकोड नहीं",
  "result.highlight.fast": "तेज़ अपलोड के लिए अनुकूलित",
  "result.highlight.private": "केवल आपके डिवाइस पर प्रोसेस",
  "result.integrity.verified": "स्रोत फ़ाइल सत्यापित",
  "result.integrity.failed": "सत्यापन विफल: स्रोत फ़ाइल बदली। डाउनलोड अक्षम।",
  "result.integrity.unverified": "स्रोत फ़ाइल सत्यापित नहीं हो सकी। डाउनलोड अक्षम।",
  "result.section.source": "स्रोत",
  "result.section.method": "तरीका",
  "result.section.validation": "सत्यापन",
  "result.source.resolution": "रिज़ॉल्यूशन",
  "result.source.duration": "अवधि",
  "result.source.codec": "वीडियो कोडेक",
  "result.source.audio": "ऑडियो",
  "result.source.container": "कंटेनर",
  "result.source.size": "फ़ाइल आकार",
  "result.gate.structural": "संरचनात्मक रूप से वैध",
  "result.gate.payload": "मीडिया सुरक्षित",
  "result.gate.decoded": "डिकोड किए गए फ़्रेम सत्यापित",
  "result.gate.audio": "ऑडियो सुरक्षित",
  "result.validation.total": "{ms} ms में जाँचा गया",
  "result.status.verified": "स्थानीय रूप से सत्यापित",
  "result.status.failed": "सत्यापन विफल",
  "result.tiktok.notTested":
    "TikTok पर परीक्षित नहीं। स्थानीय जाँचें यह साबित नहीं कर सकतीं कि कोई प्लेटफ़ॉर्म इस फ़ाइल को कैसे प्रोसेस करेगा।",

  // upload guide
  "guide.title": "बेहतर परिणामों के लिए अपलोड कैसे करें",
  "guide.eyebrow": "चरण दर चरण",
  "guide.step1.title": "कंप्यूटर ब्राउज़र उपयोग करें",
  "guide.step1.body":
    "PC से Edge, Brave या Chrome का उपयोग करके अपलोड करें। डेस्कटॉप अपलोड फ़ोन अपलोड से कहीं बेहतर क्वालिटी रखते हैं।",
  "guide.step2.title": "TikTok Studio खोलें",
  "guide.step2.body":
    "tiktok.com या TikTok Studio पर जाएँ और अपने कंप्यूटर से प्रोसेस्ड फ़ाइल अपलोड करें।",
  "guide.step3.title": "फ़ोन पर जाँचें",
  "guide.step3.body":
    "वीडियो डेस्कटॉप प्रीव्यू में अजीब लग सकता है पर मोबाइल ऐप में आमतौर पर सामान्य चलता है।",
  "guide.notice":
    "प्रोसेसिंग के बाद भी TikTok अपनी कंप्रेशन लगाता है। परिणाम वीडियो-दर-वीडियो अलग होते हैं।",

  // footer
  "footer.privacy":
    "प्राइवेसी: वीडियो पूरी तरह आपके ब्राउज़र में प्रोसेस होते हैं। कोई सर्वर, अपलोड, एनालिटिक्स या कुकीज़ नहीं।",
  "footer.disclaimer": "TikTok या ByteDance से कोई संबंध नहीं। अपने जोखिम पर उपयोग करें।",
  "footer.noCopyright":
    "ToolT फ़िंगरप्रिंट, परसेप्चुअल हैश या कॉपीराइट डिटेक्शन से जुड़ी किसी चीज़ को नहीं बदलता।",

  // states
  "status.reading": "आपका वीडियो पढ़ा जा रहा है…",
};
