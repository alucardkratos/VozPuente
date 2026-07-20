# Verification record

Build Week package: VozPuente 3.0.0

Automated checks completed on July 19, 2026:

- `app.js`, `ai-worker.js`, and the packaged `ai-worker.bundle.js` pass Node syntax validation.
- Every JavaScript selector used by the application resolves to an HTML element.
- The Manifest V3 declaration and version are valid JSON.
- All critical packaged assets are present, including the Windows helper and original demo media.
- Required flow markers are present for Spanish-first captions, automatic language detection, actual selected-engine preview, exact synchronized playback, and helper download.
- The demo MP4 was generated for this project and contains original English speech; matching English and Spanish SRT files are included.

Run the repeatable static check from the repository root:

```bash
node --check app.js
node --check ai-worker.js
node --check ai-worker.bundle.js
node tests/static-check.mjs
```

Manual acceptance test required before submission:

1. Load the unpacked extension in a clean Chrome profile on Windows 10/11.
2. Load `demo/vozpuente-demo-en.mp4` and verify local automatic transcription.
3. Load `demo/vozpuente-demo-en.srt` to verify the faster deterministic judge path.
4. Translate, listen with an installed voice, and test the selected neural/Windows/Piper engine.
5. Generate WAV, seek to `0:05`, adjust the offset, and export a short WebM.

The container used for packaging does not include a graphical Chrome installation, so the final browser/Windows acceptance test is intentionally recorded as a user-run step instead of being claimed as automated.
