# VozPuente — Local Spanish Video Access

VozPuente is a Chrome extension that helps Spanish-speaking learners turn English video, audio, and captions into editable Spanish text and synchronized local speech. Its core path is free, private by design, and does not require an account or API key.

## The problem

Much of the world's educational video content is published in English. Learners who do not speak English must jump between caption extractors, translators, text-to-speech websites, and editing tools. These services can be paid, upload private files, or lose subtitle timing.

VozPuente combines that workflow in one guided interface.

## What it does

When a user pastes a supported link, the extension follows a clear fallback ladder:

1. Look for usable Spanish captions.
2. Otherwise, look for English captions.
3. Translate English captions with YouTube when available, Chrome Translator, or local OPUS-MT.
4. For a direct MP4/MP3 link or an uploaded file, use local Whisper to detect English or Spanish and transcribe the audio.
5. Let the user edit every segment while preserving timestamps.
6. Read Spanish text automatically with an installed system voice after **Extract + translate** (enabled by default).
7. Generate synchronized WAV speech with local MMS TTS, optional Piper, or installed Windows SAPI voices.
8. Seek to an exact time, compare source and dubbed audio, adjust offset, and export TXT, SRT, VTT, WAV, or WebM.

## Important YouTube boundary

VozPuente reads captions that YouTube makes available and can try the visible transcript panel. YouTube may require a PO token, anti-bot verification, or may publish no transcript at all. The extension does not bypass DRM or access controls. When the streaming audio is unavailable, the user must provide a locally authorized video/audio file; local Whisper then performs the transcription.

## Install

Supported target: Windows 10/11, Chrome 138 or newer recommended.

1. Download and extract the release ZIP.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted `VozPuente` folder.
6. Click the extension icon to open VozPuente.

No build step is required for judges. The repository contains the packaged web runtime and WASM files.

## Two-minute judge test

1. Open VozPuente.
2. Keep **Detect automatically** selected.
3. Upload `demo/vozpuente-demo-en.mp4` or load `demo/vozpuente-demo-en.srt`.
4. Transcribe or continue with the supplied captions.
5. Translate to Spanish.
6. Click **Listen in Spanish** for immediate system speech.
7. Select **Browser neural voice** and click **Test selected voice**.
8. Generate the synchronized track.
9. In **Exact calibration**, enter `0:05`, seek, and play source + Spanish voice together.

Model downloads require internet the first time and are cached by Chrome afterward.

## Architecture

- Manifest V3 Chrome extension, HTML/CSS/JavaScript.
- Chrome Translator API when available.
- Transformers.js + ONNX Runtime Web for local inference.
- Whisper Tiny multilingual / English for transcription.
- OPUS-MT English-to-Spanish for local translation.
- MMS TTS Spanish for browser-local neural speech.
- Optional Piper HTTP service bound to `127.0.0.1:5000`.
- Optional Windows SAPI helper bound to `127.0.0.1:8765`.
- Web Audio and MediaRecorder for synchronized WAV/WebM output.

## How Codex and GPT-5.6 were used

Roberto Cornejo defined the product from a real personal need: English videos cost him time because extracting, translating, listening, and synchronizing required separate tools. He tested successive versions and supplied concrete failure reports.

During OpenAI Build Week, Codex with GPT-5.6 was used to:

- turn those reports into a fallback-oriented product flow;
- audit the existing extension, permissions, local servers, and third-party licenses;
- identify that the voice preview ignored the selected Windows/Piper engine;
- implement real per-engine previews and packaged Windows/Piper download actions;
- implement exact seek, synchronized playback, and adjustable voice offset;
- add automatic English/Spanish transcription selection;
- prioritize Spanish captions before English captions;
- generate tests, judge instructions, submission copy, and a reproducible demo asset.

Roberto made the central product decisions: keep the default path free, prioritize Spanish-speaking learners, keep media local, expose honest fallbacks, and make synchronization controllable rather than automatic and opaque.

## Build Week change boundary

Baseline snapshot: working version 2.4, created during the submission period on July 19, 2026.

Build Week 3.0 additions:

- Spanish-first caption fallback.
- Automatic English/Spanish transcription mode.
- Actual preview of the selected voice engine.
- Download buttons and instructions for Windows SAPI and Piper helpers.
- Exact seek and ±1/±10 second navigation.
- Synchronized source/dub playback and adjustable voice offset.
- Static verification, English judge documentation, and original demo assets.

The dated Git history and Codex `/feedback` Session ID provide implementation evidence.

## Privacy and safety

Uploaded media and text are processed locally. Model files are downloaded from their original Hugging Face repositories on first use. Optional speech helpers listen only on loopback. The extension does not bypass private videos, DRM, paywalls, age restrictions, or anti-bot controls.

## Known limits

- YouTube and other websites can change or block caption access.
- Caption-less streaming audio cannot always be captured from a pasted URL.
- Long videos require significant memory and processing time.
- Browser-supported codecs determine which local media files can be decoded.
- Machine transcription and translation should be reviewed before publishing.

## Submission details

- Track: **Education**
- Platform: Chrome on Windows 10/11
- Session ID: add the Codex `/feedback` ID before Devpost submission
- License/repository visibility: use a private repository shared with `testing@devpost.com` and `build-week-event@openai.com`, unless a public license is chosen before submission.

Third-party components and licenses are documented in `TERCEROS.md`.
