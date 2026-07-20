"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const refs = {
  stages: $$(".stage"),
  stepButtons: $$(".step-button"),
  projectTitle: $("#projectTitle"),
  savedState: $("#savedState"),
  mediaDrop: $("#mediaDrop"),
  mediaInput: $("#mediaInput"),
  subtitleInput: $("#subtitleInput"),
  mediaCard: $("#mediaCard"),
  videoPreview: $("#videoPreview"),
  audioSourcePreview: $("#audioSourcePreview"),
  mediaName: $("#mediaName"),
  mediaMeta: $("#mediaMeta"),
  pasteText: $("#pasteText"),
  videoLink: $("#videoLink"),
  linkSupport: $("#linkSupport"),
  linkDiagnostics: $("#linkDiagnostics"),
  linkDiagnosticText: $("#linkDiagnosticText"),
  sourceRows: $("#sourceRows"),
  sourceEmpty: $("#sourceEmpty"),
  translationRows: $("#translationRows"),
  translationEmpty: $("#translationEmpty"),
  cueCount: $("#cueCount"),
  sourceWordCount: $("#sourceWordCount"),
  transcriptTitle: $("#transcriptTitle"),
  transcriptDescription: $("#transcriptDescription"),
  translationTitle: $("#translationTitle"),
  translationDescription: $("#translationDescription"),
  sourceColumnLabel: $("#sourceColumnLabel"),
  translatedCount: $("#translatedCount"),
  spanishWordCount: $("#spanishWordCount"),
  translationEngine: $("#translationEngine"),
  translatorNotice: $("#translatorNotice"),
  translatorStatus: $("#translatorStatus"),
  translatorDetail: $("#translatorDetail"),
  piperSetting: $("#piperSetting"),
  windowsSetting: $("#windowsSetting"),
  windowsVoice: $("#windowsVoice"),
  voiceSpeed: $("#voiceSpeed"),
  voiceSpeedValue: $("#voiceSpeedValue"),
  generatedAudioCard: $("#generatedAudioCard"),
  spanishAudioPreview: $("#spanishAudioPreview"),
  audioMeta: $("#audioMeta"),
  finalProjectTitle: $("#finalProjectTitle"),
  finalSummaryText: $("#finalSummaryText"),
  taskPanel: $("#taskPanel"),
  taskTitle: $("#taskTitle"),
  taskDetail: $("#taskDetail"),
  taskProgress: $("#taskProgress"),
  cancelTask: $("#cancelTask"),
  helpDialog: $("#helpDialog"),
  toasts: $("#toasts"),
  renderCanvas: $("#renderCanvas")
};

const state = {
  step: 1,
  mediaFile: null,
  mediaUrl: "",
  mediaKind: "",
  mediaDuration: 0,
  cues: [],
  spanishAudio: null,
  spanishAudioBlob: null,
  spanishAudioUrl: "",
  audioSampleRate: 16000,
  currentCancel: null,
  speechRun: 0,
  isSpeaking: false,
  saveTimer: null
};

class LocalAI {
  constructor() {
    this.sequence = 0;
    this.pending = new Map();
    this.createWorker();
  }

  createWorker() {
    this.worker = new Worker("ai-worker.bundle.js", { type: "module" });
    this.worker.addEventListener("message", ({ data }) => {
      const pending = this.pending.get(data.taskId);
      if (!pending) return;

      if (data.type === "error") {
        this.pending.delete(data.taskId);
        pending.reject(new Error(data.message || "Falló el modelo local."));
      } else if (data.type === "result") {
        this.pending.delete(data.taskId);
        pending.resolve(data.result);
      } else if (data.type === "voice-segment") {
        pending.onSegment?.(data);
      } else {
        pending.onProgress?.(data);
      }
    });
    this.worker.addEventListener("error", (event) => {
      const message = event.message || "No se pudo iniciar el motor local de IA.";
      for (const pending of this.pending.values()) pending.reject(new Error(message));
      this.pending.clear();
      this.worker.terminate();
      this.worker = null;
    });
  }

  run(task, payload, { transfer = [], onProgress, onSegment } = {}) {
    if (!this.worker) this.createWorker();
    const taskId = `task-${Date.now()}-${++this.sequence}`;
    return new Promise((resolve, reject) => {
      this.pending.set(taskId, { resolve, reject, onProgress, onSegment });
      this.worker.postMessage({ taskId, task, payload }, transfer);
    });
  }

  cancelAll() {
    for (const pending of this.pending.values()) pending.reject(new Error("Tarea cancelada."));
    this.pending.clear();
    this.worker?.terminate();
    this.createWorker();
  }
}

const localAI = new LocalAI();

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  await restoreProject();
  renderAll();
  updateVoiceEngineUI();
  updateSourceLanguageUI();
  checkChromeTranslator();
}

function bindEvents() {
  refs.stepButtons.forEach((button) => button.addEventListener("click", () => goToStep(Number(button.dataset.step))));
  $$('[data-go]').forEach((button) => button.addEventListener("click", () => goToStep(Number(button.dataset.go))));

  $("#pickMedia").addEventListener("click", stopThen(() => refs.mediaInput.click()));
  refs.mediaDrop.addEventListener("click", () => refs.mediaInput.click());
  $("#replaceMedia").addEventListener("click", () => refs.mediaInput.click());
  $("#pickSubtitle").addEventListener("click", () => refs.subtitleInput.click());
  $("#importTranscript").addEventListener("click", () => refs.subtitleInput.click());
  refs.mediaInput.addEventListener("change", () => refs.mediaInput.files[0] && loadMediaFile(refs.mediaInput.files[0]));
  refs.subtitleInput.addEventListener("change", () => refs.subtitleInput.files[0] && loadTranscriptFile(refs.subtitleInput.files[0]));
  $("#usePastedText").addEventListener("click", usePastedText);
  $("#extractLink").addEventListener("click", () => importFromLink(false));
  $("#extractTranslateLink").addEventListener("click", () => importFromLink(true));
  refs.videoLink.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      importFromLink(true);
    }
  });
  $("#mediaContinue").addEventListener("click", () => goToStep(2));
  $$('input[name="sourceLanguage"]').forEach((radio) => radio.addEventListener("change", changeSourceLanguage));

  for (const eventName of ["dragenter", "dragover"]) {
    refs.mediaDrop.addEventListener(eventName, (event) => {
      event.preventDefault();
      refs.mediaDrop.classList.add("is-dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    refs.mediaDrop.addEventListener(eventName, (event) => {
      event.preventDefault();
      refs.mediaDrop.classList.remove("is-dragging");
    });
  }
  refs.mediaDrop.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (isTranscriptFile(file)) loadTranscriptFile(file);
    else loadMediaFile(file);
  });
  refs.mediaDrop.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") refs.mediaInput.click();
  });

  $("#transcribeMedia").addEventListener("click", transcribeMedia);
  $("#addCue").addEventListener("click", addCue);
  $("#goTranslate").addEventListener("click", () => requireCuesThen(3));
  $("#translateAll").addEventListener("click", () => translateAll());
  $("#copySourceToTarget").addEventListener("click", copySourceToTarget);
  $("#clearTranslation").addEventListener("click", clearTranslation);
  $("#speakSpanish").addEventListener("click", speakSpanishNow);
  $("#stopSpeaking").addEventListener("click", () => stopSpeaking(true));
  $("#goVoice").addEventListener("click", () => requireTranslationThen(4));

  $$('input[name="voiceEngine"]').forEach((radio) => radio.addEventListener("change", updateVoiceEngineUI));
  refs.voiceSpeed.addEventListener("input", () => {
    refs.voiceSpeedValue.textContent = `${(Number(refs.voiceSpeed.value) / 100).toFixed(2)}×`;
    scheduleSave();
  });
  $("#checkPiper").addEventListener("click", checkPiper);
  $("#checkWindows").addEventListener("click", checkWindows);
  $("#generateVoice").addEventListener("click", generateSpanishVoice);
  $("#previewSpanishVoice").addEventListener("click", speakSpanishNow);
  $("#playGeneratedAudio").addEventListener("click", playGeneratedAudio);
  $("#stopGeneratedAudio").addEventListener("click", stopGeneratedAudio);
  $("#goExport").addEventListener("click", () => goToStep(5));

  $("#downloadEnglishTxt").addEventListener("click", () => downloadText("ingles", "txt"));
  $("#downloadEnglishSrt").addEventListener("click", () => downloadText("ingles", "srt"));
  $("#exportSpanishTxt").addEventListener("click", () => downloadText("espanol", "txt"));
  $("#exportSpanishSrt").addEventListener("click", () => downloadText("espanol", "srt"));
  $("#exportSpanishVtt").addEventListener("click", () => downloadText("espanol", "vtt"));
  $("#downloadSpanishWav").addEventListener("click", downloadWav);
  $("#exportSpanishWav").addEventListener("click", downloadWav);
  $("#exportDubbedVideo").addEventListener("click", exportDubbedVideo);

  refs.projectTitle.addEventListener("input", () => {
    refs.finalProjectTitle.textContent = refs.projectTitle.value || "Mi video en español";
    scheduleSave();
  });
  refs.cancelTask.addEventListener("click", cancelCurrentTask);
  $("#openHelp").addEventListener("click", () => refs.helpDialog.showModal());
  $("#closeHelp").addEventListener("click", () => refs.helpDialog.close());
  refs.helpDialog.addEventListener("click", (event) => {
    if (event.target === refs.helpDialog) refs.helpDialog.close();
  });
}

function stopThen(callback) {
  return (event) => {
    event.stopPropagation();
    callback();
  };
}

function goToStep(step) {
  if (step < 1 || step > 5) return;
  state.step = step;
  refs.stages.forEach((stage) => stage.classList.toggle("is-active", Number(stage.dataset.stage) === step));
  refs.stepButtons.forEach((button) => button.classList.toggle("is-active", Number(button.dataset.step) === step));
  updateCompletion();
  if (step === 3) renderTranslationRows();
  if (step === 5) updateFinalSummary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function requireCuesThen(step) {
  if (!state.cues.length) return toast("Primero carga o crea una transcripción.", true);
  goToStep(step);
}

function requireTranslationThen(step) {
  if (!state.cues.length || !state.cues.some((cue) => spanishTextForCue(cue))) {
    return toast("Traduce o escribe al menos un segmento en español.", true);
  }
  goToStep(step);
}

function selectedSourceLanguage() {
  return $('input[name="sourceLanguage"]:checked')?.value || "en";
}

function changeSourceLanguage() {
  stopSpeaking(false);
  const spanish = selectedSourceLanguage() === "es";
  if (spanish) {
    state.cues.forEach((cue) => { cue.target = cue.source; });
    refs.translationEngine.value = "copy";
    toast("Modo español activado: el texto se leerá directamente, sin traducir.");
  } else {
    state.cues.forEach((cue) => {
      if (cue.target.trim() === cue.source.trim()) cue.target = "";
    });
    refs.translationEngine.value = "Translator" in self ? "chrome" : "local";
    toast("Modo inglés activado: primero se traducirá al español.");
  }
  clearSpanishAudio();
  updateSourceLanguageUI();
  renderAll();
  checkChromeTranslator();
  scheduleSave();
}

function applySourceLanguageToCues() {
  if (selectedSourceLanguage() === "es") {
    state.cues.forEach((cue) => { cue.target = cue.source; });
  }
}

function updateSourceLanguageUI() {
  const spanish = selectedSourceLanguage() === "es";
  if (spanish) refs.translationEngine.value = "copy";
  $$(".language-switch label").forEach((label) => label.classList.toggle("is-selected", label.querySelector("input").checked));
  refs.transcriptTitle.textContent = spanish ? "Texto original en español" : "Texto original en inglés";
  refs.transcriptDescription.textContent = spanish
    ? "Carga el texto español o transcribe el audio. Luego podrás escucharlo y generar la pista de voz directamente."
    : "Si cargaste subtítulos, aparecerán aquí. Si solo cargaste el video, usa el modelo Whisper local.";
  refs.translationTitle.textContent = spanish ? "Revisión del texto español" : "Traducción y corrección";
  refs.translationDescription.textContent = spanish
    ? "El archivo ya está en español: corrige el texto si hace falta y escúchalo sin pasar por un traductor."
    : "Traduce automáticamente y corrige cualquier frase antes de crear la voz.";
  refs.sourceColumnLabel.textContent = spanish ? "TEXTO ORIGINAL" : "INGLÉS";
  $("#transcribeMedia").textContent = spanish ? "Transcribir español" : "Transcribir inglés";
  $("#translateAll").textContent = spanish ? "Usar texto español" : "Traducir todo";
  $("#goTranslate").innerHTML = spanish ? "Revisar texto español <span>→</span>" : "Traducir al español <span>→</span>";
  refs.translationEngine.disabled = spanish;
}

async function loadMediaFile(file) {
  if (!file) return;
  if (!file.type.startsWith("video/") && !file.type.startsWith("audio/") && !isLikelyMedia(file.name)) {
    return toast("Ese archivo no parece ser video o audio.", true);
  }

  if (state.mediaUrl) URL.revokeObjectURL(state.mediaUrl);
  state.mediaFile = file;
  state.mediaUrl = URL.createObjectURL(file);
  state.mediaKind = file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name) ? "audio" : "video";
  state.mediaDuration = 0;
  clearSpanishAudio();

  const player = state.mediaKind === "video" ? refs.videoPreview : refs.audioSourcePreview;
  const other = state.mediaKind === "video" ? refs.audioSourcePreview : refs.videoPreview;
  other.pause();
  other.removeAttribute("src");
  other.load();
  other.classList.add("is-hidden");
  player.classList.remove("is-hidden");
  player.src = state.mediaUrl;
  player.load();

  refs.mediaCard.classList.remove("is-hidden");
  refs.mediaName.textContent = file.name;
  refs.mediaMeta.textContent = `${formatBytes(file.size)} · leyendo duración…`;
  if (refs.projectTitle.value === "Mi video en español" || !refs.projectTitle.value.trim()) {
    refs.projectTitle.value = `${baseName(file.name)} en español`;
  }

  try {
    await waitForMediaMetadata(player);
    state.mediaDuration = Number.isFinite(player.duration) ? player.duration : 0;
    refs.mediaMeta.textContent = `${state.mediaKind === "video" ? "Video" : "Audio"} · ${formatDuration(state.mediaDuration)} · ${formatBytes(file.size)}`;
    toast("Archivo cargado. Ahora puedes añadir subtítulos o transcribirlo.");
  } catch (_) {
    refs.mediaMeta.textContent = `${formatBytes(file.size)} · Chrome no pudo leer la vista previa`;
    toast("El archivo se cargó, pero Chrome no puede reproducir ese formato. Prueba MP4, WebM, MP3 o WAV.", true);
  }

  renderAll();
  scheduleSave();
}

async function loadTranscriptFile(file) {
  try {
    const text = await readTextFile(file);
    let cues = parseTimedText(text);
    if (!cues.length) cues = cuesFromPlainText(text, state.mediaDuration);
    if (!cues.length) throw new Error("El archivo está vacío o no contiene texto legible.");
    state.cues = normalizeCues(cues);
    applySourceLanguageToCues();
    clearSpanishAudio();
    renderAll();
    scheduleSave();
    goToStep(2);
    toast(`${state.cues.length} segmentos cargados desde ${file.name}.`);
  } catch (error) {
    toast(error.message || "No se pudo leer el archivo.", true);
  } finally {
    refs.subtitleInput.value = "";
  }
}

function usePastedText() {
  const text = refs.pasteText.value.trim();
  if (!text) return toast("Pega algún texto primero.", true);
  const timed = parseTimedText(text);
  state.cues = normalizeCues(timed.length ? timed : cuesFromPlainText(text, state.mediaDuration));
  applySourceLanguageToCues();
  clearSpanishAudio();
  renderAll();
  scheduleSave();
  goToStep(2);
  toast(`${state.cues.length} segmentos creados.`);
}

async function importFromLink(translateToSpanish) {
  const raw = refs.videoLink.value.trim();
  if (!raw) return setLinkStatus("Pega primero un enlace de YouTube, SRT, VTT, TXT, audio o video.", "error");

  resetLinkDiagnostics();

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch (_) {
    return setLinkStatus("El enlace no es válido. Debe comenzar con http:// o https://", "error");
  }

  refs.videoLink.value = url.href;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  state.currentCancel = cancel;
  showTask("Abriendo el enlace", "Solicitando acceso solamente a este sitio…", 3);
  setLinkStatus("Conectando con el enlace…");

  try {
    const youtubeId = getYouTubeVideoId(url);
    let result;
    if (youtubeId) {
      addLinkDiagnostic(`Video reconocido: ${youtubeId}.`);
      await ensureLinkPermissions([url, new URL("https://www.youtube.com/")]);
      addLinkDiagnostic("Chrome concedió acceso a youtube.com para leer las pistas públicas.");
      result = await extractYouTubeCaptions(youtubeId, translateToSpanish, controller.signal);
    } else {
      await ensureLinkPermissions([url]);
      result = await extractGenericLink(url, controller.signal);
    }

    if (result.mediaFile) {
      state.cues = [];
      await loadMediaFile(result.mediaFile);
      completeTask("Archivo descargado desde el enlace", `${result.mediaFile.name} · ${formatBytes(result.mediaFile.size)}`);
      setLinkStatus("Archivo multimedia cargado. Ahora se extraerá el audio para transcribirlo.", "success");
      goToStep(2);
      await transcribeMedia();
      if (translateToSpanish && state.cues.length) {
        await translateAll();
        goToStep(3);
      }
      return;
    }

    if (!result.cues?.length) throw new Error("No encontré texto ni subtítulos aprovechables en ese enlace.");
    setSourceLanguageSilently(result.sourceLanguage || selectedSourceLanguage());
    state.cues = normalizeCues(result.cues);
    if (result.title && (refs.projectTitle.value === "Mi video en español" || /^(YouTube|video)/i.test(refs.projectTitle.value))) {
      refs.projectTitle.value = `${result.title} en español`;
    }
    applySourceLanguageToCues();
    clearSpanishAudio();
    renderAll();
    scheduleSave();

    const readyTranslations = state.cues.filter((cue) => cue.target.trim()).length;
    const translationsComplete = readyTranslations === state.cues.length;
    const detail = `${state.cues.length} segmentos extraídos${readyTranslations ? ` · ${readyTranslations} traducidos` : ""}.`;
    completeTask(translationsComplete ? "Subtítulos extraídos y traducidos" : "Subtítulos extraídos", detail);
    setLinkStatus(detail, "success");

    if (translateToSpanish && selectedSourceLanguage() !== "es" && !translationsComplete) {
      goToStep(3);
      await translateAll({ onlyMissing: readyTranslations > 0 });
      const finalTranslated = state.cues.filter((cue) => cue.target.trim()).length;
      if (finalTranslated === state.cues.length) {
        setLinkStatus(`${state.cues.length} segmentos extraídos y traducidos al español.`, "success");
        addLinkDiagnostic("El traductor gratuito completó los segmentos que faltaban.");
      }
    } else {
      goToStep(translateToSpanish || readyTranslations ? 3 : 2);
      if (translateToSpanish && translationsComplete) toast("La traducción española está lista para revisar o escuchar.");
    }
  } catch (error) {
    if (error?.name === "AbortError") return failTask(new Error("Tarea cancelada."));
    setLinkStatus(friendlyLinkError(error), "error");
    failTask(error);
  } finally {
    if (state.currentCancel === cancel) state.currentCancel = null;
  }
}

function setSourceLanguageSilently(language) {
  const normalized = String(language || "").toLowerCase().startsWith("es") ? "es" : "en";
  $$('input[name="sourceLanguage"]').forEach((radio) => { radio.checked = radio.value === normalized; });
  if (normalized === "es") refs.translationEngine.value = "copy";
  else if (refs.translationEngine.value === "copy") refs.translationEngine.value = "Translator" in self ? "chrome" : "local";
  updateSourceLanguageUI();
  checkChromeTranslator();
}

async function ensureLinkPermissions(urls) {
  if (!chrome.permissions?.contains || !chrome.permissions?.request) return;
  const origins = [...new Set(urls.map(permissionPatternForUrl))];
  const alreadyGranted = await chrome.permissions.contains({ origins });
  if (alreadyGranted) return;
  const granted = await chrome.permissions.request({ origins });
  if (!granted) throw new Error("Permiso rechazado. La extensión necesita leer ese sitio para obtener sus subtítulos.");
}

function permissionPatternForUrl(url) {
  return `${url.protocol}//${url.hostname}/*`;
}

function getYouTubeVideoId(url) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
  if (!["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) return "";
  if (url.searchParams.get("v")) return url.searchParams.get("v");
  const parts = url.pathname.split("/").filter(Boolean);
  if (["shorts", "embed", "live"].includes(parts[0])) return parts[1] || "";
  return "";
}

async function extractYouTubeCaptions(videoId, translateToSpanish, signal) {
  showTask("Buscando subtítulos de YouTube", "Consultando el reproductor actual de YouTube…", 14);
  let tracks = [];
  let title = `YouTube ${videoId}`;
  let pageHtml = "";
  let playerError = null;

  try {
    const playerResult = await fetchYouTubePlayerTracks(videoId, signal);
    tracks = playerResult.tracks;
    title = playerResult.title || title;
    pageHtml = playerResult.pageHtml || "";
  } catch (error) {
    playerError = error;
    addLinkDiagnostic(`El reproductor interno falló: ${friendlyError(error)}`);
  }

  if (!tracks.length) {
    showTask("Buscando subtítulos de YouTube", "Probando el listado público alternativo…", 31);
    tracks = await fetchYouTubeTrackList(videoId, signal);
    addLinkDiagnostic(`Ruta alternativa: ${tracks.length} pista(s) anunciada(s).`);
  }

  if (!tracks.length) {
    addLinkDiagnostic(playerError
      ? "No apareció una pista descargable; todavía se intentará leer el panel oficial del video."
      : "YouTube no anunció pistas descargables; todavía se intentará leer el panel oficial del video.");
  }

  const candidates = orderCaptionTracks(tracks, selectedSourceLanguage());
  const protectedCandidates = candidates.filter(requiresYouTubePoToken);
  const directCandidates = candidates.filter((candidate) => !requiresYouTubePoToken(candidate));
  let track = null;
  let sourceCues = [];

  if (protectedCandidates.length) {
    addLinkDiagnostic(`${protectedCandidates.length} pista(s) exigen PO token; se omiten las descargas repetidas y se usará el panel oficial de transcripción.`);
  }

  for (let index = 0; index < directCandidates.length; index += 1) {
    const candidate = directCandidates[index];
    showTask("Descargando subtítulos de YouTube", `${candidate.label || candidate.languageCode || "Pista"} · intento ${index + 1} de ${directCandidates.length}`, 36 + Math.min(12, index * 4));
    try {
      const cues = await fetchYouTubeCaptionTrack(candidate, videoId, "", signal);
      if (cues.length) {
        track = candidate;
        sourceCues = cues;
        break;
      }
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      addLinkDiagnostic(`No se pudo usar ${candidate.languageCode || "una pista"}: ${friendlyError(error)}`);
    }
  }

  if (!sourceCues.length) {
    showTask("Leyendo la transcripción oficial", "Probando el panel de transcripción de YouTube…", 49);
    try {
      sourceCues = await fetchYouTubeTranscriptPanelApi(videoId, pageHtml, signal);
      if (sourceCues.length) {
        track = transcriptPanelTrack();
        addLinkDiagnostic(`La API del panel oficial entregó ${sourceCues.length} segmentos.`);
      }
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      addLinkDiagnostic(`La API del panel no respondió: ${friendlyError(error)}`);
    }
  }

  if (!sourceCues.length) {
    showTask("Abriendo temporalmente YouTube", "La extensión leerá el panel visible de transcripción y volverá aquí automáticamente…", 52);
    try {
      const rendered = await extractYouTubeTranscriptFromTab(videoId, signal);
      sourceCues = rendered.cues;
      title = rendered.title || title;
      track = transcriptPanelTrack();
      addLinkDiagnostic(`Panel visible leído correctamente: ${sourceCues.length} segmentos. La pestaña temporal se cerró.`);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      addLinkDiagnostic(`No se pudo leer el panel visible: ${friendlyError(error)}`);
    }
  }

  if (!sourceCues.length) throw new Error("YouTube bloqueó la descarga y tampoco permitió abrir su panel de transcripción. Comprueba que el video reproduce y que muestra «Mostrar transcripción», y vuelve a intentarlo.");
  addLinkDiagnostic(`Pista elegida: ${track.languageCode || "idioma desconocido"} · ${sourceCues.length} segmentos.`);
  const sourceLanguage = String(track.languageCode || "en").toLowerCase().startsWith("es") ? "es" : "en";
  let translated = [];

  if (translateToSpanish && sourceLanguage !== "es") {
    const spanishTrack = orderCaptionTracks(tracks, "es").find((candidate) => String(candidate.languageCode || "").toLowerCase().startsWith("es") && !requiresYouTubePoToken(candidate));
    if (spanishTrack) {
      showTask("Obteniendo subtítulos en español", `Pista publicada: ${spanishTrack.label || spanishTrack.languageCode}`, 58);
      try {
        translated = await fetchYouTubeCaptionTrack(spanishTrack, videoId, "", signal);
        if (translated.length) addLinkDiagnostic(`YouTube publicó una pista española con ${translated.length} segmentos.`);
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        addLinkDiagnostic(`La pista española publicada no se pudo leer: ${friendlyError(error)}`);
      }
    }

    if (!translated.length && track.baseUrl && !requiresYouTubePoToken(track)) {
      showTask("Traduciendo los subtítulos de YouTube", "Solicitando la traducción automática al español…", 62);
      try {
        translated = await fetchYouTubeCaptionTrack(track, videoId, "es", signal);
        if (translated.length) addLinkDiagnostic(`YouTube entregó ${translated.length} segmentos traducidos automáticamente al español.`);
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        addLinkDiagnostic(`YouTube no entregó la traducción automática: ${friendlyError(error)} Se usará el traductor gratuito seleccionado.`);
        translated = [];
      }
    }
  }

  const cues = sourceCues.map((cue) => ({ ...cue, target: sourceLanguage === "es" ? cue.source : "" }));
  if (translated.length) alignTranslatedCaptions(cues, translated);
  return { cues, sourceLanguage, title };
}

function transcriptPanelTrack() {
  const languageCode = selectedSourceLanguage();
  return { languageCode, label: "Panel oficial de transcripción", kind: "panel", baseUrl: "" };
}

async function fetchYouTubeTrackList(videoId, signal) {
  try {
    const url = new URL("https://www.youtube.com/api/timedtext");
    url.search = new URLSearchParams({ type: "list", v: videoId }).toString();
    const response = await fetch(url, { signal, credentials: "include" });
    if (!response.ok) return [];
    const xml = await response.text();
    const documentXml = new DOMParser().parseFromString(xml, "text/xml");
    return [...documentXml.querySelectorAll("track")].map((node) => ({
      languageCode: node.getAttribute("lang_code") || "",
      name: node.getAttribute("name") || "",
      kind: node.getAttribute("kind") || "",
      label: node.getAttribute("lang_translated") || node.getAttribute("lang_original") || "",
      isTranslatable: node.getAttribute("cantran") === "true",
      baseUrl: ""
    }));
  } catch (_) {
    return [];
  }
}

async function fetchYouTubePlayerTracks(videoId, signal) {
  const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`, {
    signal,
    credentials: "include",
    headers: { "Accept-Language": "en-US,en;q=0.9" }
  });
  if (!response.ok) throw new Error(`YouTube respondió con el código ${response.status}.`);
  const html = await response.text();
  addLinkDiagnostic(`Página del video recibida (${Math.round(html.length / 1024)} KB).`);

  const initialPlayer = extractYouTubePlayerResponse(html);
  const initialResult = mapYouTubePlayerResult(initialPlayer, html);
  const apiKey = extractYouTubeInnertubeApiKey(html);
  let innerTubeError = null;

  if (apiKey) {
    addLinkDiagnostic("Configuración del reproductor encontrada; consultando las pistas actuales.");
    try {
      const player = await fetchYouTubeInnertubePlayer(videoId, apiKey, signal);
      const result = mapYouTubePlayerResult(player);
      const status = player?.playabilityStatus?.status || "sin estado";
      addLinkDiagnostic(`Reproductor interno: ${status} · ${result.tracks.length} pista(s).`);
      if (result.tracks.length) return { ...result, title: result.title || initialResult.title, pageHtml: html };
      innerTubeError = playerErrorFromStatus(player?.playabilityStatus);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      innerTubeError = error;
      addLinkDiagnostic(`Consulta interna sin resultado: ${friendlyError(error)}`);
    }
  } else {
    const blocked = /g-recaptcha|confirm you(?:'|’|&#39;)re not a bot/i.test(html);
    addLinkDiagnostic(blocked ? "YouTube mostró una comprobación anti-bot." : "La página no incluyó la configuración del reproductor.");
  }

  if (initialResult.tracks.length) {
    addLinkDiagnostic(`Se usaron ${initialResult.tracks.length} pista(s) incluidas directamente en la página.`);
    return { ...initialResult, pageHtml: html };
  }

  if (innerTubeError) throw innerTubeError;
  throw new Error("YouTube no publicó pistas de subtítulos para este video.");
}

async function fetchYouTubeTranscriptPanelApi(videoId, pageHtml, signal) {
  let html = pageHtml;
  if (!html) {
    const pageResponse = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`, {
      signal,
      credentials: "include",
      headers: { "Accept-Language": "en-US,en;q=0.9" }
    });
    if (!pageResponse.ok) throw new Error(`La página del panel respondió con ${pageResponse.status}.`);
    html = await pageResponse.text();
  }

  const apiKey = extractYouTubeInnertubeApiKey(html);
  const initialData = extractYouTubeInitialData(html);
  const endpoint = findYouTubeTranscriptEndpoint(initialData);
  if (!apiKey) throw new Error("La página no incluyó la clave interna del panel.");
  if (!endpoint?.params) throw new Error("El video no anunció un panel de transcripción.");

  const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1] || "2.20250101.00.00";
  const visitorData = html.match(/"VISITOR_DATA"\s*:\s*"([^"]+)"/)?.[1] || "";
  const headers = {
    "Content-Type": "application/json",
    "X-YouTube-Client-Name": "1",
    "X-YouTube-Client-Version": clientVersion
  };
  if (visitorData) headers["X-Goog-Visitor-Id"] = visitorData;

  const context = {
    client: {
      clientName: "WEB",
      clientVersion,
      hl: "en",
      gl: "US",
      originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      ...(visitorData ? { visitorData } : {})
    },
    user: { lockedSafetyMode: false },
    request: { useSsl: true },
    ...(endpoint.clickTrackingParams ? { clickTracking: { clickTrackingParams: endpoint.clickTrackingParams } } : {})
  };
  const response = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${encodeURIComponent(apiKey)}&prettyPrint=false`, {
    method: "POST",
    signal,
    credentials: "include",
    headers,
    body: JSON.stringify({ context, params: endpoint.params })
  });
  if (!response.ok) throw new Error(`El panel interno respondió con ${response.status}.`);

  let data;
  try { data = await response.json(); }
  catch (_) { throw new Error("El panel interno devolvió una respuesta ilegible."); }
  const cues = extractYouTubeTranscriptCues(data);
  if (!cues.length) throw new Error("El panel interno respondió sin segmentos.");
  return cues;
}

function extractYouTubeInitialData(html) {
  const markers = ["var ytInitialData =", "ytInitialData =", '"ytInitialData":'];
  for (const marker of markers) {
    const value = extractJsonValueAfter(html, marker, "{");
    if (value) return value;
  }
  return null;
}

function findYouTubeTranscriptEndpoint(data) {
  const panels = data?.engagementPanels || [];
  for (const panel of panels) {
    const renderer = panel?.engagementPanelSectionListRenderer;
    if (!renderer) continue;
    const panelId = String(renderer.panelIdentifier || renderer.targetId || "").toLowerCase();
    if (!panelId.includes("transcript")) continue;
    const endpoint = renderer.content?.continuationItemRenderer?.continuationEndpoint;
    const params = endpoint?.getTranscriptEndpoint?.params || endpoint?.continuationCommand?.token;
    if (params) return { params, clickTrackingParams: endpoint.clickTrackingParams || "" };
  }

  const stack = [data];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== "object") continue;
    if (value.getTranscriptEndpoint?.params) {
      return { params: value.getTranscriptEndpoint.params, clickTrackingParams: value.clickTrackingParams || "" };
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === "object") stack.push(child);
    }
  }
  return null;
}

function extractYouTubeTranscriptCues(data) {
  const rawCues = [];
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    const renderer = value.transcriptSegmentRenderer || value.transcriptCueRenderer;
    if (renderer) {
      const textValue = renderer.snippet || renderer.cue || {};
      const source = cleanCaptionText(textValue.simpleText || (textValue.runs || []).map((run) => run.text || "").join(""));
      if (source) {
        const startMs = youtubeMilliseconds(renderer.startMs ?? renderer.startTimeMs ?? renderer.startOffsetMs ?? renderer.cue?.startOffsetMs);
        const endMs = youtubeMilliseconds(renderer.endMs ?? renderer.endTimeMs);
        const durationMs = youtubeMilliseconds(renderer.durationMs ?? renderer.cue?.durationMs);
        const timeText = renderer.startTimeText?.simpleText || renderer.startTimeText?.runs?.map((run) => run.text || "").join("") || "";
        const parsedTime = parseTime(timeText);
        rawCues.push({
          source,
          start: Number.isFinite(startMs) ? startMs / 1000 : parsedTime,
          end: Number.isFinite(endMs) ? endMs / 1000 : NaN,
          duration: Number.isFinite(durationMs) ? durationMs / 1000 : NaN
        });
      }
      return;
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === "object") walk(child);
    }
  };
  walk(data);
  return finishYouTubeTranscriptTimings(rawCues);
}

function youtubeMilliseconds(value) {
  if (value === null || value === undefined || value === "") return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function finishYouTubeTranscriptTimings(rawCues) {
  let cursor = 0;
  return rawCues.map((cue, index) => {
    const start = Number.isFinite(cue.start) ? Math.max(0, cue.start) : cursor;
    const nextStart = rawCues.slice(index + 1).map((item) => item.start).find((value) => Number.isFinite(value) && value > start);
    const wordCount = Math.max(1, String(cue.source || "").trim().split(/\s+/).length);
    const estimatedDuration = Math.max(1.2, Math.min(8, wordCount / 2.4 + 0.55));
    let end = Number.isFinite(cue.end) && cue.end > start ? cue.end
      : Number.isFinite(cue.duration) && cue.duration > 0 ? start + cue.duration
        : Number.isFinite(nextStart) && nextStart - start <= 15 ? nextStart
          : start + estimatedDuration;
    end = Math.max(start + 0.2, end);
    cursor = Math.max(cursor, end);
    return { start, end, source: cue.source, target: "" };
  });
}

async function extractYouTubeTranscriptFromTab(videoId, signal) {
  if (!chrome.tabs?.create || !chrome.scripting?.executeScript) {
    throw new Error("Recarga la extensión actualizada para activar la lectura del panel de YouTube.");
  }

  let originalTab = null;
  let temporaryTab = null;
  const closeOnAbort = () => {
    if (temporaryTab?.id !== undefined) chrome.tabs.remove(temporaryTab.id).catch(() => {});
  };
  signal?.addEventListener("abort", closeOnAbort, { once: true });

  try {
    throwIfAborted(signal);
    try { [originalTab] = await chrome.tabs.query({ active: true, currentWindow: true }); }
    catch (_) { originalTab = null; }

    const captionLanguage = selectedSourceLanguage() === "es" ? "es" : "en";
    temporaryTab = await chrome.tabs.create({
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en&autoplay=0&cc_load_policy=1&cc_lang_pref=${captionLanguage}`,
      active: true
    });
    if (temporaryTab?.id === undefined) throw new Error("Chrome no pudo abrir la pestaña temporal de YouTube.");
    await waitForChromeTabComplete(temporaryTab.id, signal, 30000);
    throwIfAborted(signal);

    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: temporaryTab.id },
        world: "ISOLATED",
        func: scrapeYouTubeTranscriptPanel
      });
    } catch (error) {
      throwIfAborted(signal);
      throw error;
    }
    throwIfAborted(signal);
    const result = results?.[0]?.result;
    if (!result?.ok || !result.cues?.length) {
      throw new Error(result?.error || "El panel visible no devolvió texto.");
    }
    return { cues: result.cues, title: result.title || "" };
  } finally {
    signal?.removeEventListener("abort", closeOnAbort);
    if (temporaryTab?.id !== undefined) {
      try { await chrome.tabs.remove(temporaryTab.id); } catch (_) { /* The user may have closed it. */ }
    }
    if (originalTab?.id !== undefined) {
      try { await chrome.tabs.update(originalTab.id, { active: true }); } catch (_) { /* The original tab may be gone. */ }
    }
  }
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Tarea cancelada.");
  error.name = "AbortError";
  throw error;
}

async function waitForChromeTabComplete(tabId, signal, timeoutMs) {
  throwIfAborted(signal);
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.status === "complete") return;
  } catch (_) { /* Continue with the update listener for a newly created tab. */ }

  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") finish();
    };
    const onAbort = () => {
      const error = new Error("Tarea cancelada.");
      error.name = "AbortError";
      finish(error);
    };
    const timer = setTimeout(() => finish(new Error("YouTube tardó demasiado en abrir la pestaña temporal.")), timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

async function scrapeYouTubeTranscriptPanel() {
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const normalizeLabel = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const transcriptLabels = ["show transcript", "open transcript", "mostrar transcripcion", "ver transcripcion", "abrir transcripcion"];
  const segmentSelector = "ytd-transcript-segment-renderer, ytd-transcript-segment-list-renderer ytd-transcript-segment-renderer";

  const segmentNodes = () => [...document.querySelectorAll(segmentSelector)];
  const clickElement = (element) => {
    if (!element) return false;
    const clickable = element.matches?.("button, tp-yt-paper-button, [role='button']")
      ? element
      : element.querySelector?.("button, tp-yt-paper-button, [role='button']") || element;
    clickable.scrollIntoView?.({ block: "center", inline: "nearest" });
    clickable.click();
    return true;
  };
  const findTranscriptButton = () => {
    const specific = document.querySelector(
      "ytd-video-description-transcript-section-renderer ytd-button-renderer button, " +
      "ytd-video-description-transcript-section-renderer button, " +
      "ytd-video-description-transcript-section-renderer tp-yt-paper-button, " +
      "ytd-video-description-transcript-section-renderer ytd-button-renderer"
    );
    if (specific) return specific;
    const buttons = document.querySelectorAll("button, tp-yt-paper-button, ytd-button-renderer, [role='button']");
    for (const button of buttons) {
      const label = normalizeLabel(`${button.getAttribute?.("aria-label") || ""} ${button.textContent || ""}`);
      if (transcriptLabels.some((candidate) => label.includes(candidate))) return button;
    }
    return null;
  };
  const expandDescription = () => {
    const expand = document.querySelector("tp-yt-paper-button#expand, #description #expand, ytd-text-inline-expander #expand");
    return clickElement(expand);
  };
  const waitForSegments = async (timeoutMs) => {
    const startedAt = Date.now();
    let lastCount = 0;
    let stableSince = 0;
    while (Date.now() - startedAt < timeoutMs) {
      const nodes = segmentNodes();
      if (nodes.length) {
        if (nodes.length !== lastCount) {
          lastCount = nodes.length;
          stableSince = Date.now();
        } else if (Date.now() - stableSince >= 900) {
          return nodes;
        }
      }
      await sleep(250);
    }
    throw new Error("El panel tardó demasiado en mostrar los segmentos.");
  };
  const parseTimestamp = (value) => {
    const match = String(value || "").match(/(?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d+)?/);
    if (!match) return NaN;
    const parts = match[0].replace(",", ".").split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return NaN;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return parts[0] * 60 + parts[1];
  };
  const readNode = (node) => {
    const textElement = node.querySelector("#segment-text, .segment-text, yt-formatted-string.segment-text");
    const alternatives = [...node.querySelectorAll("yt-formatted-string")]
      .filter((element) => !/timestamp/i.test(element.id || element.className || ""))
      .map((element) => String(element.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);
    const source = String(textElement?.textContent || alternatives[0] || "").replace(/\s+/g, " ").trim();
    const timestampElement = node.querySelector("#segment-timestamp, .segment-timestamp, [class*='segment-timestamp']");
    const model = node.data || node.__data?.data || {};
    const attributeMs = node.getAttribute("data-start-ms") || node.getAttribute("start-time-ms") || node.getAttribute("data-start-time-ms");
    const modelMs = model.startMs ?? model.startTimeMs ?? model.startOffsetMs;
    const milliseconds = Number(attributeMs ?? modelMs);
    const start = Number.isFinite(milliseconds) ? milliseconds / 1000 : parseTimestamp(timestampElement?.textContent || "");
    return { source, start };
  };

  try {
    const video = document.querySelector("video");
    if (video) { video.muted = true; video.pause(); }

    let nodes = segmentNodes();
    if (!nodes.length) {
      document.querySelector("ytd-watch-metadata #description, #description")?.scrollIntoView?.({ block: "center" });
      let button = null;
      let expanded = false;
      for (let attempt = 0; attempt < 30 && !button; attempt += 1) {
        button = findTranscriptButton();
        if (!button && !expanded) expanded = expandDescription();
        if (!button) await sleep(400);
      }
      if (!button) throw new Error("YouTube no mostró el botón «Mostrar transcripción».");
      clickElement(button);
      nodes = await waitForSegments(18000);
    }

    await sleep(500);
    nodes = segmentNodes();
    const seen = new Set();
    const rawCues = [];
    for (const node of nodes) {
      const cue = readNode(node);
      if (!cue.source) continue;
      const key = `${Number.isFinite(cue.start) ? cue.start : "?"}|${cue.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rawCues.push(cue);
    }
    if (!rawCues.length) throw new Error("El panel se abrió, pero no contenía texto legible.");

    let cursor = 0;
    const cues = rawCues.map((cue, index) => {
      const start = Number.isFinite(cue.start) ? Math.max(0, cue.start) : cursor;
      const nextStart = rawCues.slice(index + 1).map((item) => item.start).find((value) => Number.isFinite(value) && value > start);
      const words = Math.max(1, cue.source.split(/\s+/).length);
      const estimatedDuration = Math.max(1.2, Math.min(8, words / 2.4 + 0.55));
      const end = Number.isFinite(nextStart) && nextStart - start <= 15 ? nextStart : start + estimatedDuration;
      cursor = Math.max(cursor, end);
      return { start, end: Math.max(start + 0.2, end), source: cue.source, target: "" };
    });

    const closeButton = document.querySelector(
      "ytd-engagement-panel-title-header-renderer button[aria-label*='Close' i], " +
      "ytd-engagement-panel-title-header-renderer button[aria-label*='Cerrar' i], " +
      "[target-id*='transcript'] button[aria-label*='Close' i], " +
      "[target-id*='transcript'] button[aria-label*='Cerrar' i]"
    );
    closeButton?.click();
    const title = String(document.title || "").replace(/\s*-\s*YouTube\s*$/i, "").trim();
    return { ok: true, cues, title };
  } catch (error) {
    return { ok: false, error: String(error?.message || error || "No se pudo leer el panel de transcripción.") };
  }
}

async function fetchYouTubeInnertubePlayer(videoId, apiKey, signal) {
  const clientVersion = "20.10.38";
  const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}&prettyPrint=false`, {
    method: "POST",
    signal,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-YouTube-Client-Name": "3",
      "X-YouTube-Client-Version": clientVersion
    },
    body: JSON.stringify({
      context: { client: { clientName: "ANDROID", clientVersion, hl: "en", gl: "US" } },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true
    })
  });
  if (!response.ok) throw new Error(`El reproductor interno respondió con ${response.status}.`);
  try { return await response.json(); }
  catch (_) { throw new Error("El reproductor interno devolvió una respuesta ilegible."); }
}

function extractYouTubeInnertubeApiKey(html) {
  const config = extractJsonValueAfter(html, "ytcfg.set(", "{") || {};
  if (config.INNERTUBE_API_KEY) return config.INNERTUBE_API_KEY;
  return html.match(/"INNERTUBE_API_KEY"\s*:\s*"([a-zA-Z0-9_-]+)"/)?.[1] || "";
}

function mapYouTubePlayerResult(player, html = "") {
  const renderer = player?.captions?.playerCaptionsTracklistRenderer;
  let rawTracks = renderer?.captionTracks || [];
  if (!rawTracks.length && html) rawTracks = extractJsonArrayAfter(html, '"captionTracks":') || [];
  const translationLanguages = (renderer?.translationLanguages || []).map((language) => language.languageCode).filter(Boolean);
  const tracks = rawTracks.map((track) => ({
    languageCode: track.languageCode || "",
    name: track.name?.simpleText || track.name?.runs?.map((run) => run.text).join("") || "",
    kind: track.kind || "",
    label: track.name?.simpleText || track.languageCode || "",
    isTranslatable: Boolean(track.isTranslatable),
    baseUrl: track.baseUrl || ""
  })).filter((track) => track.baseUrl || track.languageCode);
  return { tracks, title: player?.videoDetails?.title || "", translationLanguages };
}

function playerErrorFromStatus(status = {}) {
  const reason = status?.reason || status?.messages?.join(" ") || "";
  if (/not a bot|sign in to confirm/i.test(reason)) return new Error("YouTube pidió verificar que no eres un robot. Abre el video en YouTube, comprueba que reproduce y vuelve a intentarlo.");
  if (/age|inappropriate|edad/i.test(reason)) return new Error("El video tiene restricción de edad y YouTube no entregó sus subtítulos a la extensión.");
  if (/unavailable|private|no está disponible|privado/i.test(reason)) return new Error("El video no está disponible públicamente.");
  return new Error(reason ? `YouTube respondió: ${reason}` : "YouTube no publicó pistas de subtítulos para este video.");
}

function extractYouTubePlayerResponse(html) {
  const markers = ["ytInitialPlayerResponse =", '"ytInitialPlayerResponse":', "ytInitialPlayerResponse\" :"];
  for (const marker of markers) {
    const value = extractJsonValueAfter(html, marker, "{");
    if (value) return value;
  }
  return null;
}

function extractJsonArrayAfter(text, marker) {
  return extractJsonValueAfter(text, marker, "[");
}

function extractJsonValueAfter(text, marker, openingCharacter) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = text.indexOf(openingCharacter, markerIndex + marker.length);
  if (start < 0) return null;
  const closingCharacter = openingCharacter === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; continue; }
    if (character === openingCharacter) depth += 1;
    else if (character === closingCharacter) {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, index + 1)); } catch (_) { return null; }
      }
    }
  }
  return null;
}

function chooseCaptionTrack(tracks, preferredLanguage) {
  if (!tracks?.length) return null;
  const preferred = String(preferredLanguage || "en").slice(0, 2).toLowerCase();
  const matches = tracks.filter((track) => String(track.languageCode || "").toLowerCase().startsWith(preferred));
  const pool = matches.length ? matches : tracks;
  return pool.find((track) => track.kind !== "asr") || pool[0];
}

function orderCaptionTracks(tracks, preferredLanguage) {
  const preferred = String(preferredLanguage || "en").slice(0, 2).toLowerCase();
  return [...(tracks || [])].sort((left, right) => {
    const score = (track) => {
      const languagePenalty = String(track.languageCode || "").toLowerCase().startsWith(preferred) ? 0 : 10;
      const automaticPenalty = track.kind === "asr" ? 1 : 0;
      const missingUrlPenalty = track.baseUrl ? 0 : 2;
      return languagePenalty + automaticPenalty + missingUrlPenalty;
    };
    return score(left) - score(right);
  });
}

function requiresYouTubePoToken(track) {
  return /(?:[?&])exp=xpe(?:[&#]|$)/i.test(String(track?.baseUrl || ""));
}

async function fetchYouTubeCaptionTrack(track, videoId, targetLanguage, signal) {
  let baseUrl;
  if (track.baseUrl) {
    baseUrl = removeYouTubeCaptionFormat(track.baseUrl);
    if (targetLanguage) baseUrl = appendUrlParameter(baseUrl, "tlang", targetLanguage);
  } else {
    const url = new URL("https://www.youtube.com/api/timedtext");
    url.searchParams.set("v", videoId);
    url.searchParams.set("lang", track.languageCode);
    if (track.name) url.searchParams.set("name", track.name);
    if (track.kind) url.searchParams.set("kind", track.kind);
    if (targetLanguage) url.searchParams.set("tlang", targetLanguage);
    baseUrl = url.href;
  }

  const attempts = [baseUrl, appendUrlParameter(baseUrl, "fmt", "json3")];
  let lastError = null;
  for (const attempt of [...new Set(attempts)]) {
    const url = new URL(attempt);
    await ensureLinkPermissions([url]);
    try {
      const response = await fetch(url, { signal, credentials: "include" });
      if (!response.ok) {
        lastError = new Error(`La pista respondió con ${response.status}.`);
        continue;
      }
      const body = await response.text();
      const cues = parseCaptionPayload(body);
      if (cues.length) return cues;
      lastError = new Error(body.trim() ? "La pista llegó en un formato no reconocido." : "La pista llegó vacía.");
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = error;
    }
  }
  if (/([?&])exp=xpe(?:&|$)/.test(baseUrl)) {
    throw new Error("YouTube exige una comprobación adicional para esta pista (PO token).");
  }
  throw lastError || new Error("No se pudo leer la pista de subtítulos.");
}

function removeYouTubeCaptionFormat(url) {
  return String(url)
    .replace(/([?&])fmt=srv3(?=&|$)/, (match, separator) => separator === "?" ? "?" : "")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
}

function appendUrlParameter(url, name, value) {
  const separator = String(url).includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
}

function parseCaptionPayload(body) {
  const text = String(body || "").trim();
  if (!text) return [];
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json.events)) {
      return json.events.map((event) => {
        const source = cleanCaptionText((event.segs || []).map((segment) => segment.utf8 || "").join(""));
        const start = Number(event.tStartMs) / 1000;
        const duration = Math.max(0.2, Number(event.dDurationMs || 3000) / 1000);
        return { start, end: start + duration, source, target: "" };
      }).filter((cue) => Number.isFinite(cue.start) && cue.source);
    }
  } catch (_) { /* It may be VTT or XML. */ }
  const timed = parseTimedText(text);
  if (timed.length) return timed;
  const xml = new DOMParser().parseFromString(text, "text/xml");
  const nodes = [...xml.querySelectorAll("text, p")];
  return nodes.map((node) => {
    const start = Number(node.getAttribute("start") ?? node.getAttribute("t") / 1000);
    const duration = Number(node.getAttribute("dur") ?? node.getAttribute("d") / 1000) || 3;
    return { start, end: start + duration, source: cleanCaptionText(node.textContent), target: "" };
  }).filter((cue) => Number.isFinite(cue.start) && cue.source);
}

function alignTranslatedCaptions(sourceCues, translatedCues) {
  for (const cue of sourceCues) {
    let matches = translatedCues.filter((translated) => Math.min(cue.end, translated.end) - Math.max(cue.start, translated.start) > 0.08);
    if (!matches.length) {
      const nearest = translatedCues.reduce((best, item) => !best || Math.abs(item.start - cue.start) < Math.abs(best.start - cue.start) ? item : best, null);
      if (nearest && Math.abs(nearest.start - cue.start) < 2) matches = [nearest];
    }
    cue.target = [...new Set(matches.map((item) => item.source.trim()).filter(Boolean))].join(" ");
  }
}

async function extractGenericLink(url, signal) {
  showTask("Leyendo el enlace", `Conectando con ${url.hostname}…`, 20);
  const response = await fetch(url, { signal, credentials: "include" });
  if (!response.ok) throw new Error(`El sitio respondió con el código ${response.status}.`);
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const contentLength = Number(response.headers.get("content-length")) || 0;

  if (contentType.startsWith("video/") || contentType.startsWith("audio/") || isLikelyMedia(url.pathname)) {
    if (contentLength > 750 * 1024 * 1024) throw new Error("El archivo supera 750 MB. Descárgalo normalmente y súbelo desde el equipo.");
    showTask("Descargando el archivo", contentLength ? formatBytes(contentLength) : "El sitio no informó el tamaño…", 42);
    const blob = await response.blob();
    if (blob.size > 750 * 1024 * 1024) throw new Error("El archivo supera 750 MB. Súbelo manualmente para evitar llenar la memoria de Chrome.");
    const filename = filenameFromLink(url, contentType);
    return { mediaFile: new File([blob], filename, { type: contentType.split(";")[0] || blob.type }) };
  }

  const buffer = await response.arrayBuffer();
  const text = decodeTextBuffer(buffer);
  const directText = isSubtitleUrl(url) || /text\/(plain|vtt)|application\/(x-subrip|vtt)/i.test(contentType);
  if (directText) {
    const cues = parseLinkedTranscript(text);
    return { cues, sourceLanguage: selectedSourceLanguage(), title: baseName(filenameFromLink(url, contentType)) };
  }

  if (/text\/html|application\/xhtml/i.test(contentType) || /<html|<track/i.test(text.slice(0, 2000))) {
    const documentHtml = new DOMParser().parseFromString(text, "text/html");
    const tracks = [...documentHtml.querySelectorAll("track[src]")].map((track) => ({
      url: new URL(track.getAttribute("src"), url),
      languageCode: track.getAttribute("srclang") || "",
      kind: track.getAttribute("kind") || "subtitles",
      label: track.getAttribute("label") || ""
    }));
    if (!tracks.length) throw new Error("La página no publica una pista SRT/VTT. Si el video tiene voz, descarga el archivo y usa Transcribir.");
    const chosen = chooseCaptionTrack(tracks, selectedSourceLanguage());
    await ensureLinkPermissions([chosen.url]);
    showTask("Descargando subtítulos", chosen.label || chosen.url.hostname, 58);
    const trackResponse = await fetch(chosen.url, { signal, credentials: "include" });
    if (!trackResponse.ok) throw new Error(`La pista de subtítulos respondió con ${trackResponse.status}.`);
    const cues = parseLinkedTranscript(decodeTextBuffer(await trackResponse.arrayBuffer()));
    const language = String(chosen.languageCode || selectedSourceLanguage()).toLowerCase().startsWith("es") ? "es" : "en";
    return { cues, sourceLanguage: language, title: documentHtml.title || baseName(filenameFromLink(url, contentType)) };
  }

  throw new Error("El enlace no contiene subtítulos reconocibles. Usa un enlace SRT/VTT/TXT o sube el video.");
}

function parseLinkedTranscript(text) {
  const timed = parseTimedText(text);
  if (timed.length) return timed;
  const xmlTimed = parseCaptionPayload(text);
  if (xmlTimed.length) return xmlTimed;
  return cuesFromPlainText(text, 0);
}

function decodeTextBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = new Uint8Array(bytes.length - 2);
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      swapped[index - 2] = bytes[index + 1];
      swapped[index - 1] = bytes[index];
    }
    return new TextDecoder("utf-16le").decode(swapped);
  }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, ""); }
  catch (_) { return new TextDecoder("windows-1252").decode(bytes); }
}

function filenameFromLink(url, contentType) {
  const pathname = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "archivo");
  if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return pathname;
  const extension = contentType.startsWith("video/") ? contentType.split("/")[1].split(";")[0]
    : contentType.startsWith("audio/") ? contentType.split("/")[1].split(";")[0]
      : "txt";
  return `${pathname}.${extension.replace("mpeg", "mp3").replace("quicktime", "mov")}`;
}

function isSubtitleUrl(url) {
  return /\.(srt|vtt|txt|md)(?:$|[?#])/i.test(url.href);
}

function setLinkStatus(message, type = "") {
  refs.linkSupport.textContent = message;
  refs.linkSupport.classList.toggle("is-error", type === "error");
  refs.linkSupport.classList.toggle("is-success", type === "success");
  if (type === "error" && refs.linkDiagnosticText?.children.length) refs.linkDiagnostics.open = true;
}

function resetLinkDiagnostics() {
  if (!refs.linkDiagnostics || !refs.linkDiagnosticText) return;
  refs.linkDiagnosticText.replaceChildren();
  refs.linkDiagnostics.classList.add("is-hidden");
  refs.linkDiagnostics.open = false;
}

function addLinkDiagnostic(message) {
  if (!refs.linkDiagnostics || !refs.linkDiagnosticText || !message) return;
  const item = document.createElement("li");
  item.textContent = message;
  refs.linkDiagnosticText.append(item);
  refs.linkDiagnostics.classList.remove("is-hidden");
}

function friendlyLinkError(error) {
  const message = friendlyError(error);
  if (/Failed to fetch|NetworkError/i.test(String(error?.message || ""))) {
    return "El sitio bloqueó la lectura del enlace. Prueba un enlace directo SRT/VTT o descarga el archivo y súbelo.";
  }
  return message;
}

async function readTextFile(file) {
  return decodeTextBuffer(await file.arrayBuffer());
}

function parseTimedText(rawText) {
  const text = String(rawText || "").replace(/^\uFEFF/, "").replace(/\r/g, "").replace(/^WEBVTT[^\n]*\n+/i, "").trim();
  if (!text.includes("-->")) return [];

  const blocks = text.split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    let lines = block.split("\n").map((line) => line.trim());
    if (/^\d+$/.test(lines[0])) lines.shift();
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const timing = lines[timingIndex].split("-->");
    const start = parseTime(timing[0]);
    const end = parseTime((timing[1] || "").trim().split(/\s+/)[0]);
    const cueText = cleanCaptionText(lines.slice(timingIndex + 1).join(" "));
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && cueText) {
      cues.push({ start, end, source: cueText, target: "" });
    }
  }
  return cues;
}

function cuesFromPlainText(rawText, mediaDuration = 0) {
  const clean = String(rawText || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n{2,}/).map((part) => part.replace(/\n/g, " ").trim()).filter(Boolean);
  const segments = [];
  for (const paragraph of paragraphs) {
    const sentences = segmentSentences(paragraph);
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);
      if (words.length <= 22) segments.push(sentence);
      else {
        for (let index = 0; index < words.length; index += 18) segments.push(words.slice(index, index + 18).join(" "));
      }
    }
  }

  let cursor = 0;
  const cues = segments.map((source) => {
    const wordCount = countWords(source);
    const duration = clamp(wordCount / 2.35 + 0.75, 2.2, 9);
    const cue = { start: cursor, end: cursor + duration, source, target: "" };
    cursor += duration + 0.18;
    return cue;
  });

  if (mediaDuration > 1 && cursor > 0) {
    const scale = mediaDuration / cursor;
    for (const cue of cues) {
      cue.start *= scale;
      cue.end *= scale;
    }
  }
  return cues;
}

function segmentSentences(text) {
  if ("Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    return [...segmenter.segment(text)].map((item) => item.segment.trim()).filter(Boolean);
  }
  return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter(Boolean) || [text];
}

function cleanCaptionText(text) {
  const withoutTags = String(text || "").replace(/<[^>]+>/g, "");
  const parsed = new DOMParser().parseFromString(`<body>${withoutTags}</body>`, "text/html");
  return parsed.documentElement.textContent.replace(/\s+/g, " ").trim();
}

function normalizeCues(cues) {
  return cues.map((cue, index) => {
    const start = Math.max(0, Number(cue.start) || 0);
    const end = Math.max(start + 0.2, Number(cue.end) || start + 4);
    return {
      id: cue.id || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      start,
      end,
      source: String(cue.source ?? cue.text ?? "").trim(),
      target: String(cue.target || "").trim()
    };
  }).filter((cue) => cue.source || cue.target).sort((a, b) => a.start - b.start);
}

function renderAll() {
  renderSourceRows();
  renderTranslationRows();
  updateMetrics();
  updateCompletion();
  updateFinalSummary();
  refs.mediaCard.classList.toggle("is-hidden", !state.mediaFile);
  refs.generatedAudioCard.classList.toggle("is-hidden", !state.spanishAudioBlob);
}

function renderSourceRows() {
  refs.sourceRows.replaceChildren();
  refs.sourceEmpty.classList.toggle("is-hidden", state.cues.length > 0);
  for (const [index, cue] of state.cues.entries()) {
    const row = document.createElement("div");
    row.className = "cue-row source-row";

    const time = document.createElement("div");
    time.className = "time-editor";
    const start = timeInput(cue.start, (value) => updateCueTime(index, "start", value));
    const arrow = document.createElement("span");
    arrow.textContent = "→";
    const end = timeInput(cue.end, (value) => updateCueTime(index, "end", value));
    time.append(start, arrow, end);

    const textarea = document.createElement("textarea");
    textarea.value = cue.source;
    textarea.setAttribute("aria-label", `Texto original del segmento ${index + 1}`);
    textarea.addEventListener("input", () => {
      const previousSource = state.cues[index].source;
      state.cues[index].source = textarea.value;
      if (selectedSourceLanguage() === "es" && (!state.cues[index].target.trim() || state.cues[index].target === previousSource)) {
        state.cues[index].target = textarea.value;
      }
      clearSpanishAudio();
      updateMetrics();
      scheduleSave();
    });

    const remove = document.createElement("button");
    remove.className = "delete-cue";
    remove.type = "button";
    remove.title = "Eliminar segmento";
    remove.textContent = "×";
    remove.addEventListener("click", () => deleteCue(index));
    row.append(time, textarea, remove);
    refs.sourceRows.append(row);
  }
}

function renderTranslationRows() {
  refs.translationRows.replaceChildren();
  refs.translationEmpty.classList.toggle("is-hidden", state.cues.length > 0);
  for (const [index, cue] of state.cues.entries()) {
    const row = document.createElement("div");
    row.className = "cue-row translation-row";
    const time = document.createElement("div");
    time.className = "time-label";
    time.textContent = `${formatCueTime(cue.start)} → ${formatCueTime(cue.end)}`;
    const source = document.createElement("textarea");
    source.className = "source-readonly";
    source.readOnly = true;
    source.value = cue.source;
    const target = document.createElement("textarea");
    target.placeholder = "Traducción al español…";
    target.value = cue.target;
    target.setAttribute("aria-label", `Traducción del segmento ${index + 1}`);
    target.addEventListener("input", () => {
      state.cues[index].target = target.value;
      clearSpanishAudio();
      updateMetrics();
      updateCompletion();
      scheduleSave();
    });
    row.append(time, source, target);
    refs.translationRows.append(row);
  }
}

function timeInput(value, onChange) {
  const input = document.createElement("input");
  input.value = formatCueTime(value);
  input.setAttribute("aria-label", "Tiempo del segmento");
  input.addEventListener("change", () => onChange(parseTime(input.value)));
  return input;
}

function updateCueTime(index, field, value) {
  if (!Number.isFinite(value)) {
    renderSourceRows();
    return toast("Escribe el tiempo como 1:23.500 o 83.5.", true);
  }
  state.cues[index][field] = Math.max(0, value);
  if (state.cues[index].end <= state.cues[index].start) state.cues[index].end = state.cues[index].start + 0.5;
  clearSpanishAudio();
  renderAll();
  scheduleSave();
}

function addCue() {
  const last = state.cues.at(-1);
  const start = last ? last.end + 0.1 : 0;
  state.cues.push({ id: `${Date.now()}-new`, start, end: start + 4, source: "", target: "" });
  renderAll();
  scheduleSave();
}

function deleteCue(index) {
  state.cues.splice(index, 1);
  clearSpanishAudio();
  renderAll();
  scheduleSave();
}

function updateMetrics() {
  refs.cueCount.textContent = state.cues.length;
  refs.sourceWordCount.textContent = state.cues.reduce((sum, cue) => sum + countWords(cue.source), 0);
  refs.translatedCount.textContent = state.cues.filter((cue) => cue.target.trim()).length;
  refs.spanishWordCount.textContent = state.cues.reduce((sum, cue) => sum + countWords(cue.target), 0);
}

function updateCompletion() {
  const completed = {
    1: Boolean(state.mediaFile || state.cues.length),
    2: state.cues.length > 0,
    3: state.cues.length > 0 && state.cues.every((cue) => cue.target.trim()),
    4: Boolean(state.spanishAudioBlob),
    5: false
  };
  refs.stepButtons.forEach((button) => button.classList.toggle("is-complete", completed[Number(button.dataset.step)]));
}

function updateFinalSummary() {
  refs.finalProjectTitle.textContent = refs.projectTitle.value || "Mi video en español";
  const translated = state.cues.filter((cue) => cue.target.trim()).length;
  const pieces = [`${translated}/${state.cues.length} segmentos en español`];
  pieces.push(state.spanishAudioBlob ? "voz lista" : "voz pendiente");
  pieces.push(state.mediaKind === "video" ? "video disponible" : "sin video para combinar");
  refs.finalSummaryText.textContent = pieces.join(" · ");
  $("#exportSpanishWav").disabled = !state.spanishAudioBlob;
  $("#exportDubbedVideo").disabled = !(state.mediaKind === "video" && state.spanishAudioBlob);
}

async function transcribeMedia() {
  if (!state.mediaFile) return toast("Primero sube un video o audio.", true);
  const language = selectedSourceLanguage();
  showTask("Preparando el audio", "Intentando leer la pista de sonido…", 3);
  try {
    const audio = await extractAudio16k(state.mediaFile);
    showTask(`Transcribiendo el ${language === "es" ? "español" : "inglés"}`, "Cargando Whisper local…", 46);
    const result = await localAI.run("transcribe", { audio: audio.buffer, language }, {
      transfer: [audio.buffer],
      onProgress: updateTaskFromAI
    });
    const chunks = result.chunks || [];
    if (!chunks.length) throw new Error("Whisper no encontró voz comprensible en el archivo.");
    state.cues = normalizeCues(chunks.map((chunk) => ({ ...chunk, source: chunk.text, target: "" })));
    applySourceLanguageToCues();
    clearSpanishAudio();
    renderAll();
    scheduleSave();
    completeTask("Transcripción lista", `${state.cues.length} segmentos encontrados.`);
    toast("Transcripción terminada. Revisa el inglés antes de traducir.");
  } catch (error) {
    failTask(error);
  }
}

async function extractAudio16k(file) {
  const context = new AudioContext();
  let cancelled = false;
  state.currentCancel = () => {
    cancelled = true;
    context.close();
  };
  try {
    await context.resume();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    showTask("Preparando el audio", "Convirtiendo a mono, 16 kHz…", 35);
    return audioBufferToMono16k(decoded);
  } catch (directError) {
    if (cancelled) throw new Error("Tarea cancelada.");
    try { await context.close(); } catch (_) { /* ignore */ }
    toast("Chrome no pudo separar el audio directamente; lo capturará mientras reproduce el archivo.");
    return await captureAudioInRealTime(file);
  } finally {
    try { await context.close(); } catch (_) { /* ignore */ }
    state.currentCancel = null;
  }
}

function audioBufferToMono16k(buffer) {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) mono[index] += data[index] / buffer.numberOfChannels;
  }
  return resampleLinear(mono, buffer.sampleRate, 16000);
}

async function captureAudioInRealTime(file) {
  const element = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
  const url = URL.createObjectURL(file);
  element.src = url;
  element.preload = "auto";
  element.playsInline = true;
  element.style.cssText = "position:fixed;width:1px;height:1px;opacity:.001;pointer-events:none;left:-10px;bottom:0";
  document.body.append(element);
  await waitForMediaMetadata(element);

  if (!Number.isFinite(element.duration) || !element.duration) throw new Error("Chrome no puede leer el audio de ese formato.");
  const context = new AudioContext();
  await context.resume();
  const source = context.createMediaElementSource(element);
  const processor = context.createScriptProcessor(4096, 2, 1);
  const silence = context.createGain();
  silence.gain.value = 0;
  const chunks = [];
  source.connect(processor);
  processor.connect(silence);
  silence.connect(context.destination);

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer;
    const mono = new Float32Array(input.length);
    for (let channel = 0; channel < input.numberOfChannels; channel += 1) {
      const data = input.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1) mono[index] += data[index] / input.numberOfChannels;
    }
    chunks.push(mono);
  };

  let cancelled = false;
  let progressTimer = 0;
  state.currentCancel = () => {
    cancelled = true;
    element.pause();
  };

  try {
    await new Promise((resolve, reject) => {
      element.addEventListener("ended", resolve, { once: true });
      element.addEventListener("error", () => reject(new Error("No se pudo reproducir el audio para transcribirlo.")), { once: true });
      progressTimer = setInterval(() => {
        if (cancelled) {
          clearInterval(progressTimer);
          reject(new Error("Tarea cancelada."));
          return;
        }
        const percent = element.duration ? Math.round((element.currentTime / element.duration) * 38) : 0;
        showTask("Capturando el audio", `Reproduciendo sin sonido: ${formatDuration(element.currentTime)} de ${formatDuration(element.duration)}`, Math.max(3, percent));
        if (element.ended) clearInterval(progressTimer);
      }, 500);
      element.play().catch(reject);
    });
  } finally {
    clearInterval(progressTimer);
    processor.disconnect();
    source.disconnect();
    await context.close();
    element.remove();
    URL.revokeObjectURL(url);
    state.currentCancel = null;
  }

  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const joined = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return resampleLinear(joined, context.sampleRate, 16000);
}

async function checkChromeTranslator() {
  if (selectedSourceLanguage() === "es") {
    refs.translationEngine.value = "copy";
    setTranslatorNotice(true, "El archivo ya está en español", "No se traducirá: puedes corregirlo y pulsar Escuchar español o Crear voz.");
    return;
  }
  if (!("Translator" in self)) {
    if (refs.translationEngine.value === "chrome") refs.translationEngine.value = "local";
    setTranslatorNotice(false, "Traductor integrado no disponible", "Usaremos el modelo local alternativo. Chrome 138 o superior activa la opción integrada.");
    return;
  }
  try {
    const availability = await Translator.availability({ sourceLanguage: "en", targetLanguage: "es" });
    if (selectedSourceLanguage() === "es") {
      refs.translationEngine.value = "copy";
      setTranslatorNotice(true, "El archivo ya está en español", "No se traducirá: puedes corregirlo y pulsar Escuchar español o Crear voz.");
      return;
    }
    if (availability === "unavailable") {
      if (refs.translationEngine.value === "chrome") refs.translationEngine.value = "local";
      setTranslatorNotice(false, "El paquete inglés → español no está disponible", "Seleccionamos el modelo local alternativo.");
    } else {
      const needsDownload = availability !== "available";
      setTranslatorNotice(true, needsDownload ? "Traductor de Chrome listo para descargar" : "Traductor local de Chrome disponible", needsDownload ? "Chrome descargará el paquete de idioma al pulsar Traducir todo." : "La traducción puede ejecutarse dentro del navegador.");
    }
  } catch (_) {
    if (selectedSourceLanguage() === "es") {
      refs.translationEngine.value = "copy";
      setTranslatorNotice(true, "El archivo ya está en español", "No hace falta descargar un traductor para leerlo o generar la voz.");
      return;
    }
    if (refs.translationEngine.value === "chrome") refs.translationEngine.value = "local";
    setTranslatorNotice(false, "No se pudo comprobar el traductor de Chrome", "El modelo local alternativo sigue disponible.");
  }
}

function setTranslatorNotice(success, title, detail) {
  refs.translatorNotice.classList.toggle("is-warning", !success);
  refs.translatorStatus.textContent = title;
  refs.translatorDetail.textContent = detail;
}

async function translateAll({ onlyMissing = false } = {}) {
  if (!state.cues.length) return toast("Primero necesitas cargar o crear una transcripción.", true);
  if (selectedSourceLanguage() === "es") {
    state.cues.forEach((cue) => { cue.target = cue.source; });
    clearSpanishAudio();
    renderAll();
    scheduleSave();
    toast("El texto español está listo para escucharse.");
    return;
  }
  const engine = refs.translationEngine.value;
  if (engine === "copy") {
    copySourceToTarget();
    return;
  }

  const cueIndexes = state.cues
    .map((cue, index) => ({ cue, index }))
    .filter(({ cue }) => !onlyMissing || !cue.target.trim())
    .map(({ index }) => index);
  if (!cueIndexes.length) return toast("Todos los segmentos ya tienen texto en español.");
  const texts = cueIndexes.map((index) => state.cues[index].source);

  showTask(onlyMissing ? "Completando la traducción" : "Traduciendo al español", onlyMissing ? `${cueIndexes.length} segmento(s) sin español…` : "Preparando el motor gratuito…", 3);
  try {
    let translations;
    if (engine === "chrome") {
      try {
        translations = await translateWithChrome(texts);
      } catch (chromeError) {
        refs.translationEngine.value = "local";
        addLinkDiagnostic(`El traductor integrado de Chrome falló: ${friendlyError(chromeError)} Se activó automáticamente el modelo local.`);
        showTask("Cambiando al traductor local", "Chrome no pudo traducir; descargando o abriendo el modelo gratuito alternativo…", 4);
        translations = await localAI.run("translate", { texts }, { onProgress: updateTaskFromAI });
      }
    } else {
      translations = await localAI.run("translate", { texts }, { onProgress: updateTaskFromAI });
    }
    cueIndexes.forEach((cueIndex, translationIndex) => {
      state.cues[cueIndex].target = translations[translationIndex] || state.cues[cueIndex].target;
    });
    clearSpanishAudio();
    renderAll();
    scheduleSave();
    completeTask("Traducción lista", `${translations.filter(Boolean).length} segmentos en español.`);
    toast("Traducción terminada. Puedes corregir cualquier frase.");
  } catch (error) {
    failTask(error);
  }
}

async function translateWithChrome(texts) {
  if (!("Translator" in self)) throw new Error("Tu versión de Chrome no incluye el traductor integrado.");
  const translator = await Translator.create({
    sourceLanguage: "en",
    targetLanguage: "es",
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", (event) => {
        const value = Number(event.loaded);
        const percentage = Number.isFinite(value) ? Math.round(value * 45) : 12;
        showTask("Descargando el idioma español", "Chrome guarda este paquete para volver a usarlo.", Math.max(5, percentage));
      });
    }
  });

  const output = [];
  for (let index = 0; index < texts.length; index += 1) {
    showTask("Traduciendo al español", `Segmento ${index + 1} de ${texts.length}…`, 45 + Math.round(((index + 1) / texts.length) * 53));
    output.push(texts[index].trim() ? await translator.translate(texts[index]) : "");
  }
  translator.destroy?.();
  return output;
}

function copySourceToTarget() {
  if (!state.cues.length) return toast("No hay texto para copiar.", true);
  state.cues.forEach((cue) => { cue.target = cue.source; });
  clearSpanishAudio();
  renderAll();
  scheduleSave();
  toast("El texto original se copió a la columna española.");
}

function clearTranslation() {
  if (!state.cues.some((cue) => cue.target)) return;
  if (!confirm("¿Borrar toda la traducción española?")) return;
  state.cues.forEach((cue) => { cue.target = ""; });
  clearSpanishAudio();
  renderAll();
  scheduleSave();
}

function spanishTextForCue(cue) {
  const translated = String(cue?.target || "").trim();
  if (translated) return translated;
  return selectedSourceLanguage() === "es" ? String(cue?.source || "").trim() : "";
}

function speakSpanishNow() {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    return toast("Este navegador no ofrece lectura de voz. Usa Chrome actualizado o genera la pista WAV.", true);
  }
  const texts = state.cues.map(spanishTextForCue).filter(Boolean);
  if (!texts.length) return toast("Todavía no hay texto español para leer.", true);

  stopGeneratedAudio();
  window.speechSynthesis.cancel();
  const run = ++state.speechRun;
  state.isSpeaking = true;
  setSpeechButtons(true);
  const voices = window.speechSynthesis.getVoices();
  const voice = chooseSpanishSystemVoice(voices);
  const rate = clamp(Number(refs.voiceSpeed.value) / 100, 0.85, 1.3);
  let index = 0;

  const speakNext = () => {
    if (run !== state.speechRun || index >= texts.length) {
      if (run === state.speechRun) finishSpeaking();
      return;
    }
    const utterance = new window.SpeechSynthesisUtterance(texts[index]);
    utterance.lang = voice?.lang || "es-MX";
    utterance.voice = voice || null;
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => {
      index += 1;
      speakNext();
    };
    utterance.onerror = (event) => {
      if (["canceled", "interrupted"].includes(event.error)) return;
      finishSpeaking();
      toast("La voz del sistema no pudo leer este segmento. Prueba Generar voz española.", true);
    };
    window.speechSynthesis.speak(utterance);
  };

  toast(`Leyendo ${texts.length} segmento${texts.length === 1 ? "" : "s"} en español.`);
  speakNext();
}

function chooseSpanishSystemVoice(voices) {
  const spanish = voices.filter((voice) => /^es([_-]|$)/i.test(voice.lang));
  return spanish.find((voice) => /^es[-_]SV$/i.test(voice.lang) && voice.localService)
    || spanish.find((voice) => /^es[-_](MX|US)$/i.test(voice.lang) && voice.localService)
    || spanish.find((voice) => voice.localService)
    || spanish[0]
    || null;
}

function stopSpeaking(showMessage = false) {
  const wasSpeaking = state.isSpeaking;
  state.speechRun += 1;
  state.isSpeaking = false;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  setSpeechButtons(false);
  if (showMessage && wasSpeaking) toast("Lectura detenida.");
}

function finishSpeaking() {
  state.isSpeaking = false;
  setSpeechButtons(false);
}

function setSpeechButtons(speaking) {
  $("#speakSpanish").textContent = speaking ? "● Leyendo español…" : "▶ Escuchar español";
  $("#previewSpanishVoice").textContent = speaking ? "● Leyendo…" : "▶ Escuchar texto ahora";
}

async function playGeneratedAudio() {
  if (!state.spanishAudioBlob) return toast("Primero genera la pista de voz española.", true);
  stopSpeaking(false);
  if (refs.spanishAudioPreview.ended) refs.spanishAudioPreview.currentTime = 0;
  try {
    await refs.spanishAudioPreview.play();
  } catch (_) {
    toast("Chrome no pudo iniciar el audio. Pulsa el botón de reproducción del reproductor.", true);
  }
}

function stopGeneratedAudio() {
  if (!refs.spanishAudioPreview) return;
  refs.spanishAudioPreview.pause?.();
  if (Number.isFinite(refs.spanishAudioPreview.duration)) refs.spanishAudioPreview.currentTime = 0;
}

function updateVoiceEngineUI() {
  const engine = selectedVoiceEngine();
  $$(".voice-card").forEach((card) => card.classList.toggle("is-selected", card.querySelector("input").checked));
  refs.piperSetting.classList.toggle("is-hidden", engine !== "piper");
  refs.windowsSetting.classList.toggle("is-hidden", engine !== "windows");
  scheduleSave();
}

function selectedVoiceEngine() {
  return $('input[name="voiceEngine"]:checked')?.value || "browser";
}

async function checkPiper() {
  try {
    const response = await fetch("http://127.0.0.1:5000/info");
    if (!response.ok) throw new Error();
    toast("Piper está conectado y listo.");
  } catch (_) {
    toast("Piper no responde. Ejecuta Instalar_e_Iniciar_Piper.bat y deja la ventana abierta.", true);
  }
}

async function checkWindows() {
  try {
    const response = await fetch("http://127.0.0.1:8765/voices");
    if (!response.ok) throw new Error();
    const data = await response.json();
    refs.windowsVoice.replaceChildren(new Option("Voz predeterminada", ""));
    for (const voice of data.voices || []) {
      refs.windowsVoice.append(new Option(`${voice.name} · ${voice.culture}`, voice.name));
    }
    toast(`${data.voices?.length || 0} voces de Windows disponibles.`);
  } catch (_) {
    toast("El servidor de Windows no responde. Ejecuta Iniciar_Voz_Windows.bat.", true);
  }
}

async function generateSpanishVoice() {
  applySourceLanguageToCues();
  const usable = state.cues.filter((cue) => spanishTextForCue(cue));
  if (!usable.length) return toast("Primero escribe o traduce el texto al español.", true);
  const engine = selectedVoiceEngine();
  showTask("Creando la voz española", "Preparando los segmentos…", 3);

  try {
    let segments;
    if (engine === "browser") segments = await voiceWithBrowser();
    else if (engine === "piper") segments = await voiceWithPiper();
    else segments = await voiceWithWindows();

    const mixed = mixVoiceSegments(segments);
    const blob = encodeWav(mixed, 16000);
    setSpanishAudio(mixed, blob, 16000);
    renderAll();
    completeTask("Voz española lista", `${formatDuration(mixed.length / 16000)} de audio sincronizado.`);
    toast("La pista española está lista para escuchar y descargar.");
  } catch (error) {
    failTask(error);
  }
}

async function voiceWithBrowser() {
  const segments = new Array(state.cues.length);
  await localAI.run("voice", { texts: state.cues.map(spanishTextForCue) }, {
    onProgress: updateTaskFromAI,
    onSegment: ({ index, audio, samplingRate }) => {
      segments[index] = { audio: new Float32Array(audio), samplingRate };
    }
  });
  return segments;
}

async function voiceWithPiper() {
  const output = [];
  const speed = Number(refs.voiceSpeed.value) / 100;
  const controller = new AbortController();
  state.currentCancel = () => controller.abort();
  try {
    for (let index = 0; index < state.cues.length; index += 1) {
      const text = spanishTextForCue(state.cues[index]);
      if (!text) { output.push({ audio: new Float32Array(0), samplingRate: 16000 }); continue; }
      showTask("Creando voz con Piper", `Segmento ${index + 1} de ${state.cues.length}…`, 5 + Math.round(((index + 1) / state.cues.length) * 93));
      const response = await fetch("http://127.0.0.1:5000/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, length_scale: clamp(1 / speed, 0.65, 1.35) }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error("Piper no pudo generar la voz. Revisa su ventana local.");
      output.push(await decodeAudioBlob(await response.blob()));
    }
    return output;
  } finally {
    state.currentCancel = null;
  }
}

async function voiceWithWindows() {
  const output = [];
  const speed = Number(refs.voiceSpeed.value) / 100;
  const sapiRate = Math.round(clamp((speed - 1) * 20, -10, 10));
  const voice = refs.windowsVoice.value;
  const controller = new AbortController();
  state.currentCancel = () => controller.abort();
  try {
    for (let index = 0; index < state.cues.length; index += 1) {
      const text = spanishTextForCue(state.cues[index]);
      if (!text) { output.push({ audio: new Float32Array(0), samplingRate: 16000 }); continue; }
      showTask("Creando voz de Windows", `Segmento ${index + 1} de ${state.cues.length}…`, 5 + Math.round(((index + 1) / state.cues.length) * 93));
      const query = new URLSearchParams({ rate: String(sapiRate), volume: "100" });
      if (voice) query.set("voice", voice);
      const response = await fetch(`http://127.0.0.1:8765/synthesize?${query}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: text,
        signal: controller.signal
      });
      if (!response.ok) throw new Error("La voz de Windows no respondió. Revisa su ventana local.");
      output.push(await decodeAudioBlob(await response.blob()));
    }
    return output;
  } finally {
    state.currentCancel = null;
  }
}

async function decodeAudioBlob(blob) {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const mono = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1) mono[index] += data[index] / buffer.numberOfChannels;
    }
    return { audio: mono, samplingRate: buffer.sampleRate };
  } finally {
    await context.close();
  }
}

function mixVoiceSegments(segments) {
  const outputRate = 16000;
  const lastCueEnd = Math.max(0, ...state.cues.map((cue) => cue.end));
  const duration = Math.max(state.mediaDuration || 0, lastCueEnd + 0.4, 1);
  const mix = new Float32Array(Math.ceil(duration * outputRate));
  const selectedSpeed = Number(refs.voiceSpeed.value) / 100;

  state.cues.forEach((cue, index) => {
    const segment = segments[index];
    if (!segment?.audio?.length) return;
    const naturalLength = Math.round(segment.audio.length * outputRate / segment.samplingRate / selectedSpeed);
    const cueLength = Math.max(1, Math.round((cue.end - cue.start) * outputRate * 0.98));
    const targetLength = Math.max(1, Math.min(naturalLength, cueLength));
    const fitted = resampleToLength(segment.audio, targetLength);
    const offset = Math.round(cue.start * outputRate);
    for (let sample = 0; sample < fitted.length && offset + sample < mix.length; sample += 1) {
      const fade = Math.min(1, sample / 100, (fitted.length - sample) / 100);
      mix[offset + sample] += fitted[sample] * Math.max(0, fade);
    }
  });

  let peak = 0;
  for (const value of mix) peak = Math.max(peak, Math.abs(value));
  if (peak > 0.97) {
    const gain = 0.97 / peak;
    for (let index = 0; index < mix.length; index += 1) mix[index] *= gain;
  }
  return mix;
}

function setSpanishAudio(samples, blob, sampleRate) {
  clearSpanishAudio();
  state.spanishAudio = samples;
  state.spanishAudioBlob = blob;
  state.audioSampleRate = sampleRate;
  state.spanishAudioUrl = URL.createObjectURL(blob);
  refs.spanishAudioPreview.src = state.spanishAudioUrl;
  refs.audioMeta.textContent = `WAV · ${formatDuration(samples.length / sampleRate)} · ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
  refs.generatedAudioCard.classList.remove("is-hidden");
  updateCompletion();
  updateFinalSummary();
}

function clearSpanishAudio() {
  stopGeneratedAudio();
  if (state.spanishAudioUrl) URL.revokeObjectURL(state.spanishAudioUrl);
  state.spanishAudio = null;
  state.spanishAudioBlob = null;
  state.spanishAudioUrl = "";
  refs.spanishAudioPreview?.removeAttribute("src");
  refs.generatedAudioCard?.classList.add("is-hidden");
  updateFinalSummary?.();
}

function downloadText(language, extension) {
  if (!state.cues.length) return toast("No hay texto para descargar.", true);
  const target = language === "espanol";
  if (target && !state.cues.some((cue) => spanishTextForCue(cue))) return toast("Todavía no hay texto español.", true);
  let content;
  if (extension === "txt") content = state.cues.map((cue) => target ? spanishTextForCue(cue) : cue.source.trim()).filter(Boolean).join("\n\n");
  else if (extension === "vtt") content = formatVtt(target);
  else content = formatSrt(target);
  const mime = extension === "txt" ? "text/plain" : "text/vtt";
  downloadBlob(new Blob(["\uFEFF", content], { type: `${mime};charset=utf-8` }), `${safeProjectName()}-${language}.${extension}`);
}

function formatSrt(target) {
  return state.cues.map((cue, index) => `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${target ? spanishTextForCue(cue) : cue.source.trim()}`).join("\n\n");
}

function formatVtt(target) {
  return `WEBVTT\n\n${state.cues.map((cue) => `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${target ? spanishTextForCue(cue) : cue.source.trim()}`).join("\n\n")}`;
}

function downloadWav() {
  if (!state.spanishAudioBlob) return toast("Primero genera la voz española.", true);
  downloadBlob(state.spanishAudioBlob, `${safeProjectName()}-voz-espanola.wav`);
}

async function exportDubbedVideo() {
  if (state.mediaKind !== "video" || !state.mediaFile) return toast("Necesitas un archivo de video para combinar la imagen.", true);
  if (!state.spanishAudio?.length) return toast("Primero genera la voz española.", true);
  const video = refs.videoPreview;
  if (!video.videoWidth) return toast("Chrome no puede reproducir este video.", true);

  const canvas = refs.renderCanvas;
  const scale = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight);
  canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
  const context2d = canvas.getContext("2d", { alpha: false });
  const includeSubtitles = $("#burnSubtitles").checked;
  const audioContext = new AudioContext();
  await audioContext.resume();
  const audioBuffer = audioContext.createBuffer(1, state.spanishAudio.length, state.audioSampleRate);
  audioBuffer.copyToChannel(state.spanishAudio, 0);
  const audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;
  const streamDestination = audioContext.createMediaStreamDestination();
  audioSource.connect(streamDestination);

  const canvasStream = canvas.captureStream(30);
  const combined = new MediaStream([...canvasStream.getVideoTracks(), ...streamDestination.stream.getAudioTracks()]);
  const mimeType = chooseRecordingMime();
  const recorder = new MediaRecorder(combined, mimeType ? { mimeType, videoBitsPerSecond: 4_000_000 } : { videoBitsPerSecond: 4_000_000 });
  const pieces = [];
  recorder.addEventListener("dataavailable", (event) => event.data.size && pieces.push(event.data));

  const previousMuted = video.muted;
  const previousControls = video.controls;
  let animationFrame = 0;
  let cancelled = false;
  showTask("Creando el video doblado", "Mantén esta pestaña abierta; se procesa a velocidad normal.", 1);

  const draw = () => {
    context2d.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (includeSubtitles) drawSubtitle(context2d, canvas, activeSpanishCue(video.currentTime));
    const progress = video.duration ? (video.currentTime / video.duration) * 98 : 0;
    showTask("Creando el video doblado", `${formatDuration(video.currentTime)} de ${formatDuration(video.duration)} · no cierres esta pestaña`, progress);
    if (!video.ended && !cancelled) animationFrame = requestAnimationFrame(draw);
  };

  state.currentCancel = () => {
    cancelled = true;
    video.pause();
    cancelAnimationFrame(animationFrame);
    if (recorder.state !== "inactive") recorder.stop();
    try { audioSource.stop(); } catch (_) { /* ignore */ }
  };

  try {
    video.pause();
    video.currentTime = 0;
    await waitForSeek(video);
    video.muted = true;
    video.controls = false;
    context2d.drawImage(video, 0, 0, canvas.width, canvas.height);
    recorder.start(1000);
    await video.play();
    audioSource.start();
    draw();

    await new Promise((resolve, reject) => {
      video.addEventListener("ended", resolve, { once: true });
      video.addEventListener("error", () => reject(new Error("El video dejó de reproducirse durante la exportación.")), { once: true });
      const cancelCheck = setInterval(() => {
        if (cancelled) {
          clearInterval(cancelCheck);
          reject(new Error("Tarea cancelada."));
        }
        if (video.ended) clearInterval(cancelCheck);
      }, 300);
    });
    cancelAnimationFrame(animationFrame);
    await new Promise((resolve) => {
      recorder.addEventListener("stop", resolve, { once: true });
      setTimeout(() => recorder.stop(), 180);
    });
    const blob = new Blob(pieces, { type: recorder.mimeType || "video/webm" });
    downloadBlob(blob, `${safeProjectName()}-doblado.webm`);
    completeTask("Video doblado listo", `${(blob.size / 1024 / 1024).toFixed(1)} MB descargados.`);
    toast("Video doblado creado y descargado.");
  } catch (error) {
    if (recorder.state !== "inactive") recorder.stop();
    failTask(error);
  } finally {
    cancelAnimationFrame(animationFrame);
    video.pause();
    video.muted = previousMuted;
    video.controls = previousControls;
    state.currentCancel = null;
    for (const track of combined.getTracks()) track.stop();
    try { audioSource.stop(); } catch (_) { /* ignore */ }
    await audioContext.close();
  }
}

function activeSpanishCue(time) {
  const cue = state.cues.find((item) => time >= item.start && time <= item.end);
  return cue ? spanishTextForCue(cue) : "";
}

function drawSubtitle(context, canvas, text) {
  if (!text) return;
  const fontSize = Math.max(20, Math.round(canvas.width / 38));
  context.font = `700 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const maxWidth = canvas.width * 0.83;
  const lines = wrapCanvasText(context, text, maxWidth).slice(0, 3);
  const lineHeight = fontSize * 1.25;
  const blockHeight = lines.length * lineHeight + fontSize * 0.75;
  const y = canvas.height - blockHeight - canvas.height * 0.045;
  context.fillStyle = "rgba(5, 10, 13, .78)";
  context.fillRect(canvas.width * 0.055, y, canvas.width * 0.89, blockHeight);
  context.fillStyle = "white";
  context.strokeStyle = "rgba(0,0,0,.75)";
  context.lineWidth = Math.max(2, fontSize * 0.1);
  lines.forEach((line, index) => {
    const lineY = y + fontSize * 0.55 + lineHeight * (index + 0.5);
    context.strokeText(line, canvas.width / 2, lineY, maxWidth);
    context.fillText(line, canvas.width / 2, lineY, maxWidth);
  });
}

function wrapCanvasText(context, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function chooseRecordingMime() {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function updateTaskFromAI(data) {
  if (data.type === "phase") {
    showTask(refs.taskTitle.textContent, data.detail || "Procesando…", Number(data.progress) || 0);
    return;
  }
  if (data.type === "model-progress") {
    const raw = Number(data.progress);
    const mapped = Number.isFinite(raw) ? 5 + raw * 0.65 : 8;
    const kind = { transcription: "Whisper", translation: "traductor", voice: "voz española" }[data.kind] || "modelo";
    const filename = data.file ? ` · ${shortFile(data.file)}` : "";
    showTask(`Descargando ${kind}`, `Primera vez solamente${filename}`, mapped);
  }
}

function showTask(title, detail, progress = 0) {
  refs.taskPanel.classList.remove("is-hidden");
  refs.taskTitle.textContent = title;
  refs.taskDetail.textContent = detail;
  refs.taskProgress.style.width = `${clamp(Number(progress) || 0, 0, 100)}%`;
}

function completeTask(title, detail) {
  showTask(title, detail, 100);
  setTimeout(() => refs.taskPanel.classList.add("is-hidden"), 1800);
}

function failTask(error) {
  refs.taskPanel.classList.add("is-hidden");
  state.currentCancel = null;
  const message = friendlyError(error);
  toast(message, true);
  console.error(error);
}

function cancelCurrentTask() {
  state.currentCancel?.();
  localAI.cancelAll();
  state.currentCancel = null;
  refs.taskPanel.classList.add("is-hidden");
  toast("Tarea cancelada.");
}

function friendlyError(error) {
  const text = String(error?.message || error || "Error desconocido");
  if (/fetch|network|Failed to fetch/i.test(text)) return "No se pudo descargar o conectar. Revisa internet para la primera descarga del modelo, o inicia el servidor de voz elegido.";
  if (/memory|allocation|out of bounds/i.test(text)) return "Chrome se quedó sin memoria. Prueba un video más corto o cierra otras pestañas.";
  return text;
}

function toast(message, isError = false) {
  const element = document.createElement("div");
  element.className = `toast${isError ? " is-error" : ""}`;
  element.textContent = message;
  refs.toasts.append(element);
  setTimeout(() => element.remove(), 5200);
}

function resampleLinear(input, sourceRate, targetRate) {
  if (sourceRate === targetRate) return new Float32Array(input);
  const length = Math.max(1, Math.round(input.length * targetRate / sourceRate));
  return resampleToLength(input, length);
}

function resampleToLength(input, length) {
  if (!input.length || length <= 0) return new Float32Array(0);
  if (input.length === length) return new Float32Array(input);
  const output = new Float32Array(length);
  const ratio = (input.length - 1) / Math.max(1, length - 1);
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const mix = position - left;
    output[index] = input[left] * (1 - mix) + input[right] * mix;
  }
  return output;
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (const sample of samples) {
    const value = clamp(sample, -1, 1);
    view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function formatSrtTime(seconds) {
  return formatTimestamp(seconds, ",");
}

function formatVttTime(seconds) {
  return formatTimestamp(seconds, ".");
}

function formatTimestamp(seconds, separator) {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${separator}${String(ms).padStart(3, "0")}`;
}

function formatCueTime(seconds) {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const minutes = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const tenths = Math.floor((totalMs % 1000) / 100);
  return `${minutes}:${pad(secs)}.${tenths}`;
}

function parseTime(value) {
  const clean = String(value || "").trim().replace(",", ".");
  if (!clean) return NaN;
  const parts = clean.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return NaN;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function countWords(text) {
  return String(text || "").trim() ? String(text).trim().split(/\s+/).length : 0;
}

function waitForMediaMetadata(element) {
  if (element.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    element.addEventListener("loadedmetadata", resolve, { once: true });
    element.addEventListener("error", () => reject(new Error("Chrome no pudo leer este archivo multimedia.")), { once: true });
  });
}

function waitForSeek(video) {
  if (video.currentTime === 0 && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }));
}

function isTranscriptFile(file) {
  return /\.(srt|vtt|txt|md)$/i.test(file.name) || file.type.startsWith("text/");
}

function isLikelyMedia(name) {
  return /\.(mp4|webm|mov|mkv|avi|mp3|wav|m4a|aac|ogg|flac)$/i.test(name);
}

function baseName(name) {
  return String(name || "video").replace(/\.[^.]+$/, "");
}

function safeProjectName() {
  return (refs.projectTitle.value || "video-en-espanol").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "video-en-espanol";
}

function shortFile(name) {
  const value = String(name || "");
  return value.length > 38 ? `…${value.slice(-35)}` : value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function scheduleSave() {
  refs.savedState.textContent = "Guardando…";
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveProject, 450);
}

async function saveProject() {
  const payload = {
    title: refs.projectTitle.value,
    cues: state.cues,
    sourceLanguage: selectedSourceLanguage(),
    voiceSpeed: refs.voiceSpeed.value,
    voiceEngine: selectedVoiceEngine(),
    translationEngine: refs.translationEngine.value,
    updatedAt: Date.now()
  };
  try {
    await chrome.storage.local.set({ currentProject: payload });
    refs.savedState.textContent = "Guardado local";
  } catch (_) {
    refs.savedState.textContent = "No guardado";
  }
}

async function restoreProject() {
  try {
    const { currentProject } = await chrome.storage.local.get("currentProject");
    if (!currentProject) return;
    refs.projectTitle.value = currentProject.title || refs.projectTitle.value;
    const sourceRadio = $(`input[name="sourceLanguage"][value="${currentProject.sourceLanguage || "en"}"]`);
    if (sourceRadio) sourceRadio.checked = true;
    state.cues = normalizeCues(currentProject.cues || []);
    applySourceLanguageToCues();
    refs.voiceSpeed.value = currentProject.voiceSpeed || "105";
    refs.voiceSpeedValue.textContent = `${(Number(refs.voiceSpeed.value) / 100).toFixed(2)}×`;
    refs.translationEngine.value = currentProject.translationEngine || "chrome";
    const voiceRadio = $(`input[name="voiceEngine"][value="${currentProject.voiceEngine || "browser"}"]`);
    if (voiceRadio) voiceRadio.checked = true;
  } catch (_) {
    // The project can still be used without persistence.
  }
}
