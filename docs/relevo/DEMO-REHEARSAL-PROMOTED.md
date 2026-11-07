# DEMO REHEARSAL â€” PROMOVIDO 48fe63f

**Fecha:** 2026-11-07
**Candidato principal:** `http://127.0.0.1:4580` / LAN `http://192.168.0.2:4580` / Tailscale `http://100.73.205.28:4580`
**Build:** `d3b7f3b83dc245ba18c5c6bc128baa0f2b2adadf`
**Fallback:** `http://127.0.0.1:4497` build `d1fe344fcaa15a5625d09db10a6e049c6464ba03`

## VerificaciÃ³n
- **18/18 rutas + Detalle**, 0 pageerrors en 4580. Raíz `/` redirige a `/inicio`. B1 directo **71/71**; demo-pay **66/66**; security **58/58**.
- Gates sobre el cÃ³digo integrado:
  - security **58/58**
  - demo-pay **66/66**
  - B1 **73/73**
  - build OK
- 4582 y 4581 detenidos; solo 4580 + 4497 activos.
- VPS v4 4604: build `2776b10`, 18/18, aislado.
- 4580 ahora escucha en LAN/Tailscale; 4497 sigue loopback.

## Cel
- Wi-Fi: `http://192.168.0.2:4580`
- Tailscale: `http://100.73.205.28:4580`

## LÃ­mites
- AuditorÃ­a visual completa contra las 24 refs: **pendiente**.
- `paid` real no verificado.
- Tailscale Serve 8443 limitado por ACL; el acceso mÃ³vil es LAN/Tailscale directo.
- No se tocÃ³ CyberPanel/LiteSpeed/mail/DNS/443 ni 4497.
- No merge a `main`; promociÃ³n local/staging.

