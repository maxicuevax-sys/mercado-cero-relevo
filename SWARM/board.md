# Tablero — Swarm Mercado Cero

Leyenda: ⬜ backlog · 🔵 en curso · ✅ verificado · ⛔ bloqueado (humano)

## ⛔ Bloqueado (solo humano)

- [ ] **Pago real $0.01** — crear cuenta pey, API key, cuenta receptora (CLABE) y webhook secret. *(Día 0 del plan; único bloqueante crítico. Los agentes solo preparan el checklist.)*
- [ ] **Validación con 6 comerciantes** (Día 4) — trabajo de campo en Coyoacán.
- [ ] Merge a la rama principal de cada carril (orquestador prepara, humano aprueba).
- [ ] Deploy final a Vercel.

## ⬜ Backlog (por carril)

- [ ] **QA** — correr auditorías frescas en producción y emitir reporte: `mobile-audit.py` (25/25), `checkout-audit.py` (19/19), `tunnel-smoke.py` (8/8), `node scripts/webhook-contract.mjs` (34/34), `node scripts/preflight.mjs` (18/18), `node scripts/reconcile.mjs`.
- [ ] **API** — cerrar cualquier gap que QA reporte en webhook, máquina de estados, fiado o corte.
- [ ] **UI** — cerrar gaps de accesibilidad, responsive y contraste sin romper "Mostrador claro".
- [ ] **Pagos** — revisar flujo "Verificar comprobante" (anti-fraude) y conciliación contra pey. **No hubo pago real de $0.01; BBVA/CoDi sigue bloqueado.**
- [ ] **Demo** — ensayos cronometrados ≤3:00, respuestas a las 6 objeciones del `README.md`, QR descargado. El MP4 existente es histórico (UI vieja) y debe regrabarse; no es respaldo actual.

## 🔵 En curso

*(vacío — se llena al correr `SWARM/fire.sh`)*

## ✅ Verificado

- F3 "Mostrador claro" desplegado en producción.
- Lighthouse 100 accesibilidad / 100 best practices / 100 SEO.
- Webhook 34/34 aserciones; auditorías móvil/checkout/túnel pasando al momento del README.
- Ensayo 3/3 corridas, 19/19 pasos, ~8.1 s, `todo en verde: True` en master `75179c7`.
