# HANDOFF — Operación B.1 (Oleada B: Caja y Ventas)

> **Sustituido el 4 de noviembre de 2026.** Este documento fue el handoff de
> recuperación. El estado operativo posterior a la ejecución de B.1 vive en
> `harness/HANDOFF_OLEADA_B1_CIERRE.md` y en
> `quality-reports/oleada-b-estabilizacion/`. Se conserva como registro
> histórico del punto de partida (`844f759` / `e025895`).

> **Creado:** 4 de noviembre de 2026, tras verificar el repositorio directamente.
> **Propósito:** que una sesión nueva pueda iniciar **Operación B.1** sin releer
> el historial de conversaciones y sin repetir Fase 1, Oleada A ni Oleada B.
>
> **Estado:** B.1 **no ejecutada**. Este documento no aplica fixes, no inicia
> Oleada C y no declara GO.
>
> **Regla:** este handoff no reemplaza el código, las pruebas, la auditoría
> original ni `harness/STATE.md`. Si hay conflicto, manda el código y la
> evidencia reproducible; después, `harness/STATE.md`; después, este documento.

---

## 0. Lo primero que debe saber la sesión nueva

- **HEAD real:** `844f759f30e53cc2ff4f77d67a3adb53123efb5b`, rama
  `design/oleada-b-caja-ventas`, build `844f759...`.
- El HEAD **auditado** por la revisión adversarial fue `4130e71`; ya no es el
  HEAD. La UI no cambió después; solo se remedió `/api/demo/pay`.
- **Oleada B sigue NO-GO local:** 2 P0 + 12 P1 operativos abiertos.
  **P1-10 está cerrado** en demo local (`de7e339` + `f863df2`, contrato 59/59).
- **Oleada C no se inicia.** B.1 no se ejecuta sin autorización explícita.
- Evidencia estática vigente: `latest-static.json` 5/5 y `verify:evidence
  -- --static` PASS en `844f759`.
- El `full` de 23 gates **no** está ejecutado en este HEAD; `latest.json` es de
  `9206ea1`. El túnel/preflight sigue pendiente y el handoff público es NO-GO.
- Primer trabajo autorizable: **lote 1, verdad financiera** (P0-01, P0-02,
  P1-07, P1-08, P1-09), con pruebas que fallen antes del fix.

---

## A. Estado del proyecto

### A.1 Qué es Mercado Cero

Mercado Cero es una caja/PWA para una comerciante de barrio en México. Convierte
una venta en un cobro, registra efectivo, pagos mixtos, fiado y pendientes, y
solo considera **dinero real confirmado** cuando llega un **webhook firmado de
pey**. La interfaz debe decir la verdad sobre qué dinero entró, qué es deuda y
qué es una simulación.

**Objetivo funcional inmediato:** operar `/caja` y `/ventas` con verdad
financiera, integridad de operaciones, responsive y accesibilidad suficientes
para cerrar Oleada B en local. El handoff público sigue siendo otro nivel.

### A.2 Stack e infraestructura reales

| Capa | Realidad verificada |
|---|---|
| Frontend | Next.js **16.4.3** (App Router), React **19.3.0**, TypeScript, Tailwind 4 |
| Runtime | Node **v25.7.0** en Windows; `next start` local |
| Datos | SQLite vía `node:sqlite`; WAL y `busy_timeout = 5000`; sin Postgres |
| Validación | Zod 4 |
| UI | Lucide React, QR con `qrcode`; fuentes locales Hearth/Alder |
| IA/voz | OpenAI opcional; la IA no calcula dinero |
| Pruebas | Node scripts, Python **3.14.3**, Playwright/Chromium |
| Servidor actual | `http://localhost:3100`, `buildSha=844f759...` |
| Build | `web/.next/BUILD_SHA` = `844f759f30e53cc2ff4f77d67a3adb53123efb5b` |
| Base local | `web/data/mercado-cero.db` (WAL); backups en `web/data/backups/` |
| Demo | `.env.local` tiene `DEMO_MODE=true`; el servidor de referencia se levantó con `APP_URL=http://localhost:3100` |
| Riesgo de config | `.env.local` contiene un `APP_URL` de túnel viejo (`timing-brought-lamp-aberdeen.trycloudflare.com`); no usarlo para local. No imprimir secretos. |

### A.3 Estructura principal

```text
mercado-cero/
  AGENTS.md, HARNESS.md, GOAL.md, GOAL-HIG.md, HIG-DESIGN.md
  harness/                 # STATE, EVALS, evidencia, este handoff
  quality-reports/
    oleada-a/              # entrega/veredicto A
    oleada-b/              # entrega/veredicto previo B
    oleada-b-review/       # auditoría adversarial B (00..12) + EVIDENCIAS
    oleada-b-remediation/  # P1 demo-pay: análisis, contrato, veredicto
    MIGRACION_INTEGRAL_MERCADO_CERO.md
  web/
    src/app/               # /, /inicio, /caja, /ventas, /pay/[id], APIs
    src/components/        # shell/, caja/, ui/
    src/lib/               # db, orders, cash, credits, payment-*, demo-payments
    scripts/               # gates, p0, smoke, a11y, capturas
    data/                  # SQLite local (ignorado)
  demo/                    # QR, video, runbook, estado de demo (histórico)
```

### A.4 Estado por fase

| Fase | Estado | Referencia |
|---|---|---|
| Fase 1 | Cerrada con limitaciones; público NO-GO | `quality-reports/mercado-cero-final/CIERRE_FASE_1/` |
| Oleada A | **Cerrada localmente** | `d30a31c` + `26c7741`; tag `oleada-a-cierre`; `quality-reports/oleada-a/ENTREGA_OLEADA_A.md` |
| Oleada B | **Implementada y commiteada; NO-GO local por auditoría adversarial** | `d13d3df`, `af381ad`, `7c48902`, `4130e71`; `quality-reports/oleada-b-review/` |
| Remedio P1 demo-pay | **Cerrado en producto/demo local** | `de7e339` + `f863df2`; evidencia `178b619..844f759`; `quality-reports/oleada-b-remediation/EVIDENCIA_FINAL.md` |
| Operación B.1 | **No iniciada** | Este documento |
| Oleada C | **No iniciada / prohibida hasta nuevo acuerdo** | `harness/STATE.md` |

---

## B. Decisiones ya tomadas

### B.1 Identidad y shell

- **Hearth + Alder** son la identidad tipográfica: Hearth para marca/editorial;
  Alder para navegación, formularios, importes y operación. Fuentes locales OFL
  en `web/src/assets/fonts/`, con hashes documentados.
- **AppShell compartido**: `AppShell`, `Sidebar`, `TopBar`, `MobileNav`,
  `SkipLink`, `PageHeader`, componentes UI. Aplicado a `/inicio`, `/caja` y
  `/ventas`.
- La Caja legacy `/` conserva su shell monolítico; **no se declara migrada**.
- No se rediseña la identidad ni se introducen pantallas nuevas en B.1.

### B.2 Rutas y compatibilidad

| Ruta | Comportamiento actual | Decisión |
|---|---|---|
| `/` | Caja legacy + `?tab=caja/fiado/corte/meta/pendientes` | Se preserva durante B.1 |
| `/inicio` | Dashboard con AppShell | Se preserva |
| `/caja` | Pantalla real nueva de venta | Se preserva y se corrige |
| `/ventas` | Historial real paginado | Se preserva y se corrige |
| `/fiados` | 307 → `/?tab=fiado` | Alias legacy; no presentar como migrado |
| `/corte` | 307 → `/?tab=corte` | Alias legacy; no presentar como migrado |
| `/metas` | 307 → `/?tab=meta` | Alias legacy; no presentar como migrado |
| `/pendientes` | 307 → `/?tab=pendientes` | Alias legacy; no presentar como migrado |
| `/pay/**` | Checkout público, fuera del AppShell | **Intacto** |
| `/api/**` financiero | APIs reales | **Intactas**, salvo `demo/pay` ya remediado |

### B.3 Motor financiero preservado

No se tocaron en B (y no deben tocarse en B.1 sin dueño explícito y pruebas):

`lib/orders.ts`, `lib/cash.ts`, `lib/goals.ts`, `lib/tasks.ts`, `lib/db.ts`,
`lib/payment-rules.ts`, `lib/payment-labels.ts`, `lib/pey-events.ts`,
`lib/checkout.ts`, `lib/pey.ts`, `lib/reconcile.ts`, `lib/analytics.ts`,
`lib/qr.ts`, `app/api/webhooks/pey/route.ts`, `app/api/verify/route.ts`,
`app/pay/**`, `app/page.tsx`, `components/caja-app.tsx`.

La única excepción de producto desde el HEAD auditado `4130e71` es el P1-10:

- `web/src/app/api/demo/pay/route.ts` (ruta delgada),
- `web/src/lib/demo-payments.ts` (nuevo núcleo demo-only),
- `web/package.json` (script `test:demo-pay`).

### B.4 Semántica que no se puede romper

| Concepto | Significado | Fuente |
|---|---|---|
| `paid` | Dinero real confirmado | Solo webhook firmado de pey |
| `demo_paid` | Simulación demo | `/api/demo/pay`; nunca `paid` |
| Fiado / crédito | Deuda del cliente | `credits` + `credit_payments`; no es efectivo |
| `payment_pending` | Cobro digital pendiente | No es ingreso; no es “cobrado” |
| Efectivo | Dinero declarado en caja | `payments`/`cash_closes`; no lo confirma pey |
| Meta / aportación | Progreso virtual | `goals`; **no es custodia** |
| Pendiente / tarea | Trabajo operativo | `tasks`; no es dinero |

### B.5 GO / NO-GO vigente

| Nivel | Decisión | Condición |
|---|---|---|
| Producto/demo local del P1 demo-pay | **GO** | Contrato 59/59 y evidencia estática en `844f759` |
| Cierre local de Oleada B | **NO-GO** | 2 P0 + 12 P1 operativos abiertos (P1-10 cerrado) |
| Demo controlada | **GO condicionado, guion restringido** | Solo efectivo exacto/cambio + digital demo con operador; **no** fiado puro ni mixto efectivo+digital |
| Handoff público | **NO-GO** | Falta full `latest.json` del HEAD, túnel/preflight, pey real, QR/lector/iOS |
| Oleada C | **NO-GO / no iniciar** | Hasta cerrar B.1 o registrar waivers formales |

---

## C. Estado de Git y evidencias

### C.1 Identidad verificada

| Dato | Valor |
|---|---|
| Raíz | `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero` |
| Rama | `design/oleada-b-caja-ventas` |
| HEAD actual | `844f759f30e53cc2ff4f77d67a3adb53123efb5b` |
| HEAD auditado por la revisión B | `4130e71d668e5e4693a8f5b634d2d2f953d21b02` |
| Árbol antes de este handoff | **limpio** (`git status --short` vacío) |
| Árbol después de este handoff | solo `?? harness/HANDOFF_OLEADA_B1.md` (sin commit) |
| Build local | `844f759...` |
| Health | `http://localhost:3100/api/health` → `844f759...` |

**4130e71 ya no es el HEAD.** Sigue siendo la referencia de la **auditoría
visual/funcional** de B porque ningún archivo de UI cambió después. Para B.1,
la base correcta es **844f759**, que incluye la remediación demo-pay.

### C.2 Commits relevantes

```text
844f759 docs: confirmacion final del verificador independiente
711aab2 docs: cierre de empaquetado de la evidencia demo-pay
82d4cbd docs: evidencia final de la remediacion demo-pay
178b619 docs: auditoria adversarial de Oleada B y remediacion demo-pay
f863df2 fix(demo): mensaje seguro para requestId invalido
de7e339 fix(demo): pago demo idempotente, atomico y solo para pedidos demo
4130e71 docs: cierre formal local de Oleada B
7c48902 perf(caja): difiere ClosingChecklist y aligera la Caja nueva
af381ad docs: cierre local de Oleada B
d13d3df feat(caja): pantallas reales de Caja y Ventas de Oleada B
26c7741 docs: cierre local de Oleada A
d30a31c feat(ui): fundacion compartida de Oleada A
```

### C.3 Tags y puntos de recuperación

| Tag | Commit | Uso |
|---|---|---|
| `oleada-a-cierre` | `26c7741` | Último cierre de ola; base de B |
| `fase-1-handoff` | `b614bc8` | Histórico Fase 1 |
| `fase-1-inicio-aprobado` | `ff295ee` | Histórico Fase 1 |
| `pre-remediation` | `7bb0dc5` | **No** es `4130e71`; verificar antes de usarlo como rollback |
| `hig-baseline` / `pre-hig` / `pre-hig-merge` | varios | Histórico HIG |

No hay tag de cierre de B ni de la remediación. Los commits `de7e339` y
`f863df2` son el punto de retorno de producto; `178b619` es el commit que
versiona la auditoría; `844f759` es el HEAD documental.

### C.4 Diff de producto desde el HEAD auditado

`git diff --name-status 4130e71..HEAD -- web/src web/next.config.ts web/package.json`:

```text
M  web/package.json
M  web/src/app/api/demo/pay/route.ts
A  web/src/lib/demo-payments.ts
```

No hay cambios de UI, rutas, checkout, webhook ni motor financiero. Los otros
~307 archivos del diff son auditoría, evidencia y documentación.

### C.5 Evidencias: qué está versionado y qué no

| Evidencia | Estado |
|---|---|
| `quality-reports/oleada-b-review/` | **Versionada** en `178b619`: 296 archivos (MD, JSON, TXT, PY, MJS) |
| `quality-reports/oleada-b-review/EVIDENCIAS/` | 656 archivos, **111.3 MB** en total |
| Capturas PNG de la auditoría | **No versionadas** por `.gitignore` (`quality-reports/**/*.png`); 368 PNG / 108.8 MB solo en este workspace |
| `quality-reports/oleada-b-remediation/` | Versionada; incluye `EVIDENCIA_FINAL.md`, contrato, veredicto |
| `harness/evidence/latest-static.json` | Local, **ignorado**; válido en `844f759`, 5/5 |
| `harness/evidence/latest.json` (full) | Local, **ignorado**; viejo, de `9206ea1` (`p0/final-closure`), **no vale para B** |
| `harness/evidence/runs/` | Local, ignorado; corridas parciales |
| Scripts `final_verify.py`, `final_extra.py`, `final_history_verify.py` | En `%TEMP%\opencode`; existen ahora, pero son efímeros. Los JSON/PNG versionados son la evidencia durable |
| `demo/STATUS.md` | Histórico del 3 de noviembre, otra rama/túnel; **no es el estado actual** |

**Corrección importante al reporte anterior:** la carpeta de auditoría **ya no
está untracked**. Se commiteó en `178b619`. Lo que sigue fuera de Git son las
PNG (ignoradas) y los artefactos locales de `harness/evidence/`.

### C.6 Build, gates y pruebas verificadas

| Evidencia | Resultado | SHA/estado |
|---|---|---|
| `verify:static` | **5/5 PASS** (`guard`, `lint`, `types`, `deps`, `build`) | `844f759`, árbol limpio |
| `verify:evidence -- --static` | **PASS** | `gitAtStart.sha=844f759`, `buildSha` idéntico |
| Contrato demo-pay | **59/59** | `844f759`; ver `EVIDENCIA_FINAL.md` |
| Runtime 7/7 | webhook 40/40, checkout 19/19, p0-venta 66/0, p0-fiado 51/0, p0-corte 69/0, p0-integración 51/0, p0-dinero 45/0+3 KNOWN | `178b619` (producto final); `--only`, por tanto `partial` |
| Smoke B aislado | **44/44** | `178b619`, servidor `:3340` con DB temporal |
| Dos pestañas | 1 pago, `paid_cents=10000` | `178b619` |
| Full 23/23 | **NO ejecutado en HEAD** | `latest.json` es de `9206ea1` |
| Full en `7c48902` | 21/23; faltan `tunnel`/`preflight` | Histórico; no es `ok:true` |
| Full durante la auditoría | 17/23 por contaminación/concurrencia de la base demo | No usar como regresión de producto |
| A11y B | axe 0 normal/HC, targets ≥44, 200% “sin overflow” en el smoke | **No cubre** P1-04/P1-05; el 44/44 no es aprobación |

**El smoke 44/44 no prueba los P0/P1.** Valida DB, overflow y algunos estados,
pero no copy falso, panel post-confirmación, fold, dos Cajas, foco ni abonos
demo en el agregado.

### C.7 Limitación del túnel público

- No hay túnel vivo confiable para `tunnel`/`preflight`; `verify:full` no puede
  quedar `ok:true`.
- `--skip=tunnel,preflight` es **partial** y no cuenta como handoff.
- `latest.json` full pertenece a `9206ea1`, otra rama (`p0/final-closure`).
- `APP_URL` en `.env.local` apunta a un quick tunnel viejo; no usarlo.
- El público sigue **NO-GO** hasta pey real, webhook real, QR/lector, iOS/Safari
  y URL pública estable.

### C.8 Discrepancias entre informes (declaradas)

| Fuente | Dice | Realidad verificada |
|---|---|---|
| `00_RESUMEN_EJECUTIVO.md`, `01_TRAZABILIDAD_GIT.md`, `12_GO_NO_GO.md` | HEAD auditado `4130e71` | El HEAD actual es `844f759`; el producto solo cambió en demo-pay. La auditoría de UI sigue siendo válida porque no se tocaron pantallas. |
| `09_HALLAZGOS_PRIORIZADOS.md` | “Estado de todos: ABIERTO” | P1-10 está **cerrado en demo local** por `de7e339` + `f863df2`; los otros 2 P0 + 12 P1 siguen abiertos. |
| `EVIDENCIA_FINAL.md` §8 | “Siguen abiertos los 2 P0 y 13 P1” | Hay 13 P1 documentados, pero **12 operativos**: P1-10 cerrado. El texto es heredado y debe leerse con esta corrección. |
| `VEREDICTO_INDEPENDIENTE.md` nota final | “Siguen 2 P0 + 13 P1 de Oleada B” | Se refiere al catálogo original. El propio veredicto cierra P1-10; el conteo operativo es **2 P0 + 12 P1**. |
| `harness/STATE.md` | “P0/P1 abiertos: 2 P0 + 13 P1” | Usa el catálogo original. El conteo operativo reconciliado es **2 P0 + 12 P1**; esta sección D.0 es la referencia para B.1. |
| `quality-reports/oleada-b/VEREDICTO_INDEPENDIENTE.md`, `ENTREGA_OLEADA_B.md`, `MIGRACION...` | B es “base para Oleada C”, sin P0 de producto | **Superado** por la revisión adversarial: B es NO-GO local por 2 P0 + P1; no iniciar C. |
| `MIGRACION_INTEGRAL_MERCADO_CERO.md` | B “local, sin commit” | B está commiteada (`d13d3df..4130e71`). La matriz está desactualizada. |
| `00_RESUMEN_EJECUTIVO.md` / `12_GO_NO_GO.md` | Carpeta de auditoría untracked | Los 296 archivos de texto/JSON/scripts están **tracked** desde `178b619`; solo las PNG (368) siguen ignoradas y locales. |
| `12_GO_NO_GO.md` | `verify:evidence -- --static` falla por el untracked de la revisión | Histórico: el `latest-static` vigente es `ok:true` en `844f759`; el árbol está limpio. |
| `demo/STATUS.md` | Estado del 3 de noviembre, rama `p0/final-closure`, túnel `languages-native-greene-bit...` | **No es el estado actual**. Es histórico de Fase 1; no usarlo para B.1. |
| `.env.local` | `APP_URL` apunta a `timing-brought-lamp-aberdeen.trycloudflare.com` | Túnel viejo. El servidor local actual se levantó con `APP_URL=http://localhost:3100`. |
| `harness/evidence/latest.json` | Full de `9206ea1` en rama `p0/final-closure` | **No es evidencia de B.** El `latest-static` de `844f759` sí es válido para static. |

---

## D. Hallazgos pendientes de Oleada B

> Fuente primaria: `quality-reports/oleada-b-review/09_HALLAZGOS_PRIORIZADOS.md`
> y la tabla detallada de `11_VEREDICTO_INDEPENDIENTE.md` §4. Todos los estados
> de abajo son al HEAD `844f759`, no al `4130e71` original.

### D.0 Reconciliación de la matriz (original → corregido → pendiente)

| Categoría | P0 | P1 | Detalle |
|---|---:|---:|---|
| **Originales de la auditoría** | **2** | **13** | `P0-01..02` + `P1-01..13` en `09_HALLAZGOS_PRIORIZADOS.md` |
| **Corregidos** | 0 | **1** | `P1-10` (`/api/demo/pay`) cerrado en demo local; ver `EVIDENCIA_FINAL.md` y `demo-pay-contract.txt` |
| **Pendientes operativos** | **2** | **12** | Todos los P0 + los P1 restantes; ninguno se declara aprobado |
| **Nuevos P0/P1 desde la auditoría** | **0** | **0** | La remediación demo-pay no abrió P0/P1 nuevos; solo dejó P2/P3 residuales documentados |

**Regla de lectura:** si un informe histórico dice “2 P0 + 13 P1”, se refiere
al catálogo original. El conteo **operativo vigente** es **2 P0 + 12 P1
abiertos**, con `P1-10` corregido y verificable. No se debe volver a implementar
`/api/demo/pay` ni contar `P1-10` como pendiente.

### D.0.1 Remediación P1-10 — referencias verificadas

| Documento | Conclusión real |
|---|---|
| `quality-reports/oleada-b-remediation/EVIDENCIA_FINAL.md` | P1 confirmado; corrección **demo-only**; `demo_paid ≠ paid`; webhook/pey intactos; contrato **59/59**; producto/demo local **GO**; Oleada B completa **NO-GO**; público **NO-GO** |
| `quality-reports/oleada-b-remediation/VEREDICTO_INDEPENDIENTE.md` | P1 **CERRADO** en producto/demo local; cierre formal local firmado en `711aab2`; público **NO-GO**; residual P2 de CI/edge cases |
| `quality-reports/oleada-b-remediation/demo-pay-contract.txt` | **59 PASS / 0 FAIL**; incluye no-demo, 6 carreras, llave automática, llaves distintas, reinicio, lock externo y fallo atómico |
| `quality-reports/oleada-b-remediation/ANALISIS_VENTAS_PAGOS.md` | Diagnóstico y diseño de llaves `demo:pay:v1:req:*` / `demo:pay:v1:auto:*` |
| `quality-reports/oleada-b-remediation/REVISION_CONTRATOS.md` | Revisión de contratos; producto aprobado, sin P0/P1 de dinero |

**Corrección aplicada:** `de7e339` (núcleo `web/src/lib/demo-payments.ts` +
ruta delgada) y `f863df2` (mensaje seguro de `requestId`). **No** se tocó
`lib/orders.ts`, `db.ts`, webhook, pey, checkout ni `/pay/**`.
**Regresión obligatoria:** `cd web; npm run test:demo-pay` (59/59). Usa sus
propios servidores `3331–3333` y SQLite temporal; no apuntarlo a la base
principal ni mezclarlo con otros gates.

### D.1 P0 — bloqueantes (2)

| ID | Síntoma | Causa raíz | Archivo | Evidencia | Prueba necesaria | Estado |
|---|---|---|---|---|---|---|
| **P0-01** | Fiado puro muestra “el efectivo sí se registró en la caja” con `paidCents=0` | Banner de `SaleResult` incondicional cuando hay crédito abierto; no consulta `cashPaidCents > 0` | `web/src/components/caja/sale-result.tsx:133-137` | `EVIDENCIAS/final-fiado-puro.png`, `repo-fiado-banner-p0.json`, `onboarding-caja-resultado-fiado.png` | Vender $100 a fiado; assert API `paid=0`, 0 pagos, copy sin “efectivo” y captura | **ABIERTO** |
| **P0-02** | Mixto efectivo $60 + digital $40 oculta $60 y dice “El dinero aún no se considera recibido” | El bloque de importe solo muestra `dueCents`; el copy global no se condiciona a `paidCents>0`. La fila de `/ventas` repite la pérdida | `web/src/components/caja/payment-panel.tsx:152-156`; `web/src/app/ventas/page.tsx:128-184` | `EVIDENCIAS/final-mixto-panel.png`, `repo-mixto-cash-hidden-p0.json` | Pagar $60 efectivo + $40 digital; assert `paid=6000`, `due=4000`, “Recibiste $60” y “Falta $40” en panel y fila | **ABIERTO** |

### D.2 P1 — graves (13; P1-10 cerrado en demo local)

| ID | Síntoma | Causa raíz conocida / a investigar | Archivo(s) | Evidencia | Prueba necesaria | Estado |
|---|---|---|---|---|---|---|
| **P1-01** | Dos Cajas, dos drafts, dos `requestId`; la nav a legacy oculta el draft v2; riesgo de doble venta | Dos stores/llaves independientes: v1 `caja-app.tsx` y v2 `caja-screen.tsx`; no hay migración/lock; la nav enlaza a `/` legacy | `components/caja/caja-screen.tsx:32-34`; `components/caja-app.tsx:110-116`; `components/shell/nav.ts:25-53` | `final-two-drafts-*.png`, `final-two-cajas-nav.png`, `repo-playwright-state.json` | Inyectar draft v1, abrir `/caja`, confirmar una sola venta o aviso explícito; dos pestañas con distinto draft | **ABIERTO** |
| **P1-02** | Importe por línea invisible en desktop/tablet | `span.tabular-nums` queda en 1×1 px por clip CSS; el importe se separa mal del label | `components/caja/caja.css:177-184,950-957`; `sale-line-items.tsx` | `importe-linea-invisible.txt`, `final-line-*.png`, `design-caja-importe-vacio-crop.png` | 1448/1366/1280/768: importe >0, visible, sin clip | **ABIERTO** |
| **P1-03** | CTA “Confirmar venta” fuera del primer viewport a 1366/1280/768; a 390 solo paybar | Layout vertical fijo; paybar/compact summary no cubre 768–980; CTA no sticky | `components/caja/caja.css:841,859`; `sale-summary.tsx` | `caja-layout-measures.txt`, `final-cta-*.png`, `shell-cta-scrolltop.json` | 3 conceptos + 0 conceptos: `confirm` bottom ≤ viewport en 1366/1280/768 | **ABIERTO** |
| **P1-04** | Texto 200%: cabeceras encimadas, CTA lejos, labels solapados; `/ventas` 320 +17 px | Grids fijos y breakpoints 760/980; reflow no probado con rectángulos disjuntos | `caja.css`; `app/ventas/ventas.css:249-260`; `shell.css` | `a11y-text-resize.json`, `text200-geometry.txt`, `final-text200-*` | 1366/768/390/360/320 + 200%: sin intersección, sin scroll horizontal; CTA visible | **ABIERTO** |
| **P1-05** | Foco queda en `BODY` al navegar; paginar deja foco fuera de pantalla; sin anuncio | AppShell no mueve foco a `main`/`h1`; pager no enfoca encabezado ni hace scroll | `components/shell/app-shell.tsx:36-51`; `app/ventas/page.tsx` pager | `shell-probes2.json`, `a11y-pagination.json`, `keyboard-focus.json` | Teclado: `activeElement` h1/main tras nav; foco al inicio de lista/página + `aria-live` | **ABIERTO** |
| **P1-06** | Un cobro pendiente secuestra `/caja`; no hay “Nueva venta” ni “Descartar”; solo reabre el último | Auto-resume del último `PENDING_KEY` sin salida ni lista de pendientes | `caja-screen.tsx:114-144,554-556`; `payment-panel.tsx:186-250` | `repo-pending-blocks-new-sale.json`, `repo-pending-last-only.json` | Recargar con pendiente: poder iniciar otra venta o descartar; listar todos | **ABIERTO** |
| **P1-07** | Cambio fantasma: $100 efectivo + $100 fiado → “Cambio $100, aplicado $0”; aviso falso “El total cambió” en split válido | Cambio calculado sobre efectivo recibido menos total, no sobre efectivo aplicado; hint no se condiciona a split válido | `caja-screen.tsx:80-90`; `sale-summary.tsx:59-63,143-176` | `final-mixto-phantom.png`, `repo-mixto-hint.json`, `repo-mixto-false-total.png` | `cash+credit>total` no muestra cambio; split $40+$30+$30 no avisa | **ABIERTO** |
| **P1-08** | `/ventas` en `payment_pending` oculta “Cobrado $60” y solo muestra “Pendiente/Falta $40” | Rama de render prioriza `payment_pending` antes de `paidCents>0` | `app/ventas/page.tsx:164-171` | `final-ventas-payment-pending.png`, `final-verificador-history.json` | Fila mixta `paid=6000/due=4000`: mostrar Cobrado y Falta por separado | **ABIERTO** |
| **P1-09** | Abonos demo suman $450 a “Cobrado confirmado” con subtítulo “demo no cuenta” | Agregado `cashCents` en `db.ts` incluye `credit_payments` demo; UI no desglosa | `lib/db.ts:1832-1845`; `app/ventas/page.tsx:96-109` | `final-abono-demo-cobrado.png`, `pagos-ventas-stable.json` | Abono demo no suma a “Cobrado confirmado” real o el subtítulo lo declara; test de agregado | **ABIERTO** (dueño datos) |
| **P1-10** | `/api/demo/pay` aceptaba `demo=0` y duplicaba en multiproceso | Faltaba guard `orders.demo=1`, lock e idempotencia durable; el cliente solo bloqueaba doble clic | `lib/demo-payments.ts`; `app/api/demo/pay/route.ts` | Auditoría: `pagos-demo-*.json`; remediación: `EVIDENCIA_FINAL.md`, `demo-pay-contract.txt` | `npm run test:demo-pay`: 59/59, no-demo 409, 6 carreras, lock externo, reinicio | **CERRADO demo local** |
| **P1-11** | Fiados/Corte/Metas/Pendientes salen a legacy sin aviso; labels cambian | `nav.ts` enlaza a alias 307 que renderizan el shell legacy de `/?tab=` | `components/shell/nav.ts:25-62`; `app/*/route.ts` | `routes-navigation.txt`, `onboarding-ayuda-desde-caja.png`, `03_shell.md` | La nav debe marcar “legacy” o no enlazar como si estuviera migrado | **ABIERTO** |
| **P1-12** | 502 post-commit + editar + confirmar duplica una venta pagada (4000 y 8000) | La UI trata 502 como reintento normal; permite editar y genera nuevo `requestId`; no reconcilia estado desconocido | `caja-screen.tsx:630-642`; `sale-summary.tsx:64-79` | `pagos-502-edit.json`, `pagos-502-antes-de-editar.png` | Simular 502 después del commit: conservar llave, bloquear edición, reconciliar; una sola orden | **ABIERTO** |
| **P1-13** | Inicio 768: papel picado invade H1; CTA “Ir a ventas” clip 85 px | Layout heredado de A; arte absoluto y medidas fijas | `app/inicio/inicio.css:649,698-702,792` | `design-capturas/design-inicio-768-clip-crop.png`, `design-inicio-768-h1-picado-crop.png` | 768×1024: sin intersección arte/H1/CTA; captura y assert | **ABIERTO heredado A** |

**Conteo operativo:** 2 P0 abiertos + 12 P1 abiertos; P1-10 cerrado en demo
local. Los 13 P1 siguen documentados para no perder el histórico.

### D.3 P2/P3

No bloquean B.1 por sí solos, pero afectan la calidad: P2-01…P2-18 y P3-01…P3-10
en `09_HALLAZGOS_PRIORIZADOS.md` y `11_VEREDICTO_INDEPENDIENTE.md` §4.3–4.4.
Priorizar en B.1 solo los que se acoplen a un lote (p. ej. P2-03/P2-06 puntero
pendiente con P1-06; P2-05 polling viejo con P1-08; P2-07 draft corrupto con
P1-01; P2-11/P2-12 con accesibilidad).

---

## E. Plan de remediación — Operación B.1

> **No ejecutado.** Requiere autorización explícita de la próxima sesión.
> Orden obligatorio: lote 1 → lote 2 → lote 3. Un commit acotado por lote,
> con pruebas y sin mezclar refactors.

### Lote 1 — Verdad financiera (primero, bloqueante)

**Alcance:** P0-01, P0-02, P1-07, P1-08, P1-09.

1. **P0-01** — Condicionar el banner de `SaleResult` a `cashPaidCents > 0`.
   Fiado puro: “No recibiste dinero; todo quedó a fiado”.
2. **P0-02** — `PaymentPanel`: mostrar “Ya recibiste $X” y “Falta digital $Y”
   cuando `paidCents>0`; eliminar la frase global “el dinero aún no se recibió”.
   Replicar en la fila de `/ventas`.
3. **P1-07** — Cambio solo si `appliedCash>0`; bloquear/avisar
   `cash+credit>total`; quitar el aviso falso “El total cambió” en split válido.
4. **P1-08** — En `payment_pending`, mostrar siempre `paidCents>0` como
   “Cobrado $X” y el faltante por separado.
5. **P1-09** — Con dueño de datos: excluir abonos demo de “Cobrado confirmado”
   o desglosar demo/real de forma explícita. No cambiar la semántica de
   `payments` reales.

**Archivos probables:** `sale-result.tsx`, `payment-panel.tsx`,
`app/ventas/page.tsx`, `sale-summary.tsx`, `caja-screen.tsx` (solo cálculo de
presentación), `lib/db.ts` (solo P1-09, con aprobación).
**Gate:** p0-venta 66/0, p0-fiado 51/0, p0-corte 69/0, p0-dinero 45/0+3 KNOWN;
nuevas regresiones de copy/estado; capturas 1448/390.
**Salida:** ningún flujo dice “efectivo recibido” con `paid=0`; ningún panel
oculta `paid>0`; cambio y agregado demo coherentes.

### Lote 2 — Integridad de operaciones

**Alcance:** P1-01, P1-06, P1-12; regresión de P1-10.

1. **P1-01** — Un solo draft/`requestId` o migración v1→v2 con lock; si hay dos
   Cajas, avisar y bloquear doble confirmación; nav no debe ocultar el draft v2.
2. **P1-06** — Salida “Nueva venta”/“Descartar” en pendiente; lista de todos los
   pendientes, no solo el último.
3. **P1-12** — 502 post-commit como estado desconocido: conservar llave, no
   permitir editar/confirmar sin reconciliar; una sola orden pagada.
4. **P1-10** — No regresar: `npm run test:demo-pay` 59/59; no tocar `paid` real.

**Archivos probables:** `caja-screen.tsx`, `caja-app.tsx` (solo puente/migración),
`payment-panel.tsx`, `sale-summary.tsx`, `sale-line-items.tsx`.
**Gate:** p0-venta, p0-integración, `test:demo-pay`, dos pestañas, simulación
502, recarga con pendiente.
**Salida:** misma venta no se registra dos veces; un pendiente no secuestra la
pantalla; un 502 no duplica dinero.

### Lote 3 — Operación, responsive y accesibilidad

**Alcance:** P1-02, P1-03, P1-04, P1-05, P1-11, P1-13.

1. **P1-02** — Importe por línea visible en 1448/1366/1280/768.
2. **P1-03** — CTA visible en 1366/1280/768; paybar/compact summary hasta 980.
3. **P1-04** — 200% con rectángulos disjuntos; `/ventas` 320 sin overflow;
   paybar no tapa total.
4. **P1-05** — Foco a `main`/`h1` tras navegar; foco al inicio al paginar;
   `aria-live`.
5. **P1-11** — Nav honesta: marcar legacy o no presentar como migrado.
6. **P1-13** — Inicio 768 sin solapamiento arte/H1/CTA.

**Archivos probables:** `caja.css`, `ventas.css`, `shell.css`,
`sale-line-items.tsx`, `app-shell.tsx`, `ventas/page.tsx`, `nav.ts`,
`inicio.css`.
**Gate:** HIG 5/5, mobile-320 60/60, axe 0 normal/HC, 200% con intersección de
rectángulos, teclado/foco, capturas 1448/1366/768/390/360/320.
**Salida:** operable con teclado, sin recortes ni solapes, y nav que no engaña.

### Regla de cierre de cada lote

- Prueba nueva que **falle antes** del fix y pase después.
- Suites financieras + integración + checkout + regresión B verdes.
- `verify:fast`/`verify:static` en verde; `verify:evidence -- --static` PASS
  sobre HEAD limpio.
- Commit acotado con mensaje `fix(caja): ...` y sin archivos no relacionados.
- Revisión independiente al final del lote o al final de B.1, no solo
  autoaprobación.

---

## F. Contratos que deben preservarse

### F.1 Rutas y APIs

| Contrato | Regla |
|---|---|
| `GET /` + `?tab=` | Caja legacy sigue operativa; no romper deep links |
| `/caja`, `/ventas` | Pantallas reales; no volver a redirects |
| `/fiados`, `/corte`, `/metas`, `/pendientes` | 307 con `ayuda=1`; no convertir en pantalla falsa |
| `/pay/[id]`, `/pay/[id]/success` | Checkout público intacto; no meterlo al AppShell |
| `POST /api/orders` | Creación con `requestId`/hash; una sola orden por llave |
| `GET/POST /api/orders/[id]`, `/pay` | Motor de venta; no reimplementar |
| `POST /api/demo/pay` | **Solo demo**, `orders.demo=1`, idempotente, 59/59 |
| `POST /api/credits/[id]/pay` | Abono de fiado; no es venta nueva; idempotente |
| `POST /api/cash/close` | Corte versionado; `expectedVersion`; 409 si cambió |
| `POST /api/webhooks/pey` | Firma Standard Webhooks; **solo** esta ruta marca `paid` |
| `GET /api/verify` | Solo `provider='pey'`; demo responde `verified:false` |
| `POST /api/checkout/[id]` | Checkout público; mismo contrato |
| `POST /api/demo/reset` | Puede devolver 409 si hay pago real firmado; **no forzar** |

### F.2 Tablas y restricciones

Verificadas en `web/src/lib/db.ts`:

- `orders`: `demo`, `status`, `total_cents`, `paid_cents`, `credit_cents`,
  `request_id` + `request_hash`, `merchant_id`; índice único parcial
  `(merchant_id, request_id)`.
- `order_items`: conceptos, cantidades, precios en centavos.
- `payments`: `transaction_id UNIQUE`; `provider`, `method`, `amount_cents`,
  `status`, `demo`.
- `payment_events`: `idempotency_key UNIQUE`; payload, hash, resultado.
- `credits`, `credit_payments`: deuda y abonos; `credit_payments.request_id`
  único parcial.
- `cash_closes`: `(date, version)` único y `request_id` único parcial.
- `customers`, `goals`, `goal_contributions`, `tasks`, `audit_log`.

### F.3 Reglas financieras

- Dinero en **centavos enteros**; no floats para cálculos.
- `paid` solo por webhook firmado de pey; nunca por cliente, captura o demo.
- `demo_paid` es simulación; nunca se presenta como real.
- Efectivo es declarado; no lo confirma el banco.
- Fiado es deuda; un abono no crea venta nueva.
- `payment_pending` no es ingreso.
- Meta/apartado no es custodia.
- Idempotencia por `requestId`/hash, `transactionId`, `webhook-id`,
  `expectedVersion`.
- Toda transición deja `audit_log` y conserva eventos.

### F.4 Comprobado vs supuesto

| Comprobado | Supuesto / no verificado |
|---|---|
| Webhook 40/40; p0-dinero 45/0+3 KNOWN | Pago real de $0.01 y webhook del banco |
| p0-venta, fiado, corte, integración | Producción multi-usuario / auth |
| Checkout 19/19 | QR real escaneado, lector físico |
| Demo-pay 59/59 y no-demo 409 | Multiproceso “natural” sin lock de prueba |
| `verify:static` 5/5 y evidence PASS | `verify:full` 23/23 en HEAD |
| Rutas y headers privados | iOS/Safari, teclado virtual real |
| A11y smoke axe 0 normal/HC | Lector de pantalla real, HCM real |
| Agregados demo reproducidos | Estudio con 5 personas |

---

## G. Subagentes

### G.1 Perfiles realmente configurados

En `.opencode/agents/` hay **10 perfiles** (9 subagentes + 1 primario):

| Perfil | Modo | Permiso de edición | Responsabilidad / límite |
|---|---|---|---|
| `mc-orquestador` | `primary` | `ask` | Coordina y reparte; no programa producto sin aprobación; puede crear workplan/reportes |
| `mc-auditoria-repo` | subagent | **deny** | Inventario, contratos, git, dependencias; solo lectura |
| `mc-verificador-final` | subagent | **deny** | Revisión cruzada, regresión, GO/NO-GO; solo lectura/pruebas |
| `mc-accesibilidad` | subagent | **deny** | WCAG, teclado, reflow, contraste; informes/tests; parche solo con propiedad explícita |
| `mc-ventas-pagos` | subagent | `ask` | Venta/cobro/QR; backend/PSP solo con tarea explícita |
| `mc-fiado-corte` | subagent | `ask` | Fiado, abonos, corte; no estados de venta compartidos sin coordinar |
| `mc-modulos-negocio` | subagent | `ask` | Metas, pendientes, reportes; solo módulos asignados |
| `mc-onboarding-ayuda` | subagent | `ask` | Onboarding, microcopy, ayuda; IA no toca dinero |
| `mc-shell-responsive` | subagent | `ask` | Shell, nav, topbar, mobile nav; rutas asignadas |
| `mc-sistema-diseno` | subagent | `ask` | Tokens, tipografía, iconos, primitivas compartidas |

### G.2 Perfiles usados vs sesiones reales

- En este harness los subagentes invocables son `explore` y `general`; **los
  perfiles `mc-*` no se invocan por nombre**. Se lanzan como `general` con el
  rol escrito en el prompt.
- En la sesión de remediación se usaron **`general` con rol asignado**:
  - `mc-ventas-pagos` (análisis + implementación demo-pay),
  - `mc-auditoria-repo` (revisión de contratos),
  - `mc-verificador-final` (verificación independiente y confirmación final).
- Los informes de la auditoría B citan los nueve roles; no hay un log de
  sesiones versionado que pruebe cada invocación. No confundir “perfil
  configurado” con “sesión ejecutada”.
- `mc-orquestador` es `mode: primary`; no se puede lanzar como subagente. En
  esta sesión el agente principal hizo de orquestador.

### G.3 Reglas de escritura para B.1

- Auditoría/verificador: **solo lectura**; pueden escribir su informe.
- Implementadores: editar solo los archivos de su lote; no tocar el motor
  financiero ni `db.ts` sin dueño explícito.
- Un solo escritor por archivo; si dos lotes comparten `caja-screen.tsx` o
  `payment-panel.tsx`, se ejecutan secuencialmente, no en paralelo.
- El orquestador integra y commitea; ningún subagente hace merge ni deploy.

---

## H. Instrucciones para la próxima sesión

### H.1 Leer primero (en este orden)

1. `harness/HANDOFF_OLEADA_B1.md` (este documento).
2. `harness/STATE.md`.
3. `AGENTS.md` y `HARNESS.md`.
4. `GOAL.md` §3 (invariantes de dinero) y `GOAL-HIG.md`/`HIG-DESIGN.md`.
5. `quality-reports/oleada-b-review/09_HALLAZGOS_PRIORIZADOS.md`,
   `10_PLAN_CORRECTIVO.md`, `11_VEREDICTO_INDEPENDIENTE.md`,
   `12_GO_NO_GO.md`.
6. `quality-reports/oleada-b-remediation/EVIDENCIA_FINAL.md`.
7. `quality-reports/MIGRACION_INTEGRAL_MERCADO_CERO.md` (matriz; **está
   desactualizada** en el estado de B, usar solo para rutas/contratos).

### H.2 Comprobar antes de tocar código

```powershell
cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero"
git rev-parse HEAD                 # esperado: 844f759...
git status --short                 # esperado: limpio o solo el handoff
Get-Content web\.next\BUILD_SHA    # esperado: 844f759...
Invoke-WebRequest http://localhost:3100/api/health
cd web
npm run verify:evidence -- --static
npm run test:demo-pay
```

Si el servidor no está arriba, levantarlo con `DEMO_MODE=true`,
`APP_URL=http://localhost:3100` y la DB local; si se van a mutar datos, usar DB
temporal y servidor aislado, nunca la base con pago real firmado.

### H.3 Autorizado / no autorizado

**Autorizado en la próxima sesión, solo tras instrucción explícita:**

- Leer y verificar todo.
- Implementar **Operación B.1** por lotes, empezando por el lote 1.
- Añadir pruebas de regresión y evidencia.
- Crear una rama/worktree de trabajo desde `844f759`.
- **Conservar** la corrección de `/api/demo/pay`; no reimplementarla.
- Ejecutar `cd web; npm run test:demo-pay` como regresión obligatoria,
  independiente y aislada (puertos `3331–3333`, SQLite temporal), antes y
  después de tocar Caja; **no** apuntarla a la base principal.
- Commit acotado **solo si el usuario lo autoriza**.

**No autorizado:**

- Ejecutar B.1 sin autorización explícita.
- Iniciar Oleada C.
- Modificar `paid`, webhook real, pey, checkout o `/pay/**`.
- Reescribir el motor financiero o `db.ts` sin dueño.
- Migraciones de DB, `demo/reset` forzado o borrar datos.
- Merge, deploy, push o handoff público.
- Declarar GO local sin P0/P1 cerrados o waivers.
- Tocar/borrar la auditoría o sus evidencias.

### H.4 Comandos reales

Desde `web/`:

```powershell
npm install
npm run dev                    # desarrollo
npm run build                  # sella BUILD_SHA = HEAD
npm start                      # producción local

npm run verify:fast            # guard + lint + types
npm run verify:static          # fast + deps + build
npm run verify:full            # 23 gates; requiere servidor/túnel
npm run verify:full -- --skip=tunnel,preflight   # partial, NO es GO
npm run verify:evidence -- --static
npm run verify:evidence        # full; solo si latest.json es del HEAD
npm run harness:report
npm run test:harness
npm run test:demo-pay          # 59 checks multiproceso
npm run test:contracts         # security + datos + perf
```

Pruebas B específicas:

```powershell
$env:BASE_URL="http://localhost:3100"
$env:OLEADA_B_OUT="$env:TEMP\oleada-b"
python scripts\oleada-b-smoke.py
python scripts\oleada-b-a11y.py
```

Los gates p0 levantan sus propios servidores aislados (`3211–3213`) y no deben
usar la base de la demo. `checkout` usa `3215`; `p0-demo-pay` usa `3331–3333`;
el smoke B aislado puede usar `3340`. No ejecutar `demo/reset` sobre la base
principal: devuelve 409 por un pago real firmado.

### H.5 Cómo verificar cada corrección

| Lote | Prueba mínima | Evidencia |
|---|---|---|
| P0-01 | Fiado puro: API `paid=0`, 0 pagos, copy sin “efectivo” | captura + assert de texto/DB |
| P0-02 | Mixto 60/40: `paid=6000`, `due=4000`, “Recibiste/Falta” en panel y fila | captura + assert |
| P1-07 | $100 efectivo + $100 fiado: sin cambio; split válido sin aviso | captura + test de cálculo |
| P1-08 | `payment_pending` con `paid=6000`: Cobrado 60 y Falta 40 | assert DOM/DB |
| P1-09 | Abono demo no suma a “Cobrado confirmado” real | SQL + UI |
| P1-01 | Draft v1 + `/caja` v2: una sola venta o aviso/lock | Playwright dos pestañas |
| P1-06 | Recarga con pendiente: Nueva venta/Descartar; lista completa | Playwright |
| P1-12 | 502 post-commit + editar: una sola orden, misma llave | mock de red + DB |
| P1-10 | `npm run test:demo-pay` 59/59; no-demo 409 | salida del contrato |
| P1-02/03 | 1448/1366/1280/768: importe visible, CTA en viewport | Playwright medidas |
| P1-04 | 200% y 320: rects disjuntos, sin scroll horizontal | Playwright + capturas |
| P1-05 | Teclado: foco h1/main; pager al inicio + anuncio | `activeElement`, `aria-live` |
| P1-11 | Nav marca legacy o no enlaza | inspección DOM + captura |
| P1-13 | 768: sin intersección arte/H1/CTA | rects + captura |

### H.6 Criterios de salida de B.1

1. **P0 = 0.**
2. **P1 = 0** o waivers escritos con dueño, fecha y mitigación.
3. Lote 1, 2 y 3 con sus pruebas y capturas del HEAD corregido.
4. Suites financieras, integración, checkout y regresión B verdes.
5. `npm run test:demo-pay` **59/59** en cada corte que toque Caja; sin
   reimplementar el endpoint ni mezclar su SQLite aislada.
6. `verify:fast`, `verify:static` y `verify:evidence -- --static` PASS sobre
   HEAD limpio.
7. `verify:full` aplicable; si `tunnel`/`preflight` no existen, documentar
   `partial` y **no** declarar GO público.
8. Verificador independiente re-reproduce P0/P1 y firma.
9. Recién entonces: decidir cierre local de B; el handoff público sigue
   condicionado a pey real, QR/lector/iOS y `latest.json` full.
10. **Oleada C no se inicia** hasta que esta decisión quede registrada.

### H.7 Primer prompt sugerido para la nueva sesión

> “Lee `harness/HANDOFF_OLEADA_B1.md` y verifica HEAD, árbol, build y evidencia.
> No implementes todavía. Propón el plan detallado del **lote 1 (verdad
> financiera)** con pruebas que fallen antes del fix, y espera autorización
> explícita antes de editar producto.”

---

## Fuentes de verdad

- Código y pruebas: `web/src/`, `web/scripts/`.
- Estado vivo: `harness/STATE.md`.
- Auditoría B: `quality-reports/oleada-b-review/00..12` y `EVIDENCIAS/`.
- Remediación demo-pay: `quality-reports/oleada-b-remediation/`.
- Matriz de migración: `quality-reports/MIGRACION_INTEGRAL_MERCADO_CERO.md`
  (desactualizada en el estado de B; no usarla como estado actual).
- Harness: `HARNESS.md`, `harness/EVALS.md`.
- Reglas de agentes: `AGENTS.md`, `.opencode/agents/*.md`.
- Invariantes de dinero: `GOAL.md` §3.
