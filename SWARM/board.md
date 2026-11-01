# Tablero — Swarm Mercado Cero

Leyenda: ⬜ backlog · 🔵 en curso · ✅ verificado · ⛔ bloqueado (humano)

## ⛔ Bloqueado (solo humano)

- [ ] **Pago real $0.01** — crear cuenta pey, API key, cuenta receptora (CLABE) y webhook secret. *(Día 0 del plan; único bloqueante crítico. Los agentes solo preparan el checklist.)*
- [ ] **Validación con 6 comerciantes** (Día 4) — trabajo de campo en Coyoacán.
- [ ] Merge a la rama principal de cada carril (orquestador prepara, humano aprueba).
- [ ] Deploy final a Vercel.

## ⬜ Backlog (por carril)

- [ ] **QA** — correr auditorías frescas en producción y emitir reporte: `mobile-audit.py` (25/25), `checkout-audit.py` (15/15), `tunnel-smoke.py` (8/8), `node scripts/webhook-contract.mjs` (27/27), `node scripts/preflight.mjs` (18/18), `node scripts/reconcile.mjs`.
- [ ] **API** — cerrar cualquier gap que QA reporte en webhook, máquina de estados, fiado o corte.
- [ ] **UI** — cerrar gaps de accesibilidad, responsive y contraste sin romper "Mostrador claro".
- [ ] **Pagos** — revisar flujo "Verificar comprobante" (anti-fraude) y conciliación contra pey.
- [ ] **Demo** — 5 ensayos cronometrados ≤3:00, respuestas a las 6 objeciones del `README.md`, backup QR + video descargados al teléfono.

## 🔵 En curso

*(vacío — se llena al correr `SWARM/fire.sh`)*

## ✅ Verificado

- F3 "Mostrador claro" desplegado en producción.
- Lighthouse 100 accesibilidad / 100 best practices / 100 SEO.
- Webhook 27/27 aserciones; auditorías móvil/checkout/túnel pasando al momento del README.
- Ensayo 14/14 pasos, promedio 4.8 s de flujo mecánico.
