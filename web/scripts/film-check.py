"""
Film check de Mercado Cero: verifica el MP4 y arma las hojas del stageshow.

Uso:
  cd web
  python scripts/record-demo.py     # primero graba MP4 + frames
  python scripts/film-check.py      # verifica y arma contact/motion sheets

Variables de entorno:
  DEMO_BASE_URL / BASE_URL  URL usada en la grabación (solo metadato)
  DEMO_OUT_DIR              misma carpeta que usó record-demo.py
                            (por defecto <repo>/demo)

Si falta el MP4, el manifiesto o algún frame, falla con un mensaje claro.
No vuelve a recorrer la app: la evidencia visual sale de lo grabado.
Marcadores de salida: MP4, SHEET, MOTION, FILM OK.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from demo_ui import (
    BASE,
    FILM_JSON,
    MP4,
    RECORD_MANIFEST,
    STAGESHOW,
    STAGE_FRAMES,
    DemoFailure,
    display_path,
    probe_video,
    write_json,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

FRAMES: list[tuple[str, str, str]] = [
    ("01", "Caja en reposo", "Voz primero, jerarquía clara y un solo foco."),
    ("02", "Venta dictada", "El pedido aparece con su total y la confirmación a la vista."),
    ("03", "Cobro pendiente", "Un solo cobro, estado pendiente explícito."),
    ("04", "Link y QR", "El QR queda a la vista y la simulación se hace arriba."),
    ("05", "Pago demo", "El resultado dice 'Pago demo (simulado)' y ofrece 'Cerrar demo'."),
    ("06", "Comprobante falso", "La caja rechaza sin ambigüedad."),
    ("07", "Corte", "El conteo compara $550.00 con lo esperado y marca Cuadra."),
    ("08", "Meta", "El avance tiene causa y se queda en pantalla."),
]


MIN_DURATION_SECONDS = 150.0
MIN_BYTES = 1_000_000
EXPECTED_SIZE = (1280, 800)


def font(name: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts") / name,
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def load_manifest() -> dict:
    if not RECORD_MANIFEST.exists():
        raise DemoFailure(
            f"Falta el manifiesto {display_path(RECORD_MANIFEST)}. "
            "Corre primero: python scripts/record-demo.py"
        )
    try:
        manifest = json.loads(RECORD_MANIFEST.read_text(encoding="utf-8"))
    except Exception as exc:
        raise DemoFailure(
            f"No pude leer {display_path(RECORD_MANIFEST)}: {exc}"
        ) from exc
    if not manifest.get("ok") or not manifest.get("allPassed"):
        failed = [
            item
            for item in manifest.get("checks", [])
            if not item.get("ok", False)
        ]
        raise DemoFailure(
            f"El manifiesto de grabación no está en verde: {failed or manifest.get('error')}"
        )
    required = {
        "venta de $90",
        "pago demo confirmado",
        "abono de $50 en efectivo",
        "corte espera $550",
        "corte cuadra",
        "meta avanza a $325",
    }
    present = {item.get("name") for item in manifest.get("checks", [])}
    missing = sorted(required - present)
    if missing:
        raise DemoFailure(
            "La grabación no incluye las verificaciones requeridas: "
            + ", ".join(missing)
        )
    return manifest


def check_frames() -> dict[str, Path]:
    missing: list[str] = []
    images: dict[str, Path] = {}
    for slug, filename in STAGE_FRAMES.items():
        path = STAGESHOW / filename
        if not path.exists() or path.stat().st_size <= 0:
            missing.append(display_path(path))
        else:
            images[slug] = path
    if missing:
        raise DemoFailure(
            "Faltan frames del stageshow: "
            + ", ".join(missing)
            + ". Corre: python scripts/record-demo.py"
        )
    return images


def contact_sheet(images: dict[str, Path], manifest: dict) -> Path:
    columns = 2
    cell_w, cell_h = 600, 375
    label_h = 46
    gap = 22
    header_h = 104
    margin = 24

    rows = (len(FRAMES) + columns - 1) // columns
    width = columns * cell_w + (columns + 1) * margin
    height = header_h + rows * (cell_h + label_h) + (rows - 1) * gap + margin
    sheet = Image.new("RGB", (width, height), "#F3EEE5")
    draw = ImageDraw.Draw(sheet)

    serif = font("georgia.ttf", 30)
    sans_bold = font("segoeui.ttf", 16)
    sans = font("segoeui.ttf", 12)
    accent = "#0B5A43"
    ink = "#1B241F"
    muted = "#5F6B63"

    duration = manifest.get("video", {}).get("durationSeconds")
    duration_text = f" · {duration:.1f} s" if isinstance(duration, (int, float)) else ""
    draw.text((margin, 28), "Mercado Cero · film check", font=serif, fill=ink)
    draw.text(
        (margin, 68),
        f"1280 × 800 · flujo real{duration_text} · {date.today().isoformat()}",
        font=sans,
        fill=muted,
    )
    draw.line(
        [(margin, header_h - 14), (width - margin, header_h - 14)],
        fill="#D9D2C5",
        width=1,
    )

    for index, (slug, title, note) in enumerate(FRAMES):
        row, column = divmod(index, columns)
        x = margin + column * (cell_w + margin)
        y = header_h + row * (cell_h + label_h + gap)
        image = Image.open(images[slug]).convert("RGB").resize((cell_w, cell_h))
        sheet.paste(image, (x, y))
        draw.rectangle([x, y, x + cell_w, y + cell_h], outline="#D9D2C5", width=1)
        draw.text((x, y + cell_h + 9), f"{slug}  {title}", font=sans_bold, fill=ink)
        draw.text((x, y + cell_h + 29), note, font=sans, fill=muted)
        draw.rectangle([x, y, x + 4, y + cell_h], fill=accent)

    destination = STAGESHOW / "contact-sheet-1280.png"
    sheet.save(destination)
    return destination


def motion_sheet(video: Path, duration: float) -> Path:
    if not shutil.which("ffmpeg"):
        raise DemoFailure(
            "ffmpeg no está en PATH; no puedo extraer los cuadros del MP4."
        )
    frames_dir = STAGESHOW / "motion"
    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    frames_dir.mkdir(parents=True)

    count = 8
    samples: list[tuple[Path, float]] = []
    for index in range(count):
        timestamp = max(0.2, duration * (index + 0.5) / count)
        target = frames_dir / f"frame-{index + 1:02d}.png"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-ss",
                f"{timestamp:.2f}",
                "-i",
                str(video),
                "-frames:v",
                "1",
                "-vf",
                "scale=400:250",
                str(target),
            ],
            check=False,
        )
        if target.exists() and target.stat().st_size > 0:
            samples.append((target, timestamp))
    if len(samples) < 4:
        raise DemoFailure(
            f"No pude extraer cuadros de {display_path(video)}; "
            f"solo {len(samples)}/{count}."
        )

    cell_w, cell_h = 400, 250
    gap, margin, columns = 12, 20, 4
    rows = (len(samples) + columns - 1) // columns
    width = margin * 2 + columns * cell_w + (columns - 1) * gap
    height = 74 + rows * (cell_h + 26) + (rows - 1) * gap + margin
    sheet = Image.new("RGB", (width, height), "#F3EEE5")
    draw = ImageDraw.Draw(sheet)
    draw.text(
        (margin, 18),
        "Mercado Cero · motion check",
        font=font("georgia.ttf", 24),
        fill="#1B241F",
    )
    draw.text(
        (margin, 48),
        f"MP4 · 1280 × 800 · {len(samples)} momentos de {duration:.1f} s",
        font=font("segoeui.ttf", 12),
        fill="#5F6B63",
    )
    for index, (frame, timestamp) in enumerate(samples):
        row, column = divmod(index, columns)
        x = margin + column * (cell_w + gap)
        y = 74 + row * (cell_h + 26 + gap)
        image = Image.open(frame).convert("RGB").resize((cell_w, cell_h))
        sheet.paste(image, (x, y))
        draw.rectangle([x, y, x + cell_w, y + cell_h], outline="#D9D2C5", width=1)
        draw.text(
            (x, y + cell_h + 5),
            f"{timestamp:.1f}s",
            font=font("segoeui.ttf", 14),
            fill="#1B241F",
        )
    destination = STAGESHOW / "motion-sheet.png"
    sheet.save(destination)
    return destination


def verify_manifest_matches(manifest: dict, video: dict) -> None:
    recorded_bytes = manifest.get("mp4Bytes")
    if isinstance(recorded_bytes, int) and recorded_bytes != video["bytes"]:
        raise DemoFailure(
            "El MP4 no corresponde al manifiesto de grabación "
            f"(bytes {video['bytes']} vs {recorded_bytes}). "
            "Vuelve a correr python scripts/record-demo.py."
        )
    recorded_duration = manifest.get("video", {}).get("durationSeconds")
    if isinstance(recorded_duration, (int, float)):
        if abs(float(recorded_duration) - float(video["durationSeconds"])) > 1.5:
            raise DemoFailure(
                "La duración del MP4 no corresponde al manifiesto "
                f"({video['durationSeconds']} s vs {recorded_duration} s)."
            )


def verify_video_is_final(video: dict) -> None:
    """Rechaza el MP4 histórico (39.8 s) aunque exista y se llame igual."""
    if float(video["durationSeconds"]) < MIN_DURATION_SECONDS:
        raise DemoFailure(
            f"El MP4 dura {video['durationSeconds']:.1f} s, menos de "
            f"{MIN_DURATION_SECONDS:.0f} s: parece el video viejo, no el guion "
            "de ~3 minutos. Vuelve a correr python scripts/record-demo.py."
        )
    if int(video["bytes"]) < MIN_BYTES:
        raise DemoFailure(
            f"El MP4 pesa {video['bytes']} B, menos de {MIN_BYTES} B: "
            "no parece la grabación final. Vuelve a correr record-demo.py."
        )
    size = (int(video["width"]), int(video["height"]))
    if size != EXPECTED_SIZE:
        raise DemoFailure(
            f"El MP4 mide {size[0]}x{size[1]}; se esperaba "
            f"{EXPECTED_SIZE[0]}x{EXPECTED_SIZE[1]}."
        )


def main() -> int:
    started = time.time()
    try:
        if not MP4.exists():
            raise DemoFailure(
                f"Falta el MP4 {display_path(MP4)}. "
                "Corre primero: python scripts/record-demo.py"
            )
        manifest = load_manifest()
        video = probe_video(MP4)
        verify_video_is_final(video)
        verify_manifest_matches(manifest, video)
        images = check_frames()
        sheet = contact_sheet(images, manifest)
        motion = motion_sheet(MP4, video["durationSeconds"])
    except DemoFailure as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR inesperado en film-check: {exc!r}", file=sys.stderr)
        return 1

    elapsed = time.time() - started
    checks = {
        "mp4Exists": True,
        "mp4DurationSeconds": video["durationSeconds"],
        "mp4Bytes": video["bytes"],
        "mp4Codec": video["codec"],
        "mp4Size": f"{video['width']}x{video['height']}",
        "frames": len(images),
        "framesExpected": len(STAGE_FRAMES),
        "recordManifest": display_path(RECORD_MANIFEST),
        "recordAllPassed": bool(manifest.get("allPassed")),
        "corte550": any(
            item.get("name") == "corte espera $550" and item.get("ok")
            for item in manifest.get("checks", [])
        ),
        "cuadra": any(
            item.get("name") == "corte cuadra" and item.get("ok")
            for item in manifest.get("checks", [])
        ),
        "contactSheet": display_path(sheet),
        "motionSheet": display_path(motion),
    }
    payload = {
        "ok": True,
        "base": manifest.get("base") or BASE,
        "mp4": display_path(MP4),
        "mp4Sha256": video["sha256"],
        "video": {
            "durationSeconds": video["durationSeconds"],
            "bytes": video["bytes"],
            "codec": video["codec"],
            "width": video["width"],
            "height": video["height"],
            "frameRate": video["frameRate"],
        },
        "frames": [
            {
                "slug": slug,
                "title": title,
                "note": note,
                "path": display_path(images[slug]),
            }
            for slug, title, note in FRAMES
        ],
        "checks": checks,
        "elapsedSeconds": round(elapsed, 1),
    }
    write_json(FILM_JSON, payload)

    print(
        f"MP4 {display_path(MP4)} · {video['durationSeconds']:.1f} s · "
        f"{video['bytes'] / 1024 / 1024:.1f} MB · "
        f"{video['width']}x{video['height']} {video['codec']}"
    )
    print(f"FRAMES {len(images)}/{len(STAGE_FRAMES)}")
    print(f"SHEET {display_path(sheet)}")
    print(f"MOTION {display_path(motion)}")
    print(f"JSON {display_path(FILM_JSON)}")
    print(f"LISTO {elapsed:.1f} s")
    print("FILM OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
