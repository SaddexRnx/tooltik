/**
 * French UI strings. Type-checked against `en.ts`: every English key must
 * exist here (and nothing extra), so translations can never drift silently.
 */

import type { Dictionary } from "./en";

export const fr: Dictionary = {
  // header / chrome
  "meta.title": "ToolT | Des uploads TikTok de meilleure qualité, 100 % dans votre navigateur",
  "meta.description":
    "Préparez votre vidéo pour TikTok avec une meilleure qualité, entièrement dans votre navigateur. Aucun envoi, aucun serveur, aucun suivi.",
  "brand.name": "ToolT",
  "nav.theme": "Thème",
  "nav.theme.light": "Clair",
  "nav.theme.dark": "Sombre",
  "nav.theme.tint": "Sombre teinté",
  "nav.language": "Changer de langue",
  "nav.devMode": "Détails développeur",
  "nav.devMode.show": "Afficher les détails développeur",
  "nav.devMode.hide": "Masquer les détails développeur",

  "simple.videoSafe": "Les pixels de votre vidéo restent exactement identiques.",
  "simple.checksDone": "Vérifié automatiquement avant votre téléchargement.",

  // honesty banner
  "honesty.title": "Attentes réalistes",
  "honesty.body":
    "Cette méthode n'est pas garantie à 100 %. TikTok met souvent ses systèmes à jour et cette méthode peut cesser de fonctionner à tout moment.",

  // hero
  "hero.title.before": "Publiez sur TikTok en",
  "hero.title.highlight": "meilleure qualité",
  "hero.title.after": "en un glissé",
  "hero.subtitle":
    "Déposez une vidéo, récupérez un envoi qui conserve ses détails et sa fluidité. Tout se passe dans votre navigateur, votre fichier ne voyage jamais.",
  "hero.badge.local": "100 % privé",
  "hero.badge.noUpload": "Zéro envoi",
  "hero.badge.noAccount": "Gratuit pour toujours",

  // dropzone
  "drop.title": "Déposez votre vidéo ici",
  "drop.subtitle": "ou",
  "drop.browse": "parcourez vos fichiers",
  "drop.formats": "MP4 ou MOV, H.264 (AVC), jusqu'à 4 Go",
  "drop.selectAria": "Choisir un fichier vidéo à préparer",
  "drop.dragging": "Relâchez pour charger votre vidéo",

  // stepper
  "step.label": "Progression de la préparation",
  "step.drop": "Déposer",
  "step.inspect": "Examiner",
  "step.prepare": "Préparer",
  "step.download": "Télécharger",

  // errors
  "error.title": "Ce fichier ne peut pas être traité",
  "error.retry": "Essayer un autre fichier",
  "error.not-video": "Ce type de vidéo n'est pas accepté. Choisissez un fichier MP4 ou MOV.",
  "error.no-moov": "Impossible de lire cette vidéo. Le fichier est peut-être endommagé ou dans un format non pris en charge.",
  "error.no-mdat": "Ce fichier semble incomplet ou corrompu.",
  "error.no-video": "Aucune piste vidéo trouvée dans ce fichier.",
  "error.unsupported-codec":
    "Ce fichier utilise {codec}, non pris en charge ici. Exportez-le en H.264/MP4 puis réessayez.",
  "error.unsupported-boxes": "Ce type de vidéo n'est pas accepté.",
  "error.fragmented":
    "Cette vidéo a été enregistrée dans un format de streaming qui ne peut pas être traité ici. Convertissez-la d'abord en fichier MP4 standard, puis réessayez.",
  "error.too-large": "Les fichiers de plus de 4 Go ne sont pas encore pris en charge.",
  "error.corrupt": "Le fichier semble corrompu ou tronqué.",
  "error.timescale-indivisible":
    "Le minutage des images de ce fichier ne peut pas être divisé exactement, cette méthode ne s'applique donc pas.",
  "error.already-has-edit-list":
    "Ce fichier contient déjà une liste de montage, cette méthode ne s'applique donc pas.",
  "error.unknown": "Un problème est survenu. Votre fichier d'origine n'a pas été modifié.",

  // file info
  "info.resolution": "Résolution",
  "info.fps": "Images par seconde",
  "info.duration": "Durée",
  "info.size": "Taille du fichier",
  "info.videoCodec": "Codec vidéo",
  "info.audioCodec": "Codec audio",
  "info.audioNone": "Sans audio",
  "info.fastStart": "Disposition d'envoi",
  "info.fastStart.yes": "Optimisé pour l'envoi",
  "info.fastStart.no": "Sera optimisé",
  "info.alreadyPatched": "Cette vidéo a déjà été traitée. Traitez plutôt votre fichier d'origine.",
  "info.decoded": "Images décodées",
  "info.decoded.unavailable": "Indisponible",
  "info.decoded.errors": "erreurs",
  "info.decodeMode.full": "Décodage complet",
  "info.decodeMode.sampled": "Décodage par échantillon",
  "info.rotation": "Rotation",
  "info.crosscheck.agree": "Le parseur indépendant confirme notre lecture de ce fichier",
  "info.crosscheck.conflict": "CONFLIT : les deux parseurs divergent sur ce fichier",
  "info.crosscheck.notrun": "Contrôle par parseur indépendant indisponible pour ce fichier",

  // decoded-content analysis (baseline decode evidence)
  "quality.black": "Images noires",
  "quality.duplicates": "Images dupliquées",
  "quality.clipped": "Images entièrement blanches",
  "quality.sharpness": "Netteté moyenne",

  // method chooser
  "method.title": "Méthode",
  "method.containerOnly": "Réécriture du conteneur uniquement",
  "method.reencode": "Réencode les médias",
  "method.videoUntouched": "Vidéo intacte",
  "method.audioUntouched": "Audio intact",
  "method.reencodesVideo": "Vidéo réencodée",
  "method.reencodesAudio": "Audio réencodé",
  "method.videoLabel": "Vidéo",
  "method.audioLabel": "Audio",
  "method.evidence": "Preuves : issue {outcome}, mécanisme {mechanism}",
  "flag.yes": "Oui",
  "flag.no": "Non",
  "flag.failed": "Échec",

  // method eligibility + classification
  "method.eligible": "Applicable à ce fichier",
  "method.notEligible": "Non applicable à ce fichier",
  "method.cannotRun": "Cette méthode ne s'applique pas à ce fichier",
  "method.runAll": "Exécuter toutes les méthodes",
  "method.changesTiming": "Modifie le minutage des images",
  "method.changesMetadata": "Modifie les métadonnées",
  "method.reason.codec-not-avc": "Nécessite une vidéo H.264/AVC",
  "method.reason.fps-unsupported": "Nécessite une vidéo à 60 ou 120 i/s",
  "method.reason.timescale-indivisible": "Le minutage de ce fichier ne peut pas être divisé exactement",
  "method.reason.already-has-edit-list": "Ce fichier a déjà une liste de montage",
  "method.reason.unsupported": "Non pris en charge pour ce fichier",
  "method.reason.eligibility-error": "Impossible d'évaluer cette méthode pour ce fichier",
  "method.reason.cancelled": "Interrompue avant le lancement de cette méthode",
  "info.fragmentedNormalized":
    "La source était fragmentée et a été normalisée en MP4 standard avant l'analyse.",

  // method comparison
  "compare.title": "Comparaison des méthodes",
  "compare.desc":
    "Chaque méthode a été exécutée indépendamment à partir de votre fichier d'origine. Résultats de validation locale uniquement.",
  "compare.running": "Exécution des méthodes…",
  "compare.cancel": "Annuler",
  "compare.stage.queued": "En attente",
  "compare.stage.patching": "Préparation…",
  "compare.stage.structural": "Vérification structurelle…",
  "compare.stage.payload": "Vérification du contenu…",
  "compare.stage.audio": "Vérification de l'audio…",
  "compare.stage.decoded": "Décodage des images…",
  "compare.stage.done": "Terminé",
  "compare.status.passed": "Réussi",
  "compare.status.failed": "Échoué",
  "compare.status.unsupported": "Non applicable",
  "compare.status.skipped": "Ignoré",
  "compare.col.status": "État",
  "compare.col.patch": "Temps de préparation",
  "compare.col.structural": "Structure",
  "compare.col.payload": "Contenus",
  "compare.col.frames": "Images",
  "compare.col.audio": "Audio",
  "compare.col.overall": "Global",
  "compare.use": "Utiliser ce résultat",
  "compare.selectHint": "Sélectionnez un résultat pour l'examiner et le télécharger.",
  "compare.noOutput": "Aucun résultat à examiner",
  "result.timingWarning":
    "Cette méthode modifie le minutage déclaré des images ; les lecteurs locaux peuvent afficher la vidéo différemment de la source.",
  "result.localOnly": "Validation locale uniquement. Aucun test TikTok en ligne n'a été effectué.",
  "action.exportReport": "Télécharger le rapport (JSON)",

  // quality report
  "report.title": "Contrôle qualité",
  "report.chip.video": "Vidéo {value}",
  "report.chip.audio": "Audio {value}",
  "report.finding.ok": "Rien à signaler",
  "report.finding.vfr": "Cadence irrégulière détectée",
  "report.finding.metadata": "Dates d'enregistrement ou tags trouvés ; supprimés à la préparation",
  "report.finding.bitrate-high": "Débit très élevé ({value}) ; TikTok le compressera de toute façon",
  "report.finding.bitrate-low": "Débit faible ({value}) pour cette résolution",
  "report.finding.resolution": "Au-dessus de 1080p ; TikTok le réduira",
  "report.finding.bitdepth": "Colorimétrie {value} ; convertie en 8 bits sur TikTok",
  "report.finding.audio-low": "Débit audio faible ({value})",
  "report.finding.gop": "Images clés trop espacées (toutes les {value} images)",

  // prepare options
  "options.title": "Options",
  "option.scrub": "Supprimer dates et tags superflus",
  "option.scrub.desc":
    "Les dates d'enregistrement et métadonnées résiduelles sont retirées du fichier préparé.",
  "option.flatten": "Utiliser une cadence constante",
  "option.flatten.desc":
    "Recommandé si la cadence est irrégulière ; garantit une lecture stable après l'envoi.",

  // buttons
  "action.patch": "Préparer ma vidéo",
  "action.download": "Télécharger ma vidéo",
  "action.downloadHint": "Enregistré sous {name}",
  "action.reset": "Recommencer",
  "action.another": "Traiter une autre vidéo",

  // progress
  "progress.title": "Préparation de votre vidéo",
  "progress.stage.validate": "Vérification de votre vidéo…",
  "progress.stage.first-sample": "Optimisation des images…",
  "progress.stage.audio": "Équilibrage de l'audio…",
  "progress.stage.metadata": "Réglage de la qualité…",
  "progress.stage.assemble": "Assemblage de tout…",
  "progress.stage.done": "Terminé",
  "progress.validating.structural": "Vérification de l'intégrité structurelle…",
  "progress.validating.payload": "Vérification de la préservation des médias…",
  "progress.validating.decoded": "Comparaison des images décodées…",
  "progress.validating.audio": "Vérification de la préservation de l'audio…",
  "progress.validating.done": "Validation terminée",
  "progress.hint": "Tout se passe sur cet appareil. Rien n'est envoyé.",

  // results
  "result.title": "Votre vidéo est prête",
  "result.subtitle": "Fluidité et netteté préservées, prête pour TikTok.",
  "result.stats": "Résumé",
  "result.stat.input": "Taille d'origine",
  "result.stat.output": "Taille après traitement",
  "result.stat.delta": "Différence",
  "result.stat.duration": "Durée",
  "result.highlights": "Ce que vous obtenez",
  "result.highlight.ready": "Prêt pour des envois fluides en 60 IPS",
  "result.highlight.quality": "Qualité préservée, aucun réencodage",
  "result.highlight.fast": "Optimisé pour un envoi plus rapide",
  "result.highlight.private": "Traité uniquement sur votre appareil",
  "result.integrity.verified": "Fichier source vérifié",
  "result.integrity.failed": "Échec de la vérification : le fichier source a changé. Le téléchargement est désactivé.",
  "result.integrity.unverified": "Impossible de vérifier le fichier source. Le téléchargement est désactivé.",
  "result.section.source": "Source",
  "result.section.method": "Méthode",
  "result.section.validation": "Validation",
  "result.source.resolution": "Résolution",
  "result.source.duration": "Durée",
  "result.source.codec": "Codec vidéo",
  "result.source.audio": "Audio",
  "result.source.container": "Conteneur",
  "result.source.size": "Taille du fichier",
  "result.gate.structural": "Validité structurelle",
  "result.gate.payload": "Médias préservés",
  "result.gate.decoded": "Images décodées vérifiées",
  "result.gate.audio": "Audio préservé",
  "result.validation.total": "Vérifié en {ms} ms",
  "result.status.verified": "VÉRIFIÉ LOCALEMENT",
  "result.status.failed": "VALIDATION ÉCHOUÉE",
  "result.tiktok.notTested":
    "Non testé sur TikTok. Les contrôles locaux ne peuvent pas prouver comment une plateforme traitera ce fichier.",

  // upload guide
  "guide.title": "Comment télécharger pour un meilleur résultat",
  "guide.eyebrow": "Étape par étape",
  "guide.step1.title": "Utilisez un navigateur d'ordinateur",
  "guide.step1.body":
    "Téléchargez depuis un PC avec Edge, Brave ou Chrome. Les envois depuis un ordinateur conservent bien mieux la qualité que depuis un téléphone.",
  "guide.step2.title": "Ouvrez TikTok Studio",
  "guide.step2.body":
    "Rendez-vous sur tiktok.com ou TikTok Studio et téléversez le fichier traité depuis votre ordinateur.",
  "guide.step3.title": "Vérifiez sur votre téléphone",
  "guide.step3.body":
    "La vidéo peut sembler buggée dans l'aperçu ordinateur mais se joue généralement normalement dans l'application mobile.",
  "guide.notice":
    "Même après traitement, TikTok applique sa propre compression. Les résultats varient d'une vidéo à l'autre.",

  // footer
  "footer.privacy":
    "Confidentialité : les vidéos sont traitées entièrement dans votre navigateur. Aucun serveur, aucun envoi, aucune analyse, aucun cookie.",
  "footer.disclaimer": "Non affilié à TikTok ni à ByteDance. À utiliser à vos propres risques.",
  "footer.noCopyright":
    "ToolT ne modifie ni les empreintes, ni les hachages perceptuels, ni quoi que ce soit lié à la détection de droits d'auteur.",

  // states
  "status.reading": "Lecture de votre vidéo…",
};
