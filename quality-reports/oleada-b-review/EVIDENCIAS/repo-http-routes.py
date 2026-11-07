import json
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
PATHS = [
    "/",
    "/inicio",
    "/caja",
    "/ventas",
    "/ventas?page=2",
    "/ventas?page=999",
    "/ventas?page=abc",
    "/ventas?ayuda=1",
    "/caja?tab=fiado",
    "/caja/",
    "/ventas/",
    "/fiados",
    "/fiados?ayuda=1",
    "/corte",
    "/metas",
    "/pendientes",
    "/?tab=corte",
    "/?tab=ventas",
    "/?ayuda=1",
    "/pay/ord_nope",
    "/pay/ord_nope/success",
    "/nope",
]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = urllib.request.build_opener(NoRedirect)
rows = []
for path in PATHS:
    req = urllib.request.Request(BASE + path, method="GET")
    try:
        resp = opener.open(req, timeout=15)
        status = resp.status
        headers = resp.headers
        body = resp.read(4000).decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        status = exc.code
        headers = exc.headers
        body = exc.read(4000).decode("utf-8", "replace")
    title = ""
    if "<title>" in body:
        title = body.split("<title>", 1)[1].split("</title>", 1)[0]
    rows.append(
        {
            "path": path,
            "status": status,
            "location": headers.get("Location"),
            "cacheControl": headers.get("Cache-Control"),
            "title": title,
        }
    )
    print(json.dumps(rows[-1], ensure_ascii=False))

(HERE / "repo-http-routes.json").write_text(
    json.dumps({"base": BASE, "rows": rows}, ensure_ascii=False, indent=2), encoding="utf-8"
)
