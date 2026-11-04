#!/usr/bin/env python3
"""HTTP contract matrix for shell review."""
import json
from pathlib import Path
import urllib.request
import urllib.error

BASE = "http://localhost:3100"
OUT = Path(r"C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero\quality-reports\oleada-b-review\EVIDENCIAS")

routes = [
    "/inicio", "/caja", "/caja?ayuda=1", "/caja?ayuda=1#ajustes",
    "/ventas", "/ventas?page=1", "/ventas?page=2", "/ventas?page=999",
    "/ventas?page=abc", "/ventas?page=0", "/ventas?ayuda=1",
    "/fiados", "/corte", "/metas", "/pendientes",
    "/fiados?ayuda=1", "/corte?ayuda=1#ajustes", "/metas?ayuda=1", "/pendientes?ayuda=1",
    "/", "/?tab=caja", "/?tab=fiado", "/?tab=corte", "/?tab=meta",
    "/?tab=pendientes", "/?tab=inventado", "/?ayuda=1", "/?ayuda=1#ajustes",
    "/pay/inexistente", "/ruta-inexistente",
]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = urllib.request.build_opener(NoRedirect)
rows = []
for route in routes:
    req = urllib.request.Request(BASE + route, method="GET")
    try:
        with opener.open(req, timeout=15) as res:
            status, headers = res.status, dict(res.headers)
    except urllib.error.HTTPError as e:
        status, headers = e.code, dict(e.headers)
    rows.append({
        "route": route,
        "status": status,
        "location": headers.get("Location") or headers.get("location"),
        "cacheControl": headers.get("Cache-Control"),
        "contentType": headers.get("Content-Type"),
        "contentLength": headers.get("Content-Length"),
    })

health = json.load(urllib.request.urlopen(BASE + "/api/health"))
payload = {"base": BASE, "health": health, "routes": rows}
(OUT / "shell-http-matrix.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
lines = [f"BASE {BASE}", f"buildSha {health.get('buildSha')}", ""]
for r in rows:
    lines.append(f"{r['status']:>3}  {r['route']:<38} loc={r['location'] or '-'}  cache={r['cacheControl'] or '-'}")
(OUT / "shell-http-matrix.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
