# Voz del abono de $50 · Kokoro `em_santa`

> Arreglo del 2 de noviembre de 2026. Commits: `47702f5` (endpoint + WAV) y `1812e0c` (cliente).

## Síntoma

El botón **“Juan me pagó 50 del fiado”** mostraba “Revisa el abono de $50.00 a Juan.”, pero
sonaba la voz dinámica de Piper, no el WAV Kokoro del demo. Además, los motores leían
`$50.00` como **“cincuenta punto cero cero”**.

## Causa

1. P0-C cambió la confirmación del abono a `speak()` dinámico → `/api/tts` (Piper).
2. El mapa de frases fijas solo tenía la frase posterior al abono, no la de revisión.
3. Los WAV fijos de $90 se habían generado con `90.00 pesos` y también se oían como
   “cero cero pesos”.

## Arreglo

- `/api/tts` normaliza montos antes de elegir voz:
  `$50.00` → “50 pesos”, `$0.00` → “cero pesos”, `$1,800.00` → “1800 pesos”,
  `$50.50` → “50 pesos con 50 centavos”.
- La frase exacta **“Revisa el abono de 50 pesos a Juan”** está fijada al WAV
  `revisa-abono-50-juan.wav` (Kokoro `em_santa`), tanto en `/api/tts` como en
  `TTS_FILES`.
- Se regeneraron las frases fijas de $90 con montos hablados.
- Las URLs de `TTS_FILES` llevan `?v=2` para invalidar el audio viejo del navegador.

## Evidencia

| Prueba | Resultado |
|---|---|
| WAV `revisa-abono-50-juan.wav` | 2.603 s · SHA-256 `24EF2C9F7B033DC7D3BAD2941053363F0756348B88A92508D569830033AEF4FC` |
| WAV `abono-50-juan.wav` | 3.157 s · SHA-256 `9572468BF7B9088AE397B3BCF784FC9A634BC4201417E78560AA66F066938FC5` |
| Botón real (Playwright, 390 px) | reproduce `/tts/revisa-abono-50-juan.wav?v=2`, bytes idénticos al WAV; **0** llamadas a `speechSynthesis` |
| Transcripción (faster-whisper `base`, es) | “Revisa el abono de 50 pesos a Juan.” |
| `$90.00` fijo | “Venta cobrada. 90 pesos.” · “Pago simulado. 90 pesos.” · “Pago verificado: 90 pesos.” |
| Dinámica `$70.00` | Piper: “Hoy llevas 70 pesos en una venta…” |
| Dinámica `$1,800.00` / `$0.00` / `$50.50` | “mil ochocientos pesos” / “cero pesos” / “cincuenta pesos con cincuenta centavos” |

## Cómo comprobarlo

1. Recarga la página una vez (el navegador guarda el blob anterior en memoria).
2. Pulsa **“Juan me pagó 50 del fiado”**.
3. Debe sonar el WAV Kokoro y decir “Revisa el abono de 50 pesos a Juan.”

## KNOWN

- El reconocedor base transcribe la “r” inicial de “Revisa” como “Previsa”; el texto y la
  locución son correctos. No se cambió la copia para no alterar el guion.
- Otros montos siguen usando Piper (voz dinámica elegida). Solo las frases fijas usan Kokoro.
- Ya **no hay fallback a `speechSynthesis`**: si el audio elegido no se puede reproducir, la
  app no habla con otra voz; el texto sigue en pantalla. Se prefiere silencio a una voz distinta.
