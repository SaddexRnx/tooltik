/**
 * Spanish UI strings. Type-checked against `en.ts`, so a missing or extra
 * translation key is a build error.
 */

import type { Dictionary } from "./en";

export const es: Dictionary = {
  // header / chrome
  "meta.title": "ToolT | Subidas a TikTok de mayor calidad, 100% en tu navegador",
  "meta.description":
    "Prepara tu video para TikTok con mejor calidad, totalmente en tu navegador. Sin subidas, sin servidores, sin rastreo.",
  "brand.name": "ToolT",
  "nav.theme": "Tema",
  "nav.theme.light": "Claro",
  "nav.theme.dark": "Oscuro",
  "nav.theme.tint": "Oscuro tintado",
  "nav.language": "Cambiar idioma",
  "nav.devMode": "Detalles para desarrolladores",
  "nav.devMode.show": "Mostrar detalles para desarrolladores",
  "nav.devMode.hide": "Ocultar detalles para desarrolladores",

  "simple.videoSafe": "Los píxeles de tu video se mantienen exactamente iguales.",
  "simple.checksDone": "Verificado automáticamente antes de descargar.",

  // honesty banner
  "honesty.title": "Expectativas honestas",
  "honesty.body":
    "Este método no está 100% garantizado. TikTok actualiza sus sistemas con frecuencia y puede dejar de funcionar en cualquier momento.",

  // hero
  "hero.title.before": "Sube a TikTok en",
  "hero.title.highlight": "mayor calidad",
  "hero.title.after": "con una sola entrega",
  "hero.subtitle":
    "Suelta un video y recibe una versión que conserva el detalle y la fluidez. Todo ocurre dentro de tu navegador, así que tu material nunca viaja a ningún lado.",
  "hero.badge.local": "100% privado",
  "hero.badge.noUpload": "Cero subidas",
  "hero.badge.noAccount": "Gratis para siempre",

  // dropzone
  "drop.title": "Suelta tu video aquí",
  "drop.subtitle": "o",
  "drop.browse": "explora archivos",
  "drop.formats": "MP4 o MOV, H.264 (AVC), hasta 4 GB",
  "drop.selectAria": "Selecciona un archivo de video para preparar",
  "drop.dragging": "Suelta para cargar tu video",

  // stepper
  "step.label": "Progreso de preparación",
  "step.drop": "Entregar",
  "step.inspect": "Inspeccionar",
  "step.prepare": "Preparar",
  "step.download": "Descargar",

  // errors
  "error.title": "Este archivo no se puede procesar",
  "error.retry": "Prueba otro archivo",
  "error.not-video": "Este tipo de video no se acepta. Elige un archivo MP4 o MOV.",
  "error.no-moov": "No pudimos leer este video. El archivo puede estar dañado o en un formato no compatible.",
  "error.no-mdat": "Este archivo parece incompleto o corrupto.",
  "error.no-video": "No se encontró pista de video en este archivo.",
  "error.unsupported-codec":
    "Este archivo usa {codec}, que no es compatible aquí. Expórtalo como H.264/MP4 e inténtalo de nuevo.",
  "error.unsupported-boxes": "Este tipo de video no se acepta.",
  "error.fragmented":
    "Este video se guardó en un formato de streaming que no se puede procesar aquí. Conviértelo primero a un archivo MP4 normal e inténtalo de nuevo.",
  "error.too-large": "Los archivos de más de 4 GB aún no son compatibles.",
  "error.corrupt": "El archivo parece estar corrupto o truncado.",
  "error.timescale-indivisible":
    "La temporización de fotogramas de este archivo no se puede dividir exactamente, así que este método no aplica.",
  "error.already-has-edit-list":
    "Este archivo ya contiene una lista de edición, así que este método no aplica.",
  "error.unknown": "Algo salió mal. Tu archivo original no fue modificado.",

  // file info
  "info.resolution": "Resolución",
  "info.fps": "Fotogramas por segundo",
  "info.duration": "Duración",
  "info.size": "Tamaño del archivo",
  "info.videoCodec": "Códec de video",
  "info.audioCodec": "Códec de audio",
  "info.audioNone": "Sin audio",
  "info.fastStart": "Diseño de subida",
  "info.fastStart.yes": "Optimizado para subir",
  "info.fastStart.no": "Se optimizará",
  "info.alreadyPatched": "Este video ya fue procesado. Procesa tu archivo original en su lugar.",
  "info.decoded": "Fotogramas decodificados",
  "info.decoded.unavailable": "No disponible",
  "info.decoded.errors": "errores",
  "info.decodeMode.full": "Decodificación completa",
  "info.decodeMode.sampled": "Decodificación por muestreo",
  "info.rotation": "Rotación",
  "info.crosscheck.agree": "Un parser independiente coincide con nuestra lectura del archivo",
  "info.crosscheck.conflict": "CONFLICTO: los dos parsers discrepan sobre este archivo",
  "info.crosscheck.notrun": "Verificación con parser independiente no disponible para este archivo",

  // decoded-content analysis
  "quality.black": "Fotogramas negros",
  "quality.duplicates": "Fotogramas duplicados",
  "quality.clipped": "Fotogramas completamente blancos",
  "quality.sharpness": "Nitidez media",

  // method chooser
  "method.title": "Método",
  "method.containerOnly": "Reescritura solo de contenedor",
  "method.reencode": "Recodifica el medio",
  "method.videoUntouched": "Video intacto",
  "method.audioUntouched": "Audio intacto",
  "method.reencodesVideo": "Video recodificado",
  "method.reencodesAudio": "Audio recodificado",
  "method.videoLabel": "Video",
  "method.audioLabel": "Audio",
  "method.evidence": "Evidencia: resultado {outcome}, mecanismo {mechanism}",
  "flag.yes": "Sí",
  "flag.no": "No",
  "flag.failed": "Falló",

  // method eligibility + classification
  "method.eligible": "Elegible para este archivo",
  "method.notEligible": "No elegible para este archivo",
  "method.cannotRun": "Este método no aplica a este archivo",
  "method.runAll": "Ejecutar todos los métodos",
  "method.changesTiming": "Cambia la temporización de fotogramas",
  "method.changesMetadata": "Cambia los metadatos",
  "method.reason.codec-not-avc": "Requiere video H.264/AVC",
  "method.reason.fps-unsupported": "Requiere video de 60 fps o 120 fps",
  "method.reason.timescale-indivisible": "La temporización de fotogramas de este archivo no se puede dividir exactamente",
  "method.reason.already-has-edit-list": "Este archivo ya tiene una lista de edición",
  "method.reason.unsupported": "No compatible con este archivo",
  "method.reason.eligibility-error": "No se pudo verificar este método para este archivo",
  "method.reason.cancelled": "Se detuvo antes de ejecutar este método",
  "info.fragmentedNormalized":
    "La fuente se grabó en fragmentos y se normalizó a un MP4 regular antes del análisis.",

  // method comparison
  "compare.title": "Comparación de métodos",
  "compare.desc":
    "Cada método se ejecutó independientemente desde tu archivo original. Los resultados son solo validación local.",
  "compare.running": "Ejecutando métodos…",
  "compare.cancel": "Cancelar",
  "compare.stage.queued": "En cola",
  "compare.stage.patching": "Preparando…",
  "compare.stage.structural": "Comprobación de estructura…",
  "compare.stage.payload": "Comprobación de carga útil…",
  "compare.stage.audio": "Comprobación de audio…",
  "compare.stage.decoded": "Decodificación de fotogramas…",
  "compare.stage.done": "Finalizado",
  "compare.status.passed": "Aprobado",
  "compare.status.failed": "Fallido",
  "compare.status.unsupported": "No elegible",
  "compare.status.skipped": "Omitido",
  "compare.col.status": "Estado",
  "compare.col.patch": "Tiempo de parcheo",
  "compare.col.structural": "Estructura",
  "compare.col.payload": "Carga",
  "compare.col.frames": "Fotogramas",
  "compare.col.audio": "Audio",
  "compare.col.overall": "General",
  "compare.use": "Usar este resultado",
  "compare.selectHint": "Selecciona un resultado para revisarlo y descargarlo.",
  "compare.noOutput": "No hay resultado para revisar",
  "result.timingWarning":
    "Este método cambia la temporización declarada; los reproductores locales pueden mostrar el video de forma distinta a la fuente.",
  "result.localOnly": "Solo validación local. No se realizó ninguna prueba en TikTok.",
  "action.exportReport": "Descargar informe (JSON)",

  // quality report
  "report.title": "Control de calidad",
  "report.chip.video": "Video {value}",
  "report.chip.audio": "Audio {value}",
  "report.finding.ok": "Nada que señalar",
  "report.finding.vfr": "Temporización de fotogramas irregular detectada",
  "report.finding.metadata": "Fechas de grabación o etiquetas extra encontradas; se eliminan al preparar",
  "report.finding.bitrate-high": "Tasa de bits muy alta ({value}); TikTok la comprimirá de todos modos",
  "report.finding.bitrate-low": "Tasa de bits baja ({value}) para esta resolución",
  "report.finding.resolution": "Superior a 1080p; TikTok la reducirá",
  "report.finding.bitdepth": "{value} de color; convertido a 8 bits en TikTok",
  "report.finding.audio-low": "La tasa de bits del audio es baja ({value})",
  "report.finding.gop": "Los fotogramas clave están muy separados (cada {value} fotogramas)",

  // prepare options
  "options.title": "Opciones",
  "option.scrub": "Eliminar fechas y etiquetas extra",
  "option.scrub.desc": "Las fechas de grabación y los metadatos dispersos se eliminan del archivo preparado.",
  "option.flatten": "Usar temporización constante",
  "option.flatten.desc": "Recomendado cuando la temporización es irregular; mantiene la reproducción estable tras subir.",

  // buttons
  "action.patch": "Preparar mi video",
  "action.download": "Descargar mi video",
  "action.downloadHint": "Guardado como {name}",
  "action.reset": "Empezar de nuevo",
  "action.another": "Procesar otro video",

  // progress
  "progress.title": "Preparando tu video",
  "progress.stage.validate": "Comprobando tu video…",
  "progress.stage.first-sample": "Optimizando fotogramas…",
  "progress.stage.audio": "Equilibrando audio…",
  "progress.stage.metadata": "Ajustando calidad…",
  "progress.stage.assemble": "Empaquetando todo…",
  "progress.stage.done": "Listo",
  "progress.validating.structural": "Comprobando integridad estructural…",
  "progress.validating.payload": "Comprobando preservación del medio…",
  "progress.validating.decoded": "Comparando fotogramas decodificados…",
  "progress.validating.audio": "Comprobando preservación del audio…",
  "progress.validating.done": "Validación completa",
  "progress.hint": "Todo ocurre en este dispositivo. No se sube nada.",

  // results
  "result.title": "Tu video está listo",
  "result.subtitle": "Fluidez y claridad preservadas, listo para TikTok.",
  "result.stats": "Resumen",
  "result.stat.input": "Tamaño original",
  "result.stat.output": "Tamaño procesado",
  "result.stat.delta": "Diferencia",
  "result.stat.duration": "Duración",
  "result.highlights": "Lo que obtienes",
  "result.highlight.ready": "Listo para subidas fluidas de 60 FPS",
  "result.highlight.quality": "Calidad preservada, nada recodificado",
  "result.highlight.fast": "Optimizado para subidas más rápidas",
  "result.highlight.private": "Procesado solo en tu dispositivo",
  "result.integrity.verified": "Archivo fuente verificado",
  "result.integrity.failed": "Verificación fallida: el archivo fuente cambió. Descarga deshabilitada.",
  "result.integrity.unverified": "No se pudo verificar el archivo fuente. Descarga deshabilitada.",
  "result.section.source": "Fuente",
  "result.section.method": "Método",
  "result.section.validation": "Validación",
  "result.source.resolution": "Resolución",
  "result.source.duration": "Duración",
  "result.source.codec": "Códec de video",
  "result.source.audio": "Audio",
  "result.source.container": "Contenedor",
  "result.source.size": "Tamaño del archivo",
  "result.gate.structural": "Estructuralmente válido",
  "result.gate.payload": "Medio preservado",
  "result.gate.decoded": "Fotogramas decodificados verificados",
  "result.gate.audio": "Audio preservado",
  "result.validation.total": "Verificado en {ms} ms",
  "result.status.verified": "VERIFICADO LOCALMENTE",
  "result.status.failed": "VALIDACIÓN FALLIDA",
  "result.tiktok.notTested":
    "No probado en TikTok. Las comprobaciones locales no pueden demostrar cómo procesará cualquier plataforma este archivo.",

  // upload guide
  "guide.title": "Cómo subir para mejores resultados",
  "guide.eyebrow": "Paso a paso",
  "guide.step1.title": "Usa un navegador de computadora",
  "guide.step1.body":
    "Sube desde una PC con Edge, Brave o Chrome. Las subidas de escritorio preservan la calidad mucho mejor que las de teléfono.",
  "guide.step2.title": "Abre TikTok Studio",
  "guide.step2.body":
    "Ve a tiktok.com o TikTok Studio y sube el archivo procesado desde tu computadora.",
  "guide.step3.title": "Comprueba en tu teléfono",
  "guide.step3.body":
    "El video puede verse con fallos en la vista previa de escritorio pero suele reproducirse con normalidad en la app móvil.",
  "guide.notice":
    "Incluso después de procesar, TikTok aplica su propia compresión. Los resultados varían de video a video.",

  // footer
  "footer.privacy":
    "Privacidad: los videos se procesan completamente en tu navegador. No hay servidores, subidas, análisis ni cookies.",
  "footer.disclaimer": "Sin afiliación con TikTok o ByteDance. Úsalo bajo tu propio riesgo.",
  "footer.noCopyright":
    "ToolT no modifica huellas digitales, hashes perceptuales ni nada relacionado con la detección de derechos de autor.",

  // states
  "status.reading": "Leyendo tu video…",
} as const;
