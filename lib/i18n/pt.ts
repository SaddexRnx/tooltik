/**
 * Portuguese (Brazil) UI strings. Type-checked against `en.ts`, so a missing
 * or extra translation key is a build error.
 */

import type { Dictionary } from "./en";

export const pt: Dictionary = {
  // header / chrome
  "meta.title": "ToolT | Uploads para o TikTok de maior qualidade, 100% no seu navegador",
  "meta.description":
    "Prepare seu vídeo para o TikTok com melhor qualidade, totalmente no seu navegador. Sem uploads, sem servidores, sem rastreamento.",
  "brand.name": "ToolT",
  "nav.theme": "Tema",
  "nav.theme.light": "Claro",
  "nav.theme.dark": "Escuro",
  "nav.theme.tint": "Escuro colorido",
  "nav.language": "Mudar idioma",
  "nav.devMode": "Detalhes para desenvolvedores",
  "nav.devMode.show": "Mostrar detalhes para desenvolvedores",
  "nav.devMode.hide": "Ocultar detalhes para desenvolvedores",

  "simple.videoSafe": "Os pixels do seu vídeo permanecem exatamente como estão.",
  "simple.checksDone": "Verificado automaticamente antes de você baixar.",

  // honesty banner
  "honesty.title": "Expectativas honestas",
  "honesty.body":
    "Este método não tem garantia de 100%. O TikTok atualiza seus sistemas com frequência e pode parar de funcionar a qualquer momento.",

  // hero
  "hero.title.before": "Envie para o TikTok em",
  "hero.title.highlight": "maior qualidade",
  "hero.title.after": "com um único envio",
  "hero.subtitle":
    "Solte um vídeo e receba uma versão que preserva o detalhe e a fluidez. Tudo acontece dentro do seu navegador, então sua filmagem nunca viaja para lugar nenhum.",
  "hero.badge.local": "100% privado",
  "hero.badge.noUpload": "Zero uploads",
  "hero.badge.noAccount": "Grátis para sempre",

  // dropzone
  "drop.title": "Solte seu vídeo aqui",
  "drop.subtitle": "ou",
  "drop.browse": "explorar arquivos",
  "drop.formats": "MP4 ou MOV, H.264 (AVC), até 4 GB",
  "drop.selectAria": "Selecione um arquivo de vídeo para preparar",
  "drop.dragging": "Solte para carregar seu vídeo",

  // stepper
  "step.label": "Progresso da preparação",
  "step.drop": "Enviar",
  "step.inspect": "Inspecionar",
  "step.prepare": "Preparar",
  "step.download": "Baixar",

  // errors
  "error.title": "Este arquivo não pode ser processado",
  "error.retry": "Tentar outro arquivo",
  "error.not-video": "Este tipo de vídeo não é aceito. Escolha um arquivo MP4 ou MOV.",
  "error.no-moov": "Não foi possível ler este vídeo. O arquivo pode estar danificado ou em um formato não suportado.",
  "error.no-mdat": "Este arquivo parece incompleto ou corrompido.",
  "error.no-video": "Nenhuma faixa de vídeo encontrada neste arquivo.",
  "error.unsupported-codec":
    "Este arquivo usa {codec}, que não é suportado aqui. Exporte-o como H.264/MP4 e tente novamente.",
  "error.unsupported-boxes": "Este tipo de vídeo não é aceito.",
  "error.fragmented":
    "Este vídeo foi salvo em um formato de streaming que não pode ser processado aqui. Converta-o primeiro para um arquivo MP4 normal e tente novamente.",
  "error.too-large": "Arquivos maiores que 4 GB ainda não são suportados.",
  "error.corrupt": "O arquivo parece estar corrompido ou truncado.",
  "error.timescale-indivisible":
    "A temporização de quadros deste arquivo não pode ser dividida exatamente, então este método não se aplica.",
  "error.already-has-edit-list":
    "Este arquivo já contém uma lista de edição, então este método não se aplica.",
  "error.unknown": "Algo deu errado. Seu arquivo original não foi modificado.",

  // file info
  "info.resolution": "Resolução",
  "info.fps": "Taxa de quadros",
  "info.duration": "Duração",
  "info.size": "Tamanho do arquivo",
  "info.videoCodec": "Codec de vídeo",
  "info.audioCodec": "Codec de áudio",
  "info.audioNone": "Sem áudio",
  "info.fastStart": "Layout de upload",
  "info.fastStart.yes": "Otimizado para upload",
  "info.fastStart.no": "Será otimizado",
  "info.alreadyPatched": "Este vídeo já foi processado. Processe seu arquivo original em vez disso.",
  "info.decoded": "Quadros decodificados",
  "info.decoded.unavailable": "Indisponível",
  "info.decoded.errors": "erros",
  "info.decodeMode.full": "Decodificação completa",
  "info.decodeMode.sampled": "Decodificação amostrada",
  "info.rotation": "Rotação",
  "info.crosscheck.agree": "Um parser independente concorda com nossa leitura deste arquivo",
  "info.crosscheck.conflict": "CONFLITO: os dois parsers discordam sobre este arquivo",
  "info.crosscheck.notrun": "Verificação com parser independente não disponível para este arquivo",

  // decoded-content analysis
  "quality.black": "Quadros pretos",
  "quality.duplicates": "Quadros duplicados",
  "quality.clipped": "Quadros totalmente brancos",
  "quality.sharpness": "Nitidez média",

  // method chooser
  "method.title": "Método",
  "method.containerOnly": "Reescrita apenas do contêiner",
  "method.reencode": "Recodifica o conteúdo",
  "method.videoUntouched": "Vídeo intacto",
  "method.audioUntouched": "Áudio intacto",
  "method.reencodesVideo": "Vídeo recodificado",
  "method.reencodesAudio": "Áudio recodificado",
  "method.videoLabel": "Vídeo",
  "method.audioLabel": "Áudio",
  "method.evidence": "Evidência: resultado {outcome}, mecanismo {mechanism}",
  "flag.yes": "Sim",
  "flag.no": "Não",
  "flag.failed": "Falhou",

  // method eligibility + classification
  "method.eligible": "Elegível para este arquivo",
  "method.notEligible": "Não elegível para este arquivo",
  "method.cannotRun": "Este método não se aplica a este arquivo",
  "method.runAll": "Executar todos os métodos",
  "method.changesTiming": "Altera a temporização de quadros",
  "method.changesMetadata": "Altera os metadados",
  "method.reason.codec-not-avc": "Requer vídeo H.264/AVC",
  "method.reason.fps-unsupported": "Requer vídeo de 60 fps ou 120 fps",
  "method.reason.timescale-indivisible": "A temporização de quadros deste arquivo não pode ser dividida exatamente",
  "method.reason.already-has-edit-list": "Este arquivo já tem uma lista de edição",
  "method.reason.unsupported": "Não suportado para este arquivo",
  "method.reason.eligibility-error": "Não foi possível verificar este método para este arquivo",
  "method.reason.cancelled": "Interrompido antes de este método ser executado",
  "info.fragmentedNormalized":
    "A fonte foi gravada em fragmentos e foi normalizada para um MP4 regular antes da análise.",

  // method comparison
  "compare.title": "Comparação de métodos",
  "compare.desc":
    "Cada método foi executado independentemente a partir do seu arquivo original. Os resultados são apenas validação local.",
  "compare.running": "Executando métodos…",
  "compare.cancel": "Cancelar",
  "compare.stage.queued": "Na fila",
  "compare.stage.patching": "Preparando…",
  "compare.stage.structural": "Verificação de estrutura…",
  "compare.stage.payload": "Verificação de carga…",
  "compare.stage.audio": "Verificação de áudio…",
  "compare.stage.decoded": "Decodificação de quadros…",
  "compare.stage.done": "Concluído",
  "compare.status.passed": "Aprovado",
  "compare.status.failed": "Reprovado",
  "compare.status.unsupported": "Não elegível",
  "compare.status.skipped": "Ignorado",
  "compare.col.status": "Status",
  "compare.col.patch": "Tempo de correção",
  "compare.col.structural": "Estrutura",
  "compare.col.payload": "Carga",
  "compare.col.frames": "Quadros",
  "compare.col.audio": "Áudio",
  "compare.col.overall": "Geral",
  "compare.use": "Usar este resultado",
  "compare.selectHint": "Selecione um resultado para revisá-lo e baixá-lo.",
  "compare.noOutput": "Nenhum resultado para revisar",
  "result.timingWarning":
    "Este método altera a temporização declarada de quadros; players locais podem exibir o vídeo de forma diferente da fonte.",
  "result.localOnly": "Apenas validação local. Nenhum teste real foi feito no TikTok.",
  "action.exportReport": "Baixar relatório (JSON)",

  // quality report
  "report.title": "Verificação de qualidade",
  "report.chip.video": "Vídeo {value}",
  "report.chip.audio": "Áudio {value}",
  "report.finding.ok": "Nada a apontar",
  "report.finding.vfr": "Temporização de quadros irregular detectada",
  "report.finding.metadata": "Datas de gravação ou etiquetas extras encontradas; removidas ao preparar",
  "report.finding.bitrate-high": "Taxa de bits muito alta ({value}); o TikTok vai comprimi-la de qualquer forma",
  "report.finding.bitrate-low": "Taxa de bits baixa ({value}) para esta resolução",
  "report.finding.resolution": "Acima de 1080p; o TikTok vai reduzir",
  "report.finding.bitdepth": "{value} de cor; convertido para 8 bits no TikTok",
  "report.finding.audio-low": "A taxa de bits do áudio está baixa ({value})",
  "report.finding.gop": "Quadros-chave muito espaçados (a cada {value} quadros)",

  // prepare options
  "options.title": "Opções",
  "option.scrub": "Remover datas e etiquetas extras",
  "option.scrub.desc": "Datas de gravação e metadados dispersos são removidos do arquivo preparado.",
  "option.flatten": "Usar temporização constante",
  "option.flatten.desc": "Recomendado quando a temporização é irregular; mantém a reprodução estável após o upload.",

  // buttons
  "action.patch": "Preparar meu vídeo",
  "action.download": "Baixar meu vídeo",
  "action.downloadHint": "Salvo como {name}",
  "action.reset": "Começar de novo",
  "action.another": "Processar outro vídeo",

  // progress
  "progress.title": "Preparando seu vídeo",
  "progress.stage.validate": "Verificando seu vídeo…",
  "progress.stage.first-sample": "Otimizando quadros…",
  "progress.stage.audio": "Equilibrando áudio…",
  "progress.stage.metadata": "Ajustando qualidade…",
  "progress.stage.assemble": "Empacotando tudo…",
  "progress.stage.done": "Pronto",
  "progress.validating.structural": "Verificando integridade estrutural…",
  "progress.validating.payload": "Verificando preservação do conteúdo…",
  "progress.validating.decoded": "Comparando quadros decodificados…",
  "progress.validating.audio": "Verificando preservação do áudio…",
  "progress.validating.done": "Validação concluída",
  "progress.hint": "Tudo acontece neste dispositivo. Nada é enviado.",

  // results
  "result.title": "Seu vídeo está pronto",
  "result.subtitle": "Fluidez e clareza preservadas, pronto para o TikTok.",
  "result.stats": "Resumo",
  "result.stat.input": "Tamanho original",
  "result.stat.output": "Tamanho processado",
  "result.stat.delta": "Diferença",
  "result.stat.duration": "Duração",
  "result.highlights": "O que você recebe",
  "result.highlight.ready": "Pronto para uploads fluidos de 60 FPS",
  "result.highlight.quality": "Qualidade preservada, nada recodificado",
  "result.highlight.fast": "Otimizado para uploads mais rápidos",
  "result.highlight.private": "Processado apenas no seu dispositivo",
  "result.integrity.verified": "Arquivo de origem verificado",
  "result.integrity.failed": "Verificação falhou: o arquivo de origem mudou. Download desabilitado.",
  "result.integrity.unverified": "Não foi possível verificar o arquivo de origem. Download desabilitado.",
  "result.section.source": "Origem",
  "result.section.method": "Método",
  "result.section.validation": "Validação",
  "result.source.resolution": "Resolução",
  "result.source.duration": "Duração",
  "result.source.codec": "Codec de vídeo",
  "result.source.audio": "Áudio",
  "result.source.container": "Contêiner",
  "result.source.size": "Tamanho do arquivo",
  "result.gate.structural": "Estruturalmente válido",
  "result.gate.payload": "Conteúdo preservado",
  "result.gate.decoded": "Quadros decodificados verificados",
  "result.gate.audio": "Áudio preservado",
  "result.validation.total": "Verificado em {ms} ms",
  "result.status.verified": "VERIFICADO LOCALMENTE",
  "result.status.failed": "VALIDAÇÃO FALHOU",
  "result.tiktok.notTested":
    "Não testado no TikTok. As verificações locais não podem provar como qualquer plataforma processará este arquivo.",

  // upload guide
  "guide.title": "Como enviar para melhores resultados",
  "guide.eyebrow": "Passo a passo",
  "guide.step1.title": "Use um navegador de computador",
  "guide.step1.body":
    "Envie de um PC usando Edge, Brave ou Chrome. Uploads de desktop preservam a qualidade muito melhor que os de celular.",
  "guide.step2.title": "Abra o TikTok Studio",
  "guide.step2.body":
    "Acesse tiktok.com ou o TikTok Studio e envie o arquivo processado do seu computador.",
  "guide.step3.title": "Confira no seu celular",
  "guide.step3.body":
    "O vídeo pode parecer com falhas na prévia do desktop, mas geralmente é reproduzido normalmente no aplicativo móvel.",
  "guide.notice":
    "Mesmo após processar, o TikTok ainda aplica sua própria compressão. Os resultados variam de vídeo para vídeo.",

  // footer
  "footer.privacy":
    "Privacidade: os vídeos são processados inteiramente no seu navegador. Não há servidores, uploads, análise nem cookies.",
  "footer.disclaimer": "Sem afiliação com TikTok ou ByteDance. Use por sua conta e risco.",
  "footer.noCopyright":
    "O ToolT não modifica impressões digitais, hashes perceptuais nem nada relacionado à detecção de direitos autorais.",

  // states
  "status.reading": "Lendo seu vídeo…",
};
