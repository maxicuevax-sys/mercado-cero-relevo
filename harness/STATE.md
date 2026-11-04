# STATE — Mercado Cero

> Handoff vivo para agentes. Última actualización: **4 de noviembre de 2026**.
> No reconstruyas el estado de memoria: si un dato no está aquí ni en
> `latest.json`/`latest-static.json`, no lo asumas.

## Corte actual — Oleada B en desarrollo local

- **Rama:** `design/oleada-b-caja-ventas`.
- **Base/tag:** `oleada-a-cierre` = `26c7741`.
- **Estado del árbol:** **sucio**; la implementación de Oleada B está completa en local pero **sin commit**. El commit de checkpoint está autorizado por el verificador; falta ejecutarlo y regenerar evidencia.
- **Build local:** `http://localhost:3100` con `APP_URL=http://localhost:3100`.
- **Nuevas pantallas:** `/caja` (venta manual, efectivo/cambio, digital, fiado, mixto, resultado) y `/ventas` (historial paginado).
- **Compatibilidad:** `/` sigue siendo Caja legacy con `?tab=`; `/fiados`, `/corte`, `/metas` y `/pendientes` siguen 307 a `/?tab=`; `/pay/**` intacto.
- **Contratos:** `lib/orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `db.ts`, `payment-rules.ts`, `payment-labels.ts`, `pey-events.ts`, `checkout.ts`, `api/**`, `pay/**`, `caja-app.tsx` y `app/page.tsx` **sin cambios**.
- **Evidencia local:** smoke B 44/44; smoke A 33/33; a11y B 8/8 (axe 0 normal/HC, targets ≥44, 200% sin overflow); HIG legacy 5/5; mobile-320 legacy 60/60; p0-venta 66/0; p0-fiado 51/0; p0-corte 69/0; p0-integración 51/0; p0-dinero 45/0 + 3 KNOWN; webhook 40/40; checkout 19/19.
- **Gates formales:** `verify:static`/`verify:evidence` **pendientes después del commit**. El full sigue bloqueado por `tunnel`/`preflight`; no se declara GO.
- **Handoff público:** **NO-GO**. `latest.json` es de `9206ea1`.
- **P1 heredado:** `POST /api/demo/pay` no tiene idempotencia por pedido ni comprueba `order.demo`; el cliente bloquea doble clic, pero dos pestañas podrían duplicar un demo. No se tocó el endpoint sin autorización.
- **Siguiente:** commit de checkpoint → `verify:static`/`verify:evidence` → Oleada C (Fiados, Corte y retiro progresivo de la Caja legacy).

## Evidencia de Oleada B

- Entrega: `quality-reports/oleada-b/ENTREGA_OLEADA_B.md`.
- Veredicto: `quality-reports/oleada-b/VEREDICTO_INDEPENDIENTE.md`.
- Auditorías: `quality-reports/oleada-b/AUDITORIA_REPO.md`, `CONTRATOS_VENTAS_PAGOS.md`, `DISENO_CAJA.md`, `SHELL_RUTAS.md`, `FIADO_CORTE.md`, `MODULOS_NEGOCIO.md`, `ONBOARDING_AYUDA.md`, `ACCESIBILIDAD.md`.
- Smoke: `quality-reports/oleada-b/oleada-b-smoke.json`.
- A11y: `quality-reports/oleada-b/a11y.json`.
- Capturas: `quality-reports/oleada-b/capturas/`.
- Run parcial 6/6: `harness/evidence/runs/2026-11-04T15-59-15-768Z-partial.json` (gates verdes, `ok:false` por partial y árbol sucio).

## Oleada A — cerrada

- **Commit:** `d30a31c` (fundación) + `26c7741` (docs/cierre A).
- **Tag:** `oleada-a-cierre` en `26c7741`.
- **Entregado:** Hearth/Alder, AppShell/Sidebar/TopBar/MobileNav/PageHeader, componentes compartidos, `/caja`/`/ventas` aún alias (A), `/inicio` migrado.
- **Evidencia:** `latest-static.json` 5/5 en `26c7741`; `verify:evidence -- --static` PASS; full Fase 1 21/23 por túnel/preflight.
- **Entrega:** `quality-reports/oleada-a/ENTREGA_OLEADA_A.md`.

## Fase 1 — histórico

- **Código Fase 1:** `a3ea6bf`; tags `fase-1-inicio-aprobado` en `3dd006f` y `fase-1-handoff` en `62c3fed`.
- **Producto:** Inicio **APROBADO CON LIMITACIONES**; estático **PASS**; full **21/23**; handoff público **NO-GO**.
- **Fallos full:** `tunnel` y `preflight` por `APP_URL` apuntando a un quick tunnel caducado. No se alteraron gates.
- **KNOWN p0-dinero:** payload real de pey no verificable sin portal; reconciliación de red no ejecutada; contrato de conteo posterior al cierre.
- **Veredicto independiente Fase 1:** `quality-reports/mercado-cero-final/CIERRE_FASE_1/VEREDICTO_INDEPENDIENTE.md`.

## Reglas de trabajo

- No tocar `lib/orders.ts`, `lib/cash.ts`, `lib/goals.ts`, `lib/tasks.ts`, `lib/db.ts`, `lib/payment-rules.ts`, `lib/payment-labels.ts`, `lib/pey-events.ts`, `lib/checkout.ts`, `proxy.ts`, `api/**` financiero ni `pay/**` sin dueño explícito y pruebas.
- No marcar `paid` sin webhook firmado de pey; demo es `demo_paid`; fiado es deuda; meta no es custodia.
- No usar `git add .` ni `git add -A`; commits acotados.
- No declarar GO de handoff sin `latest.json`/`latest-static.json` válidos y `verify:evidence` PASS.
- No presentar una pantalla legacy como migrada.
- No commitear sin autorización cuando la ola lo exija; en B el verificador autorizó commit de checkpoint.
