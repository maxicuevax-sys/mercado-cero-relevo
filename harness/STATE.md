# STATE — Mercado Cero

> Handoff vivo para agentes. Última actualización: **4 de noviembre de 2026**.
> No reconstruyas el estado de memoria: si un dato no está aquí ni en
> `latest.json`/`latest-static.json`, no lo asumas.

## Corte actual — cierre Fase 1

- **Rama:** `design/mercado-cero-v2`.
- **Código Fase 1:** `a3ea6bf` (incluye `5d17f02`, `3dd006f` y el fix de a11y de Caja).
- **Punto de recuperación:** tag `fase-1-inicio-aprobado` en `3dd006f`; el código posterior `a3ea6bf` añade el cierre de targets/nombre accesible de Caja.
- **HEAD de handoff:** se confirma con `git rev-parse HEAD`; el commit de este documento actualiza STATE.
- **Build:** se sella con `npm run build`; `/api/health` debe devolver el SHA de HEAD.
- **Estado del árbol:** limpio al generar `latest-static`; las capturas PNG de `quality-reports/` están ignoradas por tamaño.
- **`latest-static.json`:** `ok:true`, 5/5 gates, HEAD y build coincidentes, `dirty:false`; `npm run verify:evidence -- --static` PASS.
- **`latest.json` (full):** **NO actualizado**. La corrida full sobre `a3ea6bf` fue **21/23**: pasan guard, lint, types, deps, truth, webhook, mobile, checkout, HIG, motion, contrast, mobile-320, rehearsal, security, data, perf, p0-venta, p0-fiado, p0-corte, p0-integracion y p0-dinero. Fallan **tunnel** y **preflight** porque `APP_URL` apunta al quick tunnel caído `timing-brought-lamp-aberdeen.trycloudflare.com`. No se marcó PASS ni se manipuló el gate.
- **p0:** venta 66/0, fiado 51/0, corte 69/0, integración 51/0, dinero 45/0 + 3 KNOWN; webhook 40/40.
- **KNOWN p0-dinero:** payload real de pey no verificable sin portal; reconciliación de red no ejecutada; contrato de conteo posterior al cierre (la UI debe reemplazar el conteo guardado por el vigente).
- **Accesibilidad:** axe 0 en Inicio normal/alto contraste/forced-colors; HIG 5/5; NVDA/TalkBack/VoiceOver **NOT RUN**; WCAG no certificada.
- **Handoff/merge:** **NO-GO** hasta resolver el túnel/preflight y actualizar `latest.json` full con `ok:true`; no se hace merge ni despliegue.
- **Migración:** matriz en `quality-reports/MIGRACION_INTEGRAL_MERCADO_CERO.md`; **Oleada A no iniciada**. Hearth/Alder: fuentes reales OFL, pendientes de incorporar en Oleada A. Rutas independientes y módulos ausentes requieren las decisiones documentadas.

## Evidencia de Fase 1

- Veredicto independiente: `quality-reports/mercado-cero-final/CIERRE_FASE_1/VEREDICTO_INDEPENDIENTE.md`.
- Auditorías: `quality-reports/mercado-cero-final/CIERRE_FASE_1/AUDITORIA_*.md`.
- Capturas y JSON: `quality-reports/mercado-cero-final/14_EVIDENCIAS/`.
- p0: `quality-reports/mercado-cero-final/14_EVIDENCIAS/tests/`.
- Webhook: `quality-reports/mercado-cero-final/14_EVIDENCIAS/webhook-40-40.txt`.
- Comparación: `quality-reports/mercado-cero-final/CIERRE_FASE_1/comparacion-1448.png`.

## Reglas de trabajo

- No tocar `lib/orders.ts`, `lib/cash.ts`, `lib/db.ts`, webhooks, `lib/pey-events.ts`, `lib/payment-rules.ts`, `lib/payment-labels.ts`, `lib/checkout.ts` ni `proxy.ts` sin dueño explícito y pruebas.
- No marcar `paid` sin webhook firmado de pey; demo es `demo_paid`; fiado es deuda; meta no es custodia.
- No usar `git add .` ni `git add -A`; commits acotados.
- No declarar GO de handoff sin `latest.json`/`latest-static.json` válidos y `verify:evidence` PASS.
- No presentar una pantalla legacy como migrada.
