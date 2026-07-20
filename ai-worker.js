import { env, pipeline } from "./vendor/transformers.web.min.js";

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = new URL("./vendor/", self.location.href).href;
env.backends.onnx.wasm.numThreads = 1;

const MODEL_IDS = {
  transcriptionEnglish: "onnx-community/whisper-tiny.en",
  transcriptionSpanish: "onnx-community/whisper-tiny",
  translation: "Xenova/opus-mt-en-es",
  voice: "Xenova/mms-tts-spa"
};

let activePipeline = null;
let activeKind = null;

function emit(taskId, type, payload = {}, transfer = []) {
  self.postMessage({ taskId, type, ...payload }, transfer);
}

function modelProgress(taskId, kind) {
  return (event) => {
    const progress = Number.isFinite(event?.progress) ? event.progress : null;
    const file = event?.file || event?.name || "";
    emit(taskId, "model-progress", {
      kind,
      status: event?.status || "loading",
      progress,
      file
    });
  };
}

async function disposeCurrent() {
  if (activePipeline?.dispose) {
    try { await activePipeline.dispose(); } catch (_) { /* The cache remains usable. */ }
  }
  activePipeline = null;
  activeKind = null;
}

async function getPipeline(kind, taskId) {
  if (activePipeline && activeKind === kind) return activePipeline;
  await disposeCurrent();

  const isTranscription = kind.startsWith("transcription");
  const options = {
    device: "wasm",
    dtype: isTranscription ? "q4" : "q8",
    progress_callback: modelProgress(taskId, isTranscription ? "transcription" : kind)
  };

  if (kind === "transcription-en") {
    activePipeline = await pipeline("automatic-speech-recognition", MODEL_IDS.transcriptionEnglish, options);
  } else if (kind === "transcription-es") {
    activePipeline = await pipeline("automatic-speech-recognition", MODEL_IDS.transcriptionSpanish, options);
  } else if (kind === "translation") {
    activePipeline = await pipeline("translation", MODEL_IDS.translation, options);
  } else if (kind === "voice") {
    activePipeline = await pipeline("text-to-speech", MODEL_IDS.voice, options);
  } else {
    throw new Error("Tarea de IA desconocida.");
  }

  activeKind = kind;
  return activePipeline;
}

function normalizeTimestamp(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

async function transcribe(taskId, audio, language = "en") {
  const spanish = language === "es";
  const transcriber = await getPipeline(spanish ? "transcription-es" : "transcription-en", taskId);
  emit(taskId, "phase", { detail: `Escuchando el audio en ${spanish ? "español" : "inglés"}…`, progress: 76 });
  const options = {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    task: "transcribe"
  };
  if (spanish) options.language = "spanish";
  const result = await transcriber(audio, options);

  let chunks = Array.isArray(result?.chunks) ? result.chunks : [];
  chunks = chunks.map((chunk, index) => {
    const timestamps = chunk.timestamp || chunk.timestamps || [];
    const start = normalizeTimestamp(timestamps[0], index ? null : 0);
    const endFallback = Number.isFinite(start) ? start + 4 : (index + 1) * 4;
    const end = normalizeTimestamp(timestamps[1], endFallback);
    return {
      start: Number.isFinite(start) ? start : index * 4,
      end: end > start ? end : endFallback,
      text: String(chunk.text || "").trim()
    };
  }).filter((chunk) => chunk.text);

  if (!chunks.length && String(result?.text || "").trim()) {
    chunks = [{ start: 0, end: Math.max(4, audio.length / 16000), text: String(result.text).trim() }];
  }

  emit(taskId, "result", { result: { text: String(result?.text || "").trim(), chunks } });
}

async function translate(taskId, texts) {
  const translator = await getPipeline("translation", taskId);
  const translations = [];

  for (let index = 0; index < texts.length; index += 1) {
    const text = String(texts[index] || "").trim();
    if (!text) {
      translations.push("");
      continue;
    }
    emit(taskId, "phase", {
      detail: `Traduciendo segmento ${index + 1} de ${texts.length}…`,
      progress: 15 + Math.round(((index + 1) / texts.length) * 82)
    });
    const output = await translator(text, { max_new_tokens: 256 });
    const item = Array.isArray(output) ? output[0] : output;
    translations.push(String(item?.translation_text || item?.generated_text || "").trim());
  }

  emit(taskId, "result", { result: translations });
}

async function synthesize(taskId, texts) {
  const synthesizer = await getPipeline("voice", taskId);
  const total = texts.length;

  for (let index = 0; index < total; index += 1) {
    const text = String(texts[index] || "").trim();
    if (!text) {
      emit(taskId, "voice-segment", { index, samplingRate: 16000, audio: new Float32Array(0) });
      continue;
    }

    emit(taskId, "phase", {
      detail: `Creando voz ${index + 1} de ${total}…`,
      progress: 18 + Math.round(((index + 1) / total) * 80)
    });
    const output = await synthesizer(text);
    const audio = new Float32Array(output.audio);
    emit(taskId, "voice-segment", {
      index,
      samplingRate: Number(output.sampling_rate) || 16000,
      audio
    }, [audio.buffer]);
  }

  emit(taskId, "result", { result: { count: total } });
}

self.addEventListener("message", async ({ data }) => {
  const { taskId, task, payload = {} } = data || {};
  if (!taskId) return;

  try {
    if (task === "transcribe") {
      await transcribe(taskId, new Float32Array(payload.audio), payload.language || "en");
    } else if (task === "translate") {
      await translate(taskId, payload.texts || []);
    } else if (task === "voice") {
      await synthesize(taskId, payload.texts || []);
    } else if (task === "dispose") {
      await disposeCurrent();
      emit(taskId, "result", { result: true });
    } else {
      throw new Error("La tarea solicitada no existe.");
    }
  } catch (error) {
    emit(taskId, "error", {
      message: error?.message || String(error),
      stack: error?.stack || ""
    });
  }
});
