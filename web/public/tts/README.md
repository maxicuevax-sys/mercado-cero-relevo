# Voces del demo

Frases fijas pre-renderizadas con **Kokoro-82M** (`em_santa`, español), licencia
**Apache 2.0**. Se sirven como WAV de 24 kHz para que el demo tenga una voz
consistente y sin latencia de modelo.

Las frases dinámicas usan **Piper** (`es_MX-claude-high`, MIT) a través de
`/api/tts`; si Piper no está instalado, la app cae a la voz del navegador.

## Piper

Coloca en `web/data/piper/`:

- `piper.exe` y sus DLLs / `espeak-ng-data` (release de rhasspy/piper).
- `es_MX-claude-high.onnx` y `.onnx.json` (rhasspy/piper-voices).

Opcionalmente define `PIPER_DIR`, `PIPER_BIN` y `PIPER_MODEL`. El endpoint
cachea cada frase en `web/data/tts-cache/` y usa single-flight por hash.

## Regenerar

```powershell
pip install kokoro-onnx soundfile
$env:KOKORO_MODEL="C:\ruta\kokoro-v1.0.onnx"
$env:KOKORO_VOICES="C:\ruta\voices-v1.0.bin"
python scripts/generate-tts.py
```

Voces disponibles en Kokoro para español: `ef_dora` (femenina), `em_alex` y
`em_santa` (masculinas). La app usa `em_santa`; para cambiarla, edita
`generate-tts.py` y vuelve a generar.
