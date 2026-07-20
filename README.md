# VozPuente — Video a Español

**Versión Build Week 3.0.0.** Extensión educativa para que una persona hispanohablante convierta videos, audios y subtítulos en contenido español legible y narrado, con prioridad por herramientas gratuitas y procesamiento local.

## Flujo automático principal

Al pegar un enlace y elegir **Extraer + traducir**, VozPuente sigue este orden:

1. Busca una pista española publicada.
2. Si no funciona, busca una pista inglesa.
3. Si obtiene inglés, intenta traducción de YouTube y después Chrome Translator o el modelo local OPUS-MT.
4. Si el enlace es un MP4/MP3 directo, descarga el archivo y Whisper detecta automáticamente inglés o español antes de transcribir.
5. Si YouTube no publica texto y bloquea su audio, explica el límite y permite subir el archivo para transcribirlo localmente.
6. El texto español se escucha automáticamente con una voz instalada (opción activada por defecto) o se convierte en WAV con MMS, Piper o Windows.

La etapa de voz 3.0 prueba **realmente el motor seleccionado**, ofrece los asistentes de instalación desde la interfaz y permite saltar a un minuto exacto, mover ±1/±10 segundos y ajustar el desfase entre video y voz.

Extensión de Chrome para convertir un video o audio en inglés a una versión narrada en español. El flujo completo queda dentro de una sola pestaña:

1. Pegar un enlace o cargar video/audio, subtítulos SRT/VTT/TXT o una transcripción.
2. Transcribir el audio inglés con Whisper local cuando no hay subtítulos.
3. Traducir a español y corregir cada segmento.
4. Generar una pista de voz española.
5. Descargar TXT, SRT, VTT, WAV o un video WebM doblado.

Si el archivo **ya está en español**, selecciona esa opción al inicio. La extensión puede transcribir audio español, leer inmediatamente el TXT/SRT/VTT con una voz española del sistema y generar la pista WAV sin traducirlo.

No necesita cuenta, clave API ni suscripción. Los modelos se descargan una vez y después quedan en el almacenamiento local de Chrome.

## Instalación de la extensión

1. Descomprime el ZIP completo. No abras los archivos desde dentro del ZIP.
2. Abre `chrome://extensions` en Google Chrome.
3. Activa **Modo de desarrollador** arriba a la derecha.
4. Pulsa **Cargar descomprimida**.
5. Selecciona la carpeta `VozPuente`.
6. Pulsa el icono de la extensión para abrir el editor.

Para el traductor integrado conviene Chrome 138 o posterior. Si no está disponible, la extensión ofrece un modelo local alternativo. El paquete fue preparado para Windows 10/11 y Chrome 138 o posterior.

## Uso recomendado

### Si tienes el enlace

Pégalo en la caja superior y elige:

- **Extraer subtítulos:** obtiene la pista original y abre la transcripción.
- **Extraer + traducir:** obtiene la pista original, pide a YouTube su versión española y deja el texto listo para revisar y escuchar. Si YouTube no ofrece esa traducción, continúa automáticamente con el traductor gratuito de Chrome o con el modelo local alternativo.

Admite videos de YouTube que publiquen subtítulos, enlaces directos SRT/VTT/TXT, páginas que incluyan una pista HTML `<track>` y enlaces directos MP4/MP3. Para proteger tu privacidad, Chrome pide permiso solamente para leer el sitio que pegaste; es un permiso opcional solicitado en ese momento.

La versión 3.0 consulta el reproductor actual y el panel oficial de transcripción de YouTube. Si una pista está protegida por PO token, evita repetir descargas que fallarán: abre el video en una pestaña temporal, pulsa **Mostrar transcripción**, lee los segmentos visibles, cierra esa pestaña y vuelve automáticamente al editor. Debajo del enlace aparece **Ver diagnóstico de YouTube** con el resultado de cada ruta.

### Si ya tienes SRT o VTT

Sube primero el video y después el archivo de subtítulos. La extensión conserva los tiempos, así que puedes saltarte la transcripción y pasar directamente a traducir.

### Si solo tienes el video

Sube el video y pulsa **Transcribir inglés**. Chrome intentará separar el audio directamente. Si el formato no permite hacerlo, la extensión reproducirá el archivo sin sonido para capturarlo; en ese caso tarda lo mismo que dura el video.

Revisa el texto inglés antes de traducir. Después revisa el español antes de generar la voz.

## Escuchar sin esperar la pista WAV

Después de cargar un texto español o terminar la traducción, pulsa **Escuchar español** o **Escuchar texto ahora**. Chrome lo leerá inmediatamente con la mejor voz española disponible en el sistema. **Detener** cancela la lectura.

Cuando generes la pista neural, aparecerán controles separados para **Reproducir**, **Detener** y **Descargar WAV**.

## Tres opciones de voz gratuitas

- **Voz neural del navegador (recomendada):** usa el modelo local `Xenova/mms-tts-spa`. No instala programas y exporta WAV.
- **Piper neural:** ejecuta `Instalar_e_Iniciar_Piper.bat` en Windows. La primera vez instala Piper y descarga la voz española mexicana `es_MX-claude-high`. Déjalo abierto mientras generas.
- **Voces de Windows:** ejecuta `Iniciar_Voz_Windows.bat`. Usa las voces que ya estén instaladas en Windows. Es más rápida, aunque la naturalidad depende de la voz disponible.

Los dos servidores opcionales solo escuchan en `127.0.0.1`; no aceptan conexiones desde otros equipos.

En la interfaz, selecciona Piper o Windows y pulsa **Descargar instalador/asistente**. Chrome no permite ejecutar programas de Windows directamente por seguridad: debes extraer el ZIP, ejecutar el BAT y regresar a la extensión para pulsar **Conectar**.

## Calibración exacta

En el paso Voz encontrarás **Calibración exacta**:

- Escribe `1:00`, `01:23.5` o un número de segundos.
- Usa −10, −1, +1 y +10 segundos sin volver al comienzo.
- Pulsa **Reproducir juntos** para comparar archivo original y voz española.
- Introduce un desfase entre −10 y +10 segundos. Positivo retrasa la voz; negativo la adelanta.
- Vuelve a generar el WAV para aplicar el desfase al audio final.

## Descargas

- Transcripción inglesa o española en TXT.
- Subtítulos ingleses o españoles en SRT.
- Subtítulos españoles en VTT.
- Voz española sincronizada en WAV.
- Video doblado en WebM, con subtítulos españoles visibles opcionales.

La creación del video se hace a velocidad normal para mantener sincronizados imagen y audio. Mantén abierta la pestaña hasta que termine.

## Límites honestos

- Hace falta internet la primera vez que se descarga cada modelo de IA. Después el procesamiento es local.
- La extensión no extrae pistas de subtítulos incrustadas dentro de todos los MP4/MKV. Carga el SRT/VTT separado o utiliza la transcripción de audio.
- Un enlace de YouTube solo puede extraerse directamente cuando el video publica subtítulos. Si no los tiene, descarga el video con un método autorizado por el sitio y súbelo para transcribir el audio.
- En videos con PO token, la extensión intenta el panel visible de transcripción en una pestaña temporal. Un video privado, restringido o sin el botón **Mostrar transcripción** todavía puede impedir la extracción; el diagnóstico indicará exactamente dónde se detuvo.
- Algunos sitios bloquean que una extensión lea sus reproductores. En ese caso funciona mejor un enlace directo SRT/VTT/TXT o el archivo descargado.
- Los formatos que funcionan dependen de los códecs que Chrome pueda reproducir. MP4 H.264/AAC, WebM, MP3 y WAV suelen ser las opciones más seguras.
- Whisper Tiny es rápido y gratuito, pero puede equivocarse con ruido, música, nombres propios o varias personas hablando.
- La traducción y el doblaje largos consumen memoria. Para equipos modestos conviene trabajar por videos cortos.
- El video final se descarga como WebM porque Chrome puede crearlo sin instalar FFmpeg.

## Privacidad

El video y los textos no se envían a un servidor del autor. Whisper, el traductor alternativo y la voz MMS se ejecutan en el navegador. La primera descarga de cada modelo viene de Hugging Face. Al pegar un enlace, Chrome se conecta directamente al sitio indicado para leer el archivo o sus subtítulos y solicita permiso para ese dominio.

## Componentes abiertos

- [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) — referencia de compatibilidad para consultar las pistas actuales de YouTube; el paquete no se incluye.
- [Omni YouTube Summarizer](https://github.com/rupivbluegreen/omni-youtube-summarizer) — referencia MIT para la estrategia de leer el panel visible de transcripción; su código no se incluye.
- [Transformers.js](https://huggingface.co/docs/transformers.js/index) — Apache-2.0
- [Whisper Tiny English para Transformers.js](https://huggingface.co/onnx-community/whisper-tiny.en)
- [Whisper Tiny multilingüe para audio español](https://huggingface.co/onnx-community/whisper-tiny)
- [OPUS-MT inglés a español](https://huggingface.co/Xenova/opus-mt-en-es)
- [MMS TTS español](https://huggingface.co/Xenova/mms-tts-spa)
- [Piper](https://github.com/OHF-Voice/piper1-gpl)

Las licencias del cargador Transformers.js se incluyen en `vendor/`. Los modelos mantienen sus propias licencias y se descargan desde sus páginas originales.
