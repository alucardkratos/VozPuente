# OpenAI Build Week submission kit

## Recommended Devpost fields

**Project name**

VozPuente — Local Spanish Video Access

**Track**

Education

**One-line pitch**

Turn English video, audio, and captions into editable Spanish text and synchronized local speech—without forcing learners into paid, fragmented tools.

**Short description**

VozPuente is a Chrome extension for Spanish-speaking learners. Paste a supported link or upload media/captions; the extension looks for Spanish captions first, falls back to English, translates when needed, and uses local Whisper when an accessible media file has no text. Users can edit timed segments, listen immediately with an installed voice, generate local neural speech, calibrate from an exact timestamp, and export captions, WAV, or a dubbed WebM. The default path is free and private by design.

## Full project story

### Inspiration

Educational knowledge is globally available, but language access is not. Roberto repeatedly lost time extracting captions, translating them, opening a separate reader, and restarting long media whenever synchronization was wrong. VozPuente grew from that real workflow rather than from a hackathon-only idea.

### What it does

VozPuente unifies caption retrieval, local transcription, English-to-Spanish translation, editable timing, immediate speech, neural voice generation, exact synchronization, and export in one Chrome extension.

### How we built it

The extension uses Manifest V3, Chrome Translator, Transformers.js, ONNX Runtime Web, Whisper, OPUS-MT, MMS TTS, Web Audio, and MediaRecorder. Optional local helpers expose Piper and installed Windows SAPI voices only through loopback interfaces.

Codex with GPT-5.6 converted Roberto's tests into implementation tasks, audited the existing code, found a voice-routing defect, added true engine previews, automatic language detection, Spanish-first caption selection, packaged voice helpers, exact seeking, synchronized playback, adjustable audio offset, verification scripts, and submission documentation.

### Challenges

YouTube caption endpoints can return 403 responses or require PO tokens. VozPuente therefore uses a transparent fallback ladder and never claims to bypass platform restrictions. Voice engines also cross a browser/operating-system boundary: Chrome cannot execute Windows files directly, so the extension provides a downloadable loopback helper and an explicit connection check.

### Accomplishments

- A complete, installable Chrome product rather than a mockup.
- A free local path from English audio/captions to Spanish text and speech.
- Honest diagnostics for blocked sources.
- Exact minute/second calibration without restarting long media.
- Direct evidence that the product saves its creator time.

### What we learned

The best fallback is not invisible magic. Users need to see what source was found, which engine is active, what must be installed, and why a protected source cannot be read. That transparency became part of the product design.

### What's next

Improve language detection confidence, add more local translation pairs, make model downloads resumable, add automated browser regression tests, and package the Windows helper with a signed installer.

## Demo video script — target 2:35

**0:00–0:18 — Problem**

“Most educational video is not equally accessible across languages. I built VozPuente because turning one English video into Spanish text and speech required several separate tools and repeated manual synchronization.”

**0:18–0:38 — Product and input**

“VozPuente is a Chrome extension. I can paste a supported link, upload video or audio, load SRT, VTT, or TXT, or paste a transcript. It first looks for Spanish captions, then English captions, and uses local transcription when an accessible media file has no text.”

**0:38–1:02 — Transcription and translation demo**

“Here I load an original demonstration video. Whisper detects English and creates timestamped segments locally. Chrome Translator or local OPUS-MT converts the text to Spanish, and every segment remains editable.”

**1:02–1:28 — Voice demo**

“The Spanish text can be read immediately with an installed system voice. For downloadable audio I can choose local MMS neural speech, Piper, or Windows voices. This preview now uses the engine actually selected, and the optional helpers can be downloaded directly from the interface.”

**1:28–1:52 — Calibration demo**

“For long videos I do not restart from zero. I enter an exact timestamp, move one or ten seconds in either direction, play source and dub together, and adjust a positive or negative voice offset before regenerating the final WAV.”

**1:52–2:14 — Export and privacy**

“I can export Spanish TXT, SRT, VTT, synchronized WAV, or a WebM video. Media stays in the browser; only model files are downloaded on first use. The extension clearly reports when a website blocks caption access.”

**2:14–2:35 — Codex/GPT-5.6**

“I used Codex with GPT-5.6 throughout Build Week to turn my testing feedback into code, audit the extension, repair voice routing, implement language detection and exact synchronization, add tests, and prepare the judge experience. I chose the product constraints: free first, local first, and honest fallbacks.”

## Final checklist

- [ ] Join the hackathon on Devpost.
- [ ] Test the final ZIP on a clean Chrome profile.
- [ ] Create GitHub repository.
- [ ] If private, share it with `testing@devpost.com` and `build-week-event@openai.com`.
- [ ] Replace the Session ID placeholder in `README_EN.md`.
- [ ] Record a public YouTube demo under three minutes with English voiceover.
- [ ] Do not use copyrighted music, video, logos, or private data.
- [ ] Add repository URL and YouTube URL to Devpost.
- [ ] Paste the English project description.
- [ ] Submit before July 21, 2026 at 5:00 p.m. PDT / 6:00 p.m. El Salvador.
