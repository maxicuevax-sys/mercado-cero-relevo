"""
Utilidades compartidas para grabar y verificar la demo de Mercado Cero.

La app se va a rediseñar. Por eso aquí no hay selectores de clases Tailwind:
todo se busca por rol + nombre visible, con cadenas alternativas y
fallbacks. Si un rediseño cambia "Caja" por otra etiqueta, se agrega la
variante en las listas de patrones de este archivo.

Variables de entorno:
  DEMO_BASE_URL / BASE_URL  URL del servidor. Obligatoria: no hay puerto por
                            defecto (el carril aislado usa :3310, la app local
                            puede usar otro).
  DEMO_OUT_DIR              carpeta de artefactos (por defecto <repo>/demo)
  DEMO_RESET_TOKEN          token opcional para /api/demo/reset
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Sequence

from playwright.sync_api import (
    Locator,
    Page,
    TimeoutError as PlaywrightTimeoutError,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]


def _base_url() -> str:
    raw = (
        os.environ.get("DEMO_BASE_URL")
        or os.environ.get("BASE_URL")
        or ""
    )
    return raw.strip().rstrip("/")


def _out_dir() -> Path:
    raw = os.environ.get("DEMO_OUT_DIR", "").strip()
    if not raw:
        return ROOT / "demo"
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = ROOT / path
    return path.resolve()


BASE = _base_url()
OUT = _out_dir()
STAGESHOW = OUT / "stageshow"
MP4 = OUT / "mercado-cero-demo.mp4"
RECORD_MANIFEST = OUT / "record-demo.json"
FILM_JSON = STAGESHOW / "film-check.json"

# Nombres estables de los ocho beats del stageshow. film-check.py los exige.
STAGE_FRAMES: dict[str, str] = {
    "01": "01-caja-en-reposo.png",
    "02": "02-venta-dictada.png",
    "03": "03-cobro-pendiente.png",
    "04": "04-link-y-qr.png",
    "05": "05-pago-simulado.png",
    "06": "06-comprobante-falso.png",
    "07": "07-corte.png",
    "08": "08-meta.png",
}


class DemoFailure(RuntimeError):
    """Falla legible de la demo; el script la imprime sin traceback crudo."""


def require_base() -> str:
    """Falla claro si falta la URL; no asume :3000 ni ningún otro puerto."""
    if not BASE:
        raise DemoFailure(
            "Falta DEMO_BASE_URL o BASE_URL. Ejemplo: "
            "$env:DEMO_BASE_URL='http://127.0.0.1:3310'; "
            "python scripts/record-demo.py"
        )
    return BASE


def ensure_dirs() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    STAGESHOW.mkdir(parents=True, exist_ok=True)
    (OUT / "video").mkdir(parents=True, exist_ok=True)


def display_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def unique_ip(tag: str = "") -> str:
    """IP de TEST-NET-3 distinta por corrida para no compartir rate limit."""
    seed = f"{os.getpid()}-{time.time_ns()}-{tag}".encode("utf-8")
    octet = 1 + hashlib.sha256(seed).digest()[0] % 254
    return f"203.0.113.{octet}"


def _reset_response(page: Page, tag: str):
    base = require_base()
    ip = unique_ip(tag)
    headers = {
        "x-forwarded-for": ip,
        "cf-connecting-ip": ip,
        "x-real-ip": ip,
    }
    token = os.environ.get("DEMO_RESET_TOKEN", "").strip()
    if token:
        headers["x-demo-token"] = token
    return page.request.post(
        f"{base}/api/demo/reset", headers=headers, timeout=30_000
    ), ip


def reset_demo(page: Page, *, tag: str = "demo") -> str:
    """Reinicia la demo y devuelve la IP usada (para el reset final)."""
    base = require_base()
    response, ip = _reset_response(page, tag)
    if not response.ok:
        body = response.text()[:500]
        raise DemoFailure(
            f"POST {base}/api/demo/reset falló con HTTP {response.status}. "
            f"Respuesta: {body}"
        )
    try:
        payload = response.json()
    except Exception:
        payload = {}
    if payload.get("ok") is False:
        raise DemoFailure(f"La demo no se reinició: {payload}")
    return ip


def reset_demo_quiet(page: Page, *, tag: str = "cleanup") -> None:
    """Reset sin navegar; se usa al final para dejar la caja limpia."""
    try:
        response, _ip = _reset_response(page, tag)
        if not response.ok:
            print(
                f"AVISO: reset final HTTP {response.status}; "
                "la demo queda como estaba.",
                file=sys.stderr,
            )
    except Exception as exc:  # noqa: BLE001 - el reset final no debe romper la grabación
        print(f"AVISO: no pude reiniciar la demo al final: {exc}", file=sys.stderr)


def _body_text(page: Page) -> str:
    try:
        return page.evaluate(
            "() => (document.body?.innerText || '').replace(/\\s+/g, ' ').trim()"
        )
    except Exception:
        return ""


def _button_names(page: Page) -> list[str]:
    try:
        names = page.get_by_role("button").all_inner_texts()
    except Exception:
        return []
    clean = []
    for name in names:
        text = re.sub(r"\s+", " ", name).strip()
        if text:
            clean.append(text[:70])
    return clean[:30]


def _dialog_titles(page: Page) -> list[str]:
    titles: list[str] = []
    try:
        dialogs = page.get_by_role("dialog")
        for index in range(min(dialogs.count(), 5)):
            try:
                titles.append(
                    re.sub(r"\s+", " ", dialogs.nth(index).inner_text()).strip()[:180]
                )
            except Exception:
                continue
    except Exception:
        pass
    return titles


def wait_text(
    page: Page, needle: str, timeout: int = 15_000, *, description: str | None = None
) -> None:
    """Espera texto visible. innerText ignora pestañas/hojas ocultas."""
    try:
        page.wait_for_function(
            "(needle) => (document.body?.innerText || '').includes(needle)",
            arg=needle,
            timeout=timeout,
        )
    except PlaywrightTimeoutError as exc:
        label = description or repr(needle)
        raise DemoFailure(
            f"No apareció {label} en {timeout} ms. URL: {page.url}. "
            f"Texto visible: {_body_text(page)[:600]!r}. "
            f"Botones: {_button_names(page)}. Hojas: {_dialog_titles(page)}"
        ) from exc


def wait_regex(
    page: Page, pattern: str, timeout: int = 15_000, *, description: str | None = None
) -> None:
    try:
        page.wait_for_function(
            "(pattern) => new RegExp(pattern, 'i').test(document.body?.innerText || '')",
            arg=pattern,
            timeout=timeout,
        )
    except PlaywrightTimeoutError as exc:
        label = description or pattern
        raise DemoFailure(
            f"No apareció /{label}/ en {timeout} ms. URL: {page.url}. "
            f"Texto visible: {_body_text(page)[:600]!r}"
        ) from exc


def wait_any_text(
    page: Page,
    needles: Sequence[str],
    timeout: int = 15_000,
    *,
    description: str | None = None,
) -> str:
    try:
        page.wait_for_function(
            "(needles) => { const text = document.body?.innerText || ''; "
            "return needles.find((needle) => text.includes(needle)) || false; }",
            arg=list(needles),
            timeout=timeout,
        )
    except PlaywrightTimeoutError as exc:
        label = description or " ninguno de " + repr(list(needles))
        raise DemoFailure(
            f"No apareció {label} en {timeout} ms. URL: {page.url}. "
            f"Texto visible: {_body_text(page)[:600]!r}"
        ) from exc
    text = _body_text(page)
    for needle in needles:
        if needle in text:
            return needle
    return needles[0]


def wait_app_ready(page: Page, timeout: int = 30_000) -> None:
    """Caja lista: copy actual con fallback al de la UI anterior."""
    try:
        page.wait_for_function(
            """() => {
              const text = document.body?.innerText || '';
              const caja =
                /Caja|Vender hoy|Apunta lo que vendiste|¿Qué vendiste\\?/i.test(text);
              const totales =
                /Ventas registradas hoy|Cobrado confirmado|Por cobrar de hoy|Hoy \\$|Por cobrar|Fiado \\$/.test(text);
              return caja && totales;
            }""",
            timeout=timeout,
        )
    except PlaywrightTimeoutError as exc:
        raise DemoFailure(
            f"La caja no quedó lista en {timeout} ms. URL: {page.url}. "
            f"Texto visible: {_body_text(page)[:800]!r}. "
            f"Botones: {_button_names(page)}"
        ) from exc


def goto_app(page: Page, timeout: int = 30_000) -> None:
    base = require_base()
    page.goto(base, wait_until="domcontentloaded", timeout=timeout)
    wait_app_ready(page, timeout=timeout)


def open_app(page: Page, *, tag: str = "demo") -> str:
    """Abre la app y reinicia la demo. Devuelve la IP usada."""
    goto_app(page)
    ip = reset_demo(page, tag=tag)
    page.reload(wait_until="domcontentloaded")
    wait_app_ready(page)
    page.wait_for_timeout(350)
    return ip


def _click_in(
    root: Page | Locator,
    page: Page,
    patterns: Sequence[str],
    roles: Sequence[str],
    timeout: int,
    description: str,
) -> Locator:
    """Espera a que aparezca un control visible y habilitado.

    No basta con buscar una vez: tras generar un link, el botón de simulación
    se monta un instante después de que el texto "Esperando al banco" ya está
    en pantalla. También cubre botones que nacen deshabilitados.
    """
    deadline = time.time() + timeout / 1000
    last_error: Exception | None = None
    while time.time() < deadline:
        for pattern in patterns:
            regex = re.compile(pattern, re.IGNORECASE)
            for role in roles:
                try:
                    matches = root.get_by_role(role, name=regex)  # type: ignore[arg-type]
                    count = matches.count()
                except Exception:
                    continue
                for index in range(min(count, 5)):
                    candidate = matches.nth(index)
                    try:
                        if not candidate.is_visible():
                            continue
                        if not candidate.is_enabled():
                            continue
                        remaining = max(400, int((deadline - time.time()) * 1000))
                        candidate.click(timeout=min(remaining, 4_000))
                        return candidate
                    except Exception as exc:  # noqa: BLE001
                        last_error = exc
                        continue
        page.wait_for_timeout(120)
    suffix = f" Último error: {last_error}" if last_error else ""
    raise DemoFailure(
        f"No encontré {description}. Patrones: {list(patterns)}. "
        f"URL: {page.url}. Botones: {_button_names(page)}. "
        f"Hojas: {_dialog_titles(page)}.{suffix}"
    )


def click_named(
    page: Page,
    patterns: Sequence[str],
    *,
    scope: Page | Locator | None = None,
    timeout: int = 6_000,
    description: str = "la acción",
) -> Locator:
    """Busca por rol + nombre visible, no por clase CSS."""
    root = scope or page
    return _click_in(
        root,
        page,
        patterns,
        ("button", "link", "tab", "menuitem", "radio", "checkbox", "option"),
        timeout,
        description,
    )


def click_text(
    page: Page,
    text: str,
    *,
    scope: Page | Locator | None = None,
    exact: bool = True,
    timeout: int = 6_000,
    description: str | None = None,
) -> Locator:
    root = scope or page
    try:
        matches = root.get_by_text(text, exact=exact)  # type: ignore[arg-type]
        for index in range(min(matches.count(), 5)):
            candidate = matches.nth(index)
            if candidate.is_visible():
                candidate.click(timeout=timeout)
                return candidate
    except Exception as exc:  # noqa: BLE001
        raise DemoFailure(
            f"No pude tocar {description or repr(text)}. {exc}. "
            f"URL: {page.url}. Texto: {_body_text(page)[:500]!r}"
        ) from exc
    raise DemoFailure(
        f"No encontré el texto {description or repr(text)}. URL: {page.url}. "
        f"Texto: {_body_text(page)[:500]!r}"
    )


def _fill_in(
    root: Page | Locator,
    patterns: Sequence[str],
    value: str,
    description: str,
    timeout: int,
) -> Locator:
    deadline = time.time() + timeout / 1000
    last_error: Exception | None = None
    while time.time() < deadline:
        for pattern in patterns:
            regex = re.compile(pattern, re.IGNORECASE)
            for getter in (root.get_by_label, root.get_by_placeholder):
                try:
                    matches = getter(regex)  # type: ignore[arg-type]
                    count = matches.count()
                except Exception:
                    continue
                for index in range(min(count, 5)):
                    candidate = matches.nth(index)
                    try:
                        if not candidate.is_visible():
                            continue
                        if not candidate.is_editable():
                            continue
                        candidate.fill(str(value))
                        return candidate
                    except Exception as exc:  # noqa: BLE001
                        last_error = exc
                        continue
        time.sleep(0.12)
    suffix = f" Último error: {last_error}" if last_error else ""
    raise DemoFailure(f"No encontré el campo {description}.{suffix}")


def fill_named(
    page: Page,
    patterns: Sequence[str],
    value: str,
    *,
    scope: Page | Locator | None = None,
    description: str = "el campo",
    timeout: int = 8_000,
) -> Locator:
    root = scope or page
    return _fill_in(
        root,
        patterns,
        value,
        f"{description} (patrones: {list(patterns)})",
        timeout,
    )


def blur(page: Page) -> None:
    try:
        page.evaluate(
            "() => { const el = document.activeElement; "
            "if (el instanceof HTMLElement) el.blur(); }"
        )
    except Exception:
        pass


def wait_dialog(
    page: Page,
    *,
    timeout: int = 12_000,
    title: str | None = None,
    required: bool = True,
) -> Locator | None:
    try:
        dialog = page.get_by_role("dialog").last
        dialog.wait_for(state="visible", timeout=timeout)
    except PlaywrightTimeoutError:
        if not required:
            return None
        raise DemoFailure(
            f"No se abrió la hoja esperada en {timeout} ms. URL: {page.url}. "
            f"Texto visible: {_body_text(page)[:600]!r}. "
            f"Botones: {_button_names(page)}"
        )
    if title:
        try:
            visible = dialog.inner_text()
        except Exception:
            visible = ""
        if not re.search(title, visible, re.IGNORECASE):
            raise DemoFailure(
                f"La hoja abierta no contiene /{title}/. "
                f"Contenido: {re.sub(r'\\s+', ' ', visible)[:400]!r}"
            )
    return dialog


def last_dialog(page: Page) -> Locator:
    return page.get_by_role("dialog").last


def dialog_open(page: Page) -> bool:
    try:
        return page.get_by_role("dialog").count() > 0
    except Exception:
        return False


def close_sheets(page: Page, *, timeout: int = 10_000) -> bool:
    """Cierra hojas por su botón Cerrar/Entendido o con Escape.

    Nunca toca "Listo para entregar": un pago demo no se entrega.
    """
    deadline = time.time() + timeout / 1000
    while time.time() < deadline:
        if not dialog_open(page):
            return True
        dialog = last_dialog(page)
        for pattern in (
            r"^Cerrar demo$",
            r"^Cerrar$",
            r"^Entendido$",
            r"^Descartar abono$",
        ):
            try:
                button = dialog.get_by_role(
                    "button", name=re.compile(pattern, re.IGNORECASE)
                ).first
                if button.count() and button.is_visible():
                    button.click(timeout=1_500)
                    page.wait_for_timeout(180)
                    break
            except Exception:
                continue
        else:
            page.keyboard.press("Escape")
            page.wait_for_timeout(220)
    return not dialog_open(page)


def open_tab(page: Page, *labels: str, timeout: int = 8_000) -> None:
    """Abre una pestaña por nombre visible, con alias del rediseño."""
    patterns: list[str] = []
    for label in labels:
        clean = label.strip()
        if clean.lower() == "pendientes":
            patterns.extend(
                [r"^Pendientes$", r"^Tareas$", r"^Tareas \(Pendientes\)$"]
            )
        elif clean.lower() == "fiado":
            patterns.extend([r"^Fiado$", r"^Fiar$"])
        elif clean.lower() == "caja":
            patterns.extend([r"^Caja$", r"^Vender$", r"^Vender hoy$"])
        else:
            patterns.append(rf"^{re.escape(clean)}$")
    try:
        click_named(
            page,
            patterns,
            timeout=4_000,
            description=f"la pestaña {'/'.join(labels)}",
        )
    except DemoFailure as exc:
        raise DemoFailure(
            f"No pude abrir la pestaña {'/'.join(labels)}. {exc}"
        ) from exc
    page.wait_for_timeout(300)


def api_get(page: Page, path: str) -> dict:
    base = require_base()
    response = page.request.get(f"{base}{path}", timeout=30_000)
    if not response.ok:
        raise DemoFailure(
            f"GET {base}{path} falló con HTTP {response.status}: "
            f"{response.text()[:400]}"
        )
    try:
        return response.json()
    except Exception as exc:
        raise DemoFailure(f"GET {base}{path} no devolvió JSON: {exc}") from exc


def probe_video(path: Path) -> dict:
    if not path.exists():
        raise DemoFailure(
            f"Falta el MP4 {display_path(path)}. Corre: python scripts/record-demo.py"
        )
    if path.stat().st_size <= 0:
        raise DemoFailure(f"El MP4 {display_path(path)} está vacío.")
    if not shutil.which("ffprobe"):
        raise DemoFailure(
            "ffprobe no está en PATH; no puedo verificar el MP4. "
            "Instala ffmpeg (incluye ffprobe)."
        )
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_name,width,height,r_frame_rate:format=duration,size,format_name",
            "-of",
            "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise DemoFailure(
            f"ffprobe no pudo leer {display_path(path)}: {result.stderr[:500]}"
        )
    try:
        data = json.loads(result.stdout)
    except Exception as exc:
        raise DemoFailure(f"ffprobe devolvió JSON inválido: {exc}") from exc
    streams = data.get("streams") or []
    if not streams:
        raise DemoFailure(f"El MP4 {display_path(path)} no tiene pista de video.")
    stream = streams[0]
    fmt = data.get("format") or {}
    try:
        duration = float(fmt.get("duration") or 0)
    except (TypeError, ValueError):
        duration = 0.0
    try:
        size = int(fmt.get("size") or path.stat().st_size)
    except (TypeError, ValueError):
        size = path.stat().st_size
    if duration <= 0:
        raise DemoFailure(f"El MP4 {display_path(path)} no reporta duración.")
    return {
        "path": display_path(path),
        "bytes": size,
        "durationSeconds": round(duration, 2),
        "codec": stream.get("codec_name"),
        "width": stream.get("width"),
        "height": stream.get("height"),
        "frameRate": stream.get("r_frame_rate"),
        "format": fmt.get("format_name"),
        "sha256": sha256_file(path),
    }


def transcode(webm: Path, mp4: Path) -> None:
    if not shutil.which("ffmpeg"):
        raise DemoFailure(
            "ffmpeg no está en PATH; no puedo generar demo/mercado-cero-demo.mp4."
        )
    mp4.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(webm),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-an",
            str(mp4),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0 or not mp4.exists() or mp4.stat().st_size <= 0:
        raise DemoFailure(
            f"ffmpeg no pudo convertir el WebM a MP4: {result.stderr[:600]}"
        )


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
