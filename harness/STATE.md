# STATE — Mercado Cero

## Continuación local — Ventas y Caja, 5 nov 2026

- Rama actual: `codex/visual-session-b`; base `9252f38`.
- Ajustes de micrófono principal, frases cortas, ticket vacío móvil y estados
  accesibles. Ventas conserva historial y CTA hacia Caja con icono de micrófono.
- Informe: `quality-reports/exact-parity/ENTREGA.md`.
- Pruebas: UI 42/0 (1448/390/320, texto200 y permiso denegado), adaptador voz
  10/0, harness 58/0. Capturas en `harness/evidence/exact-parity/`.
- Transcripción real: 500 reproducido; falta OPENAI_API_KEY en este entorno.
- Paridad exacta: NO-GO; falta canon dedicado de historial Ventas y persisten
  diferencias de composición documentadas en Caja. Sin aceptación visual.
- Evidencia estática: consultar `latest-static.json` contra HEAD con
  `npm run verify:evidence -- --static`. No se ejecutó full ni despliegue.

> Handoff vivo para agentes. Última actualización: **4 de noviembre de 2026**,
> al integrar el Inicio compacto de Codex sobre B.1.
> No reconstruyas el estado de memoria: si un dato no está aquí ni en
> `latest.json`/`latest-static.json`, no lo asumas.

## Corte actual — Integración Codex Inicio vNext (4 nov 2026)

- **Rama:** `integration/codex-inicio-vnext` (no mergeada).
- **Base B.1:** `424fdd2d197aab550f52244413df7eb8b45414de`, tag
  `oleada-b1-cierre`.
- **Producto:** `bd15f22` (integración) + `0de183f` (Pendientes a 200 %).
- **Pruebas:** `a439b9a` (contrato/gate) + `5ea2d85` (identidad de evidencia).
- **Build de código:** `5ea2d853841e8f324c63486eafd4c2f033d407a4`;
  `/api/health` del servidor aislado lo confirma.
- **Cambio:** solo `web/src/app/inicio/page.tsx` + `inicio.css` y los scripts
  de prueba. No se tocaron `orders.ts`, `cash.ts`, `db.ts`, pagos, webhooks,
  pey, checkout, idempotencia, fiados ni reconciliación.
- **Regresión:** gate Inicio 111/0; B.1 65/65; smoke A 33/33; HIG 5/5;
  a11y B axe 0 normal/HC; mobile 320/360 60/60; demo-pay 59/59 en árbol
  limpio; p0-venta/fiado/corte/integración/dinero 7/7 gates verdes
  (`--only`, partial); fix-datos 32/0; seguridad 58/58.
- **Verificador independiente:** **GO con residuales, sin P0/P1**. El P3 de
  “Pendientes” partido a 200 % se corrigió en `0de183f`.
- **Evidencia:** `quality-reports/codex-inicio-vnext/` (informe, JSON, capturas
  A/B/C y logs).
- **Pendiente formal:** `verify:static` y `verify:evidence -- --static` sobre el
  HEAD documental limpio; `latest.json` full sigue sin infraestructura de
  `tunnel`/`preflight`.
- **Handoff público:** **NO-GO** heredado.
- **Oleada C:** **NO INICIADA**; plan en el informe de integración y en
  `quality-reports/oleada-b-estabilizacion/12_PENDIENTES_OLEADA_C.md`.
- **Nota de entorno:** `node_modules` perdió `@swc/helpers`; se reparó con
  `npm ci` en directorio temporal y merge, sin cambiar código ni lockfile.

## Corte previo — Operación B.1 (base oficial)

- **Rama:** `fix/oleada-b1-estabilizacion` (no mergeada).
- **Base:** `844f759`; handoff versionado en `e025895`.
- **Producto:** `bdfbe8b` (fix) + `8101849` (pruebas).
- **Build de cierre:** `424fdd2`; `/api/health` del servidor aislado lo
  confirmó antes de la integración.
- **Evidencia y veredicto:** `quality-reports/oleada-b-estabilizacion/`.
- **Estado del árbol:** debe quedar limpio después del commit documental;
  la evidencia estática y `test:demo-pay` se repiten sobre ese estado.
- **P0 de B:** **0 abiertos** (P0-01 y P0-02 cerrados).
- **P1 de B:** **0 abiertos en el alcance B.1**; P1-10 se preservó cerrado.
  El residual de la venta legacy (R-01) queda como P2 documentado en
  `12_PENDIENTES_OLEADA_C.md`.
- **Nuevas pantallas:** `/caja` y `/ventas` con verdad financiera, cola de
  pendientes, draft v1/v2, estado desconocido reconciliable y CTA persistente.
- **Compatibilidad:** `/` sigue siendo Caja legacy con `?tab=`; `/fiados`,
  `/corte`, `/metas` y `/pendientes` siguen 307; `/pay/**` intacto. La nav
  marca esos destinos como “Clásica”.
- **Contratos:** `orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, webhook,
  checkout y `/pay/**` no se reescribieron. `db.ts` y `analytics.ts` solo
  cambiaron el filtro de lectura de abonos demo. `POST /api/orders` se
  extendió con `GET ?requestId=` para reconciliación read-only.
- **Regresión:** B.1 65/65; p0-venta 66/0; p0-fiado 51/0; p0-corte 69/0;
  p0-integración 51/0; p0-dinero 45/0+3 KNOWN; webhook 40/40; checkout 19/19;
  smoke A 33/33; smoke B 45/45; HIG 5/5; a11y axe 0; mobile 60/60.
- **demo-pay:** **59/59** en árbol limpio, incluido el check 0b.
- **Gates formales:** `verify:static` **5/5 PASS** y
  `verify:evidence -- --static` **PASS** en árbol limpio.
  `verify:full --only=...` fue 7/7 gates verdes pero **partial** y no cuenta
  como full.
- **Handoff público:** **NO-GO**. Faltan `tunnel`/`preflight`, `latest.json`
  full, pey real, QR/lector real e iOS/Safari.
- **Oleada C:** **NO INICIADA**. Pendientes en
  `quality-reports/oleada-b-estabilizacion/12_PENDIENTES_OLEADA_C.md`.

## Evidencia de Operación B.1

- Resumen: `quality-reports/oleada-b-estabilizacion/00_RESUMEN_EJECUTIVO.md`.
- Matriz: `01_MATRIZ_HALLAZGOS.md`; causas: `02_CAUSAS_RAIZ.md`.
- Lotes: `03_LOTE_1_VERDAD_FINANCIERA.md`, `04_LOTE_2_INTEGRIDAD.md`,
  `05_LOTE_3_OPERACION_A11Y.md`.
- Pruebas: `06_PRUEBAS_REGRESION.md`; evidencia: `07_EVIDENCIA_VISUAL_FUNCIONAL.md`.
- Verificación independiente: `09_VERIFICACION_INDEPENDIENTE.md`.
- GO/NO-GO: `10_GO_NO_GO.md`; Git: `11_ESTADO_GIT.md`.
- Crudo: `quality-reports/oleada-b-estabilizacion/evidencia/`.

## Evidencia de la remediación demo-pay

- Informe: `quality-reports/oleada-b-remediation/EVIDENCIA_FINAL.md`.
- Diagnóstico: `quality-reports/oleada-b-remediation/ANALISIS_VENTAS_PAGOS.md`.
- Revisión de contratos:
  `quality-reports/oleada-b-remediation/REVISION_CONTRATOS.md`.
- Veredicto independiente:
  `quality-reports/oleada-b-remediation/VEREDICTO_INDEPENDIENTE.md`.
- Contrato: `npm run test:demo-pay` (59 PASS / 0 FAIL en `178b619`).
- Evidencia cruda: `demo-pay-contract.txt`, `runtime-after.txt`,
  `smoke-b-after.txt`, `two-tabs-after.txt` en la misma carpeta.
- Auditoría B: `quality-reports/oleada-b-review/00…12`.

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
