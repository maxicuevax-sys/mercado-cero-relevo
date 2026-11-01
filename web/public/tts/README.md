# Voces del demo

Frases fijas pre-renderizadas con **Kokoro-82M** (`ef_dora`, español), licencia
**Apache 2.0**. Se sirven como WAV de 24 kHz para que el demo tenga una voz
consistente y sin latencia de modelo.

Si el texto no está en el mapa `TTS_FILES` de `src/components/caja-app.tsx`, la
app cae a la voz del navegador. Si el audio no puede reproducirse, también cae
al navegador.

## Regenerar

```powershell
pip install kokoro-onnx soundfile
$env:KOKORO_MODEL="C:\ruta\kokoro-v1.0.onnx"
$env:KOKORO_VOICES="C:\ruta\voices-v1.0.bin"
python scripts/generate-tts.py
```

Voces disponibles en Kokoro para español: `ef_dora` (femenina), `em_alex` y
`em_santa` (masculinas). Para cambiar de voz, edita `generate-tts.py` y el mapa
`TTS_FILES` si cambian los slugs.

## Alternativa

**Piper** (`es_MX-claude-high`, MIT) es más rápido en CPU y puede usarse como
fallback o para frases dinámicas. No se incluye en el repo para no arrastrar
63 MB de modelo.
