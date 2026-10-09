/**
 * Russian UI strings. Type-checked against `en.ts`, so a missing or extra
 * translation key is a build error.
 */

import type { Dictionary } from "./en";

export const ru: Dictionary = {
  // header / chrome
  "meta.title": "ToolT | Загрузки в TikTok в более высоком качестве, 100% в вашем браузере",
  "meta.description":
    "Подготовьте видео для TikTok в лучшем качестве, полностью в браузере. Без загрузок, без серверов, без слежки.",
  "brand.name": "ToolT",
  "nav.theme": "Тема",
  "nav.theme.light": "Светлая",
  "nav.theme.dark": "Тёмная",
  "nav.theme.tint": "Тёмная цветная",
  "nav.language": "Сменить язык",
  "nav.devMode": "Подробности для разработчика",
  "nav.devMode.show": "Показать подробности для разработчика",
  "nav.devMode.hide": "Скрыть подробности для разработчика",

  "simple.videoSafe": "Пиксели вашего видео остаются точно такими же.",
  "simple.checksDone": "Автоматически проверено перед скачиванием.",

  // honesty banner
  "honesty.title": "Честные ожидания",
  "honesty.body":
    "Этот метод не даёт 100% гарантии. TikTok часто обновляет свои системы, и он может перестать работать в любой момент.",

  // hero
  "hero.title.before": "Загружайте в TikTok в",
  "hero.title.highlight": "более высоком качестве",
  "hero.title.after": "одним перетаскиванием",
  "hero.subtitle":
    "Перетащите видео и получите загрузку с сохранённой детализацией и плавностью. Всё происходит внутри вашего браузера, поэтому ваши материалы никуда не отправляются.",
  "hero.badge.local": "100% приватно",
  "hero.badge.noUpload": "Ноль загрузок",
  "hero.badge.noAccount": "Бесплатно навсегда",

  // dropzone
  "drop.title": "Перетащите видео сюда",
  "drop.subtitle": "или",
  "drop.browse": "выберите файл",
  "drop.formats": "MP4 или MOV, H.264 (AVC), до 4 ГБ",
  "drop.selectAria": "Выберите видеофайл для подготовки",
  "drop.dragging": "Отпустите, чтобы загрузить видео",

  // stepper
  "step.label": "Прогресс подготовки",
  "step.drop": "Добавить",
  "step.inspect": "Проверка",
  "step.prepare": "Подготовка",
  "step.download": "Скачать",

  // errors
  "error.title": "Этот файл нельзя обработать",
  "error.retry": "Выбрать другой файл",
  "error.not-video": "Такой тип видео не принимается. Выберите файл MP4 или MOV.",
  "error.no-moov": "Не удалось прочитать видео. Файл может быть повреждён или в неподдерживаемом формате.",
  "error.no-mdat": "Этот файл выглядит неполным или повреждённым.",
  "error.no-video": "В этом файле не найдена видеодорожка.",
  "error.unsupported-codec":
    "Этот файл использует {codec}, который здесь не поддерживается. Экспортируйте его в H.264/MP4 и попробуйте снова.",
  "error.unsupported-boxes": "Такой тип видео не принимается.",
  "error.fragmented":
    "Это видео сохранено в потоковом формате, который нельзя обработать здесь. Сначала преобразуйте его в обычный файл MP4 и попробуйте снова.",
  "error.too-large": "Файлы больше 4 ГБ пока не поддерживаются.",
  "error.corrupt": "Файл выглядит повреждённым или усечённым.",
  "error.timescale-indivisible":
    "Тайминг кадров этого файла нельзя точно разделить, поэтому этот метод не применим.",
  "error.already-has-edit-list":
    "Этот файл уже содержит список монтажа, поэтому этот метод не применим.",
  "error.unknown": "Что-то пошло не так. Ваш исходный файл не был изменён.",

  // file info
  "info.resolution": "Разрешение",
  "info.fps": "Частота кадров",
  "info.duration": "Длительность",
  "info.size": "Размер файла",
  "info.videoCodec": "Видеокодек",
  "info.audioCodec": "Аудиокодек",
  "info.audioNone": "Без звука",
  "info.fastStart": "Структура для загрузки",
  "info.fastStart.yes": "Оптимизировано для загрузки",
  "info.fastStart.no": "Будет оптимизировано",
  "info.alreadyPatched": "Это видео уже обработано. Обработайте ваш исходный файл.",
  "info.decoded": "Декодированные кадры",
  "info.decoded.unavailable": "Недоступно",
  "info.decoded.errors": "ошибок",
  "info.decodeMode.full": "Полное декодирование",
  "info.decodeMode.sampled": "Выборочное декодирование",
  "info.rotation": "Поворот",
  "info.crosscheck.agree": "Независимый парсер согласен с нашим чтением этого файла",
  "info.crosscheck.conflict": "КОНФЛИКТ: два парсера расходятся в чтении этого файла",
  "info.crosscheck.notrun": "Проверка независимым парсером недоступна для этого файла",

  // decoded-content analysis
  "quality.black": "Чёрные кадры",
  "quality.duplicates": "Дубликаты кадров",
  "quality.clipped": "Полностью белые кадры",
  "quality.sharpness": "Средняя резкость",

  // method chooser
  "method.title": "Метод",
  "method.containerOnly": "Перезапись только контейнера",
  "method.reencode": "Перекодирует медиа",
  "method.videoUntouched": "Видео не тронуто",
  "method.audioUntouched": "Аудио не тронуто",
  "method.reencodesVideo": "Видео перекодируется",
  "method.reencodesAudio": "Аудио перекодируется",
  "method.videoLabel": "Видео",
  "method.audioLabel": "Аудио",
  "method.evidence": "Свидетельство: результат {outcome}, механизм {mechanism}",
  "flag.yes": "Да",
  "flag.no": "Нет",
  "flag.failed": "Не удалось",

  // method eligibility + classification
  "method.eligible": "Применимо к этому файлу",
  "method.notEligible": "Не применимо к этому файлу",
  "method.cannotRun": "Этот метод не применим к этому файлу",
  "method.runAll": "Запустить все методы",
  "method.changesTiming": "Меняет тайминг кадров",
  "method.changesMetadata": "Меняет метаданные",
  "method.reason.codec-not-avc": "Требуется видео H.264/AVC",
  "method.reason.fps-unsupported": "Требуется видео 60 или 120 кадров/с",
  "method.reason.timescale-indivisible": "Тайминг кадров этого файла нельзя точно разделить",
  "method.reason.already-has-edit-list": "В этом файле уже есть список монтажа",
  "method.reason.unsupported": "Не поддерживается для этого файла",
  "method.reason.eligibility-error": "Не удалось проверить этот метод для этого файла",
  "method.reason.cancelled": "Остановлено до запуска этого метода",
  "info.fragmentedNormalized":
    "Источник был записан фрагментами и перед анализом нормализован в обычный MP4.",

  // method comparison
  "compare.title": "Сравнение методов",
  "compare.desc":
    "Каждый метод запускался независимо от вашего исходного файла. Результаты — только локальная проверка.",
  "compare.running": "Выполняются методы…",
  "compare.cancel": "Отмена",
  "compare.stage.queued": "В очереди",
  "compare.stage.patching": "Подготовка…",
  "compare.stage.structural": "Проверка структуры…",
  "compare.stage.payload": "Проверка данных…",
  "compare.stage.audio": "Проверка звука…",
  "compare.stage.decoded": "Декодирование кадров…",
  "compare.stage.done": "Завершено",
  "compare.status.passed": "Пройдено",
  "compare.status.failed": "Провалено",
  "compare.status.unsupported": "Не применимо",
  "compare.status.skipped": "Пропущено",
  "compare.col.status": "Статус",
  "compare.col.patch": "Время обработки",
  "compare.col.structural": "Структура",
  "compare.col.payload": "Данные",
  "compare.col.frames": "Кадры",
  "compare.col.audio": "Звук",
  "compare.col.overall": "Итог",
  "compare.use": "Использовать этот результат",
  "compare.selectHint": "Выберите результат, чтобы просмотреть и скачать его.",
  "compare.noOutput": "Нет результата для просмотра",
  "result.timingWarning":
    "Этот метод меняет заявленный тайминг кадров; локальные плееры могут показывать видео иначе, чем источник.",
  "result.localOnly": "Только локальная проверка. Тест на TikTok не проводился.",
  "action.exportReport": "Скачать отчёт (JSON)",

  // quality report
  "report.title": "Проверка качества",
  "report.chip.video": "Видео {value}",
  "report.chip.audio": "Аудио {value}",
  "report.finding.ok": "Замечаний нет",
  "report.finding.vfr": "Обнаружен неравномерный тайминг кадров",
  "report.finding.metadata": "Найдены даты записи или лишние теги; будут удалены при подготовке",
  "report.finding.bitrate-high": "Очень высокий битрейт ({value}); TikTok в любом случае сожмёт его",
  "report.finding.bitrate-low": "Низкий битрейт ({value}) для этого разрешения",
  "report.finding.resolution": "Выше 1080p; TikTok уменьшит его",
  "report.finding.bitdepth": "{value} цвет; на TikTok конвертируется в 8 бит",
  "report.finding.audio-low": "Низкий битрейт аудио ({value})",
  "report.finding.gop": "Ключевые кадры далеко друг от друга (каждые {value} кадров)",

  // prepare options
  "options.title": "Параметры",
  "option.scrub": "Удалить даты и лишние теги",
  "option.scrub.desc": "Даты записи и случайные метаданные удаляются из подготовленного файла.",
  "option.flatten": "Использовать постоянный тайминг кадров",
  "option.flatten.desc": "Рекомендуется при неравномерном тайминге; воспроизведение после загрузки будет плавным.",

  // buttons
  "action.patch": "Подготовить моё видео",
  "action.download": "Скачать моё видео",
  "action.downloadHint": "Сохранено как {name}",
  "action.reset": "Начать заново",
  "action.another": "Обработать другое видео",

  // progress
  "progress.title": "Готовим ваше видео",
  "progress.stage.validate": "Проверяем ваше видео…",
  "progress.stage.first-sample": "Оптимизируем кадры…",
  "progress.stage.audio": "Балансируем звук…",
  "progress.stage.metadata": "Настраиваем качество…",
  "progress.stage.assemble": "Собираем всё…",
  "progress.stage.done": "Готово",
  "progress.validating.structural": "Проверяем структурную целостность…",
  "progress.validating.payload": "Проверяем сохранность медиа…",
  "progress.validating.decoded": "Сравниваем декодированные кадры…",
  "progress.validating.audio": "Проверяем сохранность звука…",
  "progress.validating.done": "Проверка завершена",
  "progress.hint": "Всё происходит на этом устройстве. Ничего не загружается.",

  // results
  "result.title": "Ваше видео готово",
  "result.subtitle": "Плавность и чёткость сохранены, готово для TikTok.",
  "result.stats": "Сводка",
  "result.stat.input": "Исходный размер",
  "result.stat.output": "Размер после обработки",
  "result.stat.delta": "Разница",
  "result.stat.duration": "Длительность",
  "result.highlights": "Что вы получаете",
  "result.highlight.ready": "Готово к плавным загрузкам 60 FPS",
  "result.highlight.quality": "Качество сохранено, без перекодирования",
  "result.highlight.fast": "Оптимизировано для быстрой загрузки",
  "result.highlight.private": "Обработано только на вашем устройстве",
  "result.integrity.verified": "Исходный файл проверен",
  "result.integrity.failed": "Проверка не пройдена: исходный файл изменился. Скачивание отключено.",
  "result.integrity.unverified": "Не удалось проверить исходный файл. Скачивание отключено.",
  "result.section.source": "Источник",
  "result.section.method": "Метод",
  "result.section.validation": "Проверка",
  "result.source.resolution": "Разрешение",
  "result.source.duration": "Длительность",
  "result.source.codec": "Видеокодек",
  "result.source.audio": "Звук",
  "result.source.container": "Контейнер",
  "result.source.size": "Размер файла",
  "result.gate.structural": "Структурно корректно",
  "result.gate.payload": "Медиа сохранено",
  "result.gate.decoded": "Декодированные кадры проверены",
  "result.gate.audio": "Звук сохранён",
  "result.validation.total": "Проверено за {ms} мс",
  "result.status.verified": "ПРОВЕРЕНО ЛОКАЛЬНО",
  "result.status.failed": "ПРОВЕРКА ПРОВАЛЕНА",
  "result.tiktok.notTested":
    "Не проверялось на TikTok. Локальные проверки не могут доказать, как любая платформа обработает этот файл.",

  // upload guide
  "guide.title": "Как загружать для лучшего результата",
  "guide.eyebrow": "Пошагово",
  "guide.step1.title": "Используйте браузер на компьютере",
  "guide.step1.body":
    "Загружайте с ПК через Edge, Brave или Chrome. Загрузки с компьютера сохраняют качество намного лучше загрузок с телефона.",
  "guide.step2.title": "Откройте TikTok Studio",
  "guide.step2.body":
    "Зайдите на tiktok.com или в TikTok Studio и загрузите обработанный файл с компьютера.",
  "guide.step3.title": "Проверьте на телефоне",
  "guide.step3.body":
    "Видео может выглядеть со сбоями в предпросмотре на компьютере, но обычно нормально играет в мобильном приложении.",
  "guide.notice":
    "Даже после обработки TikTok применяет своё сжатие. Результаты различаются от видео к видео.",

  // footer
  "footer.privacy":
    "Приватность: видео обрабатываются полностью в вашем браузере. Нет серверов, загрузок, аналитики и cookie.",
  "footer.disclaimer": "Не аффилировано с TikTok или ByteDance. Используйте на свой риск.",
  "footer.noCopyright":
    "ToolT не изменяет отпечатки, перцептивные хэши и что-либо, связанное с определением авторских прав.",

  // states
  "status.reading": "Читаем ваше видео…",
};
