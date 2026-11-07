"""
Genera las frases fijas del demo con Kokoro-82M (Apache 2.0).

Requisitos:
  pip install kokoro-onnx soundfile
  Modelos: kokoro-v1.0.onnx y voices-v1.0.bin
  (https://github.com/thewh1teagle/kokoro-onnx/releases)

Uso:
  set KOKORO_MODEL=C:\\ruta\\kokoro-v1.0.onnx
  set KOKORO_VOICES=C:\\ruta\\voices-v1.0.bin
  python scripts/generate-tts.py

Si kokoro-onnx falla con "speed expected float", actualiza el paquete o
parchea `_create_audio` para enviar `speed` como float32.
"""

from __future__ import annotations

import os
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

# Los montos van sin "$" ni ".00": los motores TTS leen "$50.00" como
# "cincuenta punto cero cero". Para oído, "50 pesos" es inequívoco.
LINES = {
    "son-90-genero-el-cobro": "Escuché 90 pesos. ¿Confirmas?",
    "venta-cobrada-90": "Venta cobrada. 90 pesos.",
    "pago-simulado-90": "Pago simulado. 90 pesos.",
    "pago-verificado-90": "Pago verificado: 90 pesos.",
    "abono-50-juan": "Abono de 50 pesos a Juan. Saldo: cero pesos.",
    "revisa-abono-50-juan": "Revisa el abono de 50 pesos a Juan.",
    "venta-lista": "Venta lista para confirmar.",
    "comprobante-verificado-demo": "Comprobante verificado en la caja. En producción se valida contra pey.",
    "comprobante-no-verificado": "Ese comprobante no está verificado. No entregues el pedido.",
}


def main() -> None:
    model = os.environ.get("KOKORO_MODEL")
    voices = os.environ.get("KOKORO_VOICES")
    if not model or not voices:
        raise SystemExit("Define KOKORO_MODEL y KOKORO_VOICES.")

    out_dir = Path(__file__).resolve().parents[1] / "public" / "tts"
    out_dir.mkdir(parents=True, exist_ok=True)
    kokoro = Kokoro(model, voices)

    for slug, text in LINES.items():
        samples, rate = kokoro.create(text, voice="em_santa", speed=1.0, lang="es")
        path = out_dir / f"{slug}.wav"
        sf.write(path, samples, rate)
        print(f"{slug}: {len(samples) / rate:.2f}s -> {path}")


if __name__ == "__main__":
    main()
