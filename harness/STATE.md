# STATE — Mercado Cero

> Handoff vivo para agentes. Última actualización: **4 de noviembre de 2026**.
> No reconstruyas el estado de memoria: si un dato no está aquí ni en
> `latest.json`/`latest-static.json`, no lo asumas.

## Corte actual — Oleada A en desarrollo local

- **Rama:** `design/oleada-a-fundacion`.
- **Línea base:** `62c3fed6874bc500db16b4a9260fb62cf9626453` (tag `fase-1-handoff`).
- **Commit de la ola:** `d30a31c` (`feat(ui): fundacion compartida de Oleada A`).
- **HEAD actual:** se confirma con `git rev-parse HEAD`; este documento puede ir un commit por delante del código por la actualización de cierre.
- **Estado del árbol:** limpio tras el commit de código; la evidencia estática se regenera al final sobre el HEAD vigente.
- **Build servido:** `http://localhost:3100`, `/api/health` buildSha `d30a31c...`.
- **Alcance de la ola:** Hearth + Alder, AppShell/Sidebar/TopBar/MobileNav/PageHeader, componentes compartidos y alias de rutas. **Caja sigue en su shell legacy**; su migración es Oleada B.
- **Rutas:** `/inicio` 200; `/ventas`, `/fiados`, `/corte`, `/metas`, `/pendientes` responden **307** a `/?tab=...` y conservan `ayuda=1`; `/caja` sigue **404** (reservada); `/` y `/?tab=` intactos; `/pay/**` sin shell nuevo.
- **Navegación:** sidebar de 6 destinos reales (Inicio, Ventas, Fiados, Corte, Metas, Pendientes), sin Productos/Proveedores/Reportes hasta que existan; móvil con 4 destinos + “Más”.
- **Tipografía:** Hearth (`Hearth-Variable.woff2`) para marca/editorial y Alder (`Alder-Variable.woff2`) para UI, importes y estados; OFL 1.1 y hashes en `web/src/assets/fonts/README.md`; `next/font/local`, sin descargas duplicadas.
- **Componentes:** `AppShell`, `Sidebar`, `TopBar`, `MobileNav`, `SkipLink`, `BrandLockup`, `PageHeader`, `MaskIcon`, `CurrencyAmount`, `ProgressIndicator`, `SectionHeader`, `EmptyState`.
- **Evidencia local:** smoke 34/34; HIG 5/5; variantes 10/10; axe 0 en Inicio normal/HC; p0-venta 66/0, p0-fiado 51/0, p0-corte 69/0, p0-integración 51/0, p0-dinero 45/0 + 3 KNOWN, webhook 40/40, checkout 19/19.
- **Gates estáticos:** `verify:static` **5/5 PASS** sobre el commit de la ola; `latest-static.json` con `ok:true`, `dirty:false` y buildSha coincidente. Se regenera después del commit documental final.
- **Handoff público:** **NO-GO**. `latest.json` sigue siendo de `9206ea1`; el full de HEAD es 21/23 por `tunnel`/`preflight` ambientales; no hay `verify:evidence` PASS.
- **Accesibilidad:** sin lector de pantalla real, iOS/Safari, HCM real, PWA instalada/offline ni teclado virtual. WCAG **no certificada**.
- **Siguiente:** `verify:full --skip=tunnel,preflight` sobre HEAD limpio → Oleada B (Caja y Nueva venta).

## Evidencia de Oleada A

- Entrega: `quality-reports/oleada-a/ENTREGA_OLEADA_A.md`.
- Auditorías: `quality-reports/oleada-a/AUDITORIA_{REPO,DISENO,SHELL,ACCESIBILIDAD}.md`.
- Veredicto independiente: `quality-reports/oleada-a/VEREDICTO_INDEPENDIENTE.md`.
- Capturas: `quality-reports/oleada-a/capturas/`.
- Smoke: `web/scripts/oleada-a-smoke.py`.
- Suites p0: `harness/evidence/p0-*-e2e.json`.
- Run parcial de integración: `harness/evidence/runs/2026-11-04T12-25-52-380Z-partial.json` (6/6 gates verdes; `ok:false` por partial y árbol sucio).

## Fase 1 — histórico

- **Código Fase 1:** `a3ea6bf`; tag `fase-1-inicio-aprobado` en `3dd006f`; tag `fase-1-handoff` en `62c3fed`.
- **Producto:** Inicio **APROBADO CON LIMITACIONES**; estático **PASS**; full **21/23**; handoff público **NO-GO**.
- **Fallos full:** `tunnel` y `preflight` por `APP_URL` apuntando a un quick tunnel caducado. No se alteraron gates.
- **KNOWN p0-dinero:** payload real de pey no verificable sin portal; reconciliación de red no ejecutada; contrato de conteo posterior al cierre (la UI debe reemplazar el conteo guardado por el vigente).
- **Veredicto independiente Fase 1:** `quality-reports/mercado-cero-final/CIERRE_FASE_1/VEREDICTO_INDEPENDIENTE.md`.

## Reglas de trabajo

- No tocar `lib/orders.ts`, `lib/cash.ts`, `lib/goals.ts`, `lib/tasks.ts`, `lib/db.ts`, `lib/payment-rules.ts`, `lib/payment-labels.ts`, `lib/pey-events.ts`, `lib/checkout.ts`, `proxy.ts`, `api/**` financiero ni `pay/**` sin dueño explícito y pruebas.
- No marcar `paid` sin webhook firmado de pey; demo es `demo_paid`; fiado es deuda; meta no es custodia.
- No usar `git add .` ni `git add -A`; commits acotados.
- No declarar GO de handoff sin `latest.json`/`latest-static.json` válidos y `verify:evidence` PASS.
- No presentar una pantalla legacy como migrada.
- No commitear Oleada A sin autorización explícita.
