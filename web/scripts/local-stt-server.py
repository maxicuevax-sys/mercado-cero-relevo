#!/usr/bin/env python3
"""STT local open-source (faster-whisper) para Mercado Cero — sin OpenAI.

POST /transcribe  body = bytes de audio; content-type audio/wav, audio/webm, etc.
GET  /health      {"ok": true, "engine": "faster-whisper", "model": "base"}
"""
from __future__ import annotations

import json
import os
import tempfile
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from faster_whisper import WhisperModel

HOST = os.environ.get("LOCAL_STT_HOST", "127.0.0.1")
PORT = int(os.environ.get("LOCAL_STT_PORT", "4097"))
MODEL_NAME = os.environ.get("LOCAL_STT_MODEL", "base")
MAX_BYTES = 16 * 1024 * 1024
SUFFIX = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
}

print(f"[stt] loading faster-whisper model={MODEL_NAME}", flush=True)
MODEL = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
LOCK = threading.Lock()
print("[stt] model ready", flush=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "MercadoCeroLocalSTT/1.0"

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path.split("?")[0] == "/health":
            self._json(200, {"ok": True, "engine": "faster-whisper", "model": MODEL_NAME})
        else:
            self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.split("?")[0] != "/transcribe":
            self._json(404, {"error": "not_found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BYTES:
                self._json(413, {"error": "audio_size"})
                return
            raw = self.rfile.read(length)
            ctype = (self.headers.get("Content-Type") or "application/octet-stream").split(";")[0].strip()
            suffix = SUFFIX.get(ctype, ".wav")
            fd, tmp = tempfile.mkstemp(prefix="mc-stt-", suffix=suffix)
            os.close(fd)
            try:
                Path(tmp).write_bytes(raw)
                with LOCK:
                    segments, info = MODEL.transcribe(tmp, language="es", vad_filter=True)
                    text = " ".join(s.text.strip() for s in segments if s.text.strip()).strip()
                self._json(200, {"text": text, "language": info.language})
            finally:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
        except Exception as exc:  # noqa: BLE001
            print("[stt] error", repr(exc), flush=True)
            traceback.print_exc()
            self._json(500, {"error": "stt_error"})

    def log_message(self, fmt: str, *args) -> None:
        print("[stt] " + (fmt % args), flush=True)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[stt] listening http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
