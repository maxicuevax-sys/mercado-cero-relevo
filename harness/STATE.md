# STATE — Mercado Cero

> Handoff vivo para agentes. Última actualización: **4 de noviembre de 2026**.
> No reconstruyas el estado de memoria: si un dato no está aquí ni en
> `latest.json`/`latest-static.json`, no lo asumas.

## Corte actual — Oleada B + remediación demo-pay en local

- **Rama:** `design/oleada-b-caja-ventas`.
- **Base/tag:** `oleada-a-cierre` = `26c7741`.
- **Commits de la ola:** `7c48902` (Caja/Ventas) y `4130e71` (cierre local B).
- **Remediación del P1 demo-pay:** `de7e339` + `f863df2` (producto).
  Evidencia y veredicto en el HEAD de este documento (ver `git log -1`);
  informe en `quality-reports/oleada-b-remediation/EVIDENCIA_FINAL.md`.
- **Estado del árbol:** limpio; la evidencia estática se regenera sobre el
  HEAD vigente después del último commit de docs.
- **Build local:** `http://localhost:3100`; el build debe declarar el SHA de
  HEAD. El contrato demo-pay usa puertos `3331–3333` y SQLite temporal.
- **Nuevas pantallas:** `/caja` (venta manual, efectivo/cambio, digital,
  fiado, mixto, resultado) y `/ventas` (historial paginado).
- **Compatibilidad:** `/` sigue siendo Caja legacy con `?tab=`; `/fiados`,
  `/corte`, `/metas` y `/pendientes` siguen 307 a `/?tab=`; `/pay/**` intacto.
- **Contratos:** `lib/orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `db.ts`,
  `payment-rules.ts`, `payment-labels.ts`, `pey-events.ts`, `checkout.ts`,
  `api/**` real, `pay/**`, `caja-app.tsx` y `app/page.tsx` **sin cambios** en
  la remediación demo-pay.
- **Evidencia local:** smoke B 44/44; p0-venta 66/0; p0-fiado 51/0;
  p0-corte 69/0; p0-integración 51/0; p0-dinero 45/0 + 3 KNOWN; webhook
  40/40; checkout 19/19; contrato demo-pay 59/59; dos pestañas 1 pago.
- **Gates formales:** `verify:static` **5/5 PASS** y
  `verify:evidence -- --static` **PASS** en el HEAD de evidencia final
  (producto `de7e339` + `f863df2`), árbol limpio. Full
  `--skip=tunnel,preflight` es **partial** y no se declara GO.
- **P1 demo-pay:** **cerrado en producto/demo local**. `POST /api/demo/pay`
  valida `orders.demo=1`, usa `BEGIN IMMEDIATE`, llaves durables en
  `payment_events`/`payments` y no duplica pagos entre procesos ni tras
  reinicio.
- **Handoff público:** **NO-GO**. `latest.json` es de `9206ea1`; faltan
  `tunnel`/`preflight`, QR/lector/iOS y la cadena pública de pey.
- **P0/P1 abiertos de Oleada B:** 2 P0 + 13 P1 en
  `quality-reports/oleada-b-review/09_HALLAZGOS_PRIORIZADOS.md`. No se
  autorizó su remediación en este encargo.
- **Siguiente:** decidir la remediación de los P0/P1 de B. **No iniciar
  Oleada C** hasta registrar formalmente esa decisión.

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
