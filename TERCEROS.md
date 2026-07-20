# Software y modelos de terceros

Esta extensión distribuye el paquete web de Transformers.js bajo Apache License 2.0 y los binarios WebAssembly requeridos de ONNX Runtime Web bajo MIT License. La licencia de Transformers.js está incluida en `vendor/LICENSE-transformers.txt`.

`ai-worker.bundle.js` es una compilación local reproducible de `ai-worker.js` junto con esas dependencias web; conserva dentro del archivo el aviso de licencia de ONNX Runtime.

Los modelos de Whisper, OPUS-MT y MMS TTS no están incluidos en el ZIP: el navegador los descarga desde sus repositorios originales la primera vez que el usuario solicita cada función. Consulta los enlaces y licencias de cada modelo en `README.md`.

La compatibilidad de extracción de pistas de YouTube se contrastó con el proyecto abierto `youtube-transcript-api` (MIT). Ese paquete y su código Python no se distribuyen dentro de la extensión.

La ruta alternativa que lee el panel visible de transcripción se contrastó con `omni-youtube-summarizer` (MIT). Ese proyecto tampoco se distribuye dentro de la extensión; solamente se tomó como referencia su estrategia pública de compatibilidad con YouTube.
