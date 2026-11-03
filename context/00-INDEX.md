# Contexto recuperado — Mercado Cero

> **Worktree:** `mercado-cero-context` · **Rama:** `p0/context-recovery` · **Base:** `b7154caaa2185b2cafb44a02a6bf5f8b69bef045`
> **Generado:** 2 de noviembre de 2026, 21:43 (America/Mexico_City).
> **Actualizado:** 2 de noviembre de 2026, 21:56, tras la auditoría adversaria y el bloqueo de merge.
> **Método:** lectura de Git, código, documentos y artefactos primarios. Los handoffs y reportes se tratan como afirmaciones a verificar, no como verdad.

---

## 1 · Qué es Mercado Cero

Mercado Cero es una **caja hablada para comerciantes de barrio**. Convierte una venta dicha en voz alta en un cobro, genera un link/QR de pago, registra efectivo, pagos mixtos y fiado en una sola libreta, y cierra el día con corte de caja y una meta de ahorro declarada.

La tesis del producto es la **certeza**: un pago digital solo se marca `paid` cuando llega un **webhook firmado de pey** (Standard Webhooks); el dinero simulado usa `demo_paid` y el efectivo se registra como `paid` al crear la venta, sin pasar por el webhook. La frase de producto es “La caja que habla” y la de cierre, “El mercado no necesita más apps. Necesita certeza.”

- Contexto de hackathon: DevDay Exchange Community Hackathon, Ciudad de México, sábado **7 de noviembre de 2026**, UTOPÍA Elena Poniatowska, Coyoacán (`README.md:5`).
- Tesis y alcance: `README.md:14-30`, `GOAL.md:10-30`.
- Invariantes de dinero: `GOAL.md:42-69`.

---

## 2 · Estado en una frase

**Hay un candidato final (`p0/final-cognitive`, ahora `2a786f1`) que contiene 24 commits que `master` (`a85d903`) todavía no tiene; el árbol está limpio, pero no existe una corrida `full`/`latest.json` que pruebe ese HEAD, el servidor `:3000` no está arriba, el túnel de demo está muerto y la preview pública sirve un build anterior (`397039d`). Además, el propio `master` bloquea el merge: la auditoría adversaria encontró 2 P0 (reset que borra un pago firmado de pey y `/` con caché pública de datos privados).**

Estado resumido:

| Dimensión | Estado observado | Calificación |
|---|---|---|
| Rama final | `p0/final-cognitive` = `2a786f1`; `master` = `a85d903`; `master` es ancestro | **VERIFICADO** (21:56) |
| Adelanto de la rama final | 24 commits adelante de `master`; fast-forward posible pero **bloqueado por P0** | **VERIFICADO** (21:56) |
| Bloqueo de merge | `master` dice “⛔ NO MERGEAR TODAVÍA” por 2 P0 adversarios | **VERIFICADO** |
| Árbol de trabajo | limpio (`git status --porcelain` vacío) | **VERIFICADO** |
| Servidor de demo `:3000` | no responde | **VERIFICADO** al 2 nov 21:43 |
| Preview | `http://127.0.0.1:3230` y túnel público, build `397039d` | **VERIFICADO** |
| Evidencia full | `harness/evidence/latest.json` ausente | **VERIFICADO** |
| Evidencia companion preferences | JSON presente, pero `gitAtStart.dirty: true` | **VERIFICADO**; no vale como handoff |
| Pago real $0.01 | no hay evidencia en el repo; los docs dicen que no ocurrió | **NO VERIFICADO / consistente con la ausencia** |
| Pruebas humanas | `demo/feedback.md` vacío; docs dicen 0/6–8 | **INFERIDO** de la ausencia de registros |
| Túnel de demo | DNS no resuelve | **VERIFICADO** al 2 nov 21:43 |

**Deriva del snapshot:** los documentos de producto se auditaron sobre `b7154ca` (la base pedida). Mientras se redactaban, otro carril avanzó `master` a `a85d903` (solo docs: bloqueo de merge) y `p0/final-cognitive` a `2a786f1` (merge de ese doc). El código de producto sigue siendo el de `b7154ca`; el cambio es documental y de gobernanza. Ver `01-ESTADO-GIT.md` §2.1.

Detalle completo en `01-ESTADO-GIT.md`, `05-EVIDENCIA.md` y `06-RIESGOS-Y-DUDAS.md`.

---

## 3 · Lectura mínima (5 minutos)

1. **El código de la rama final es más nuevo que `master`.** `master` no contiene el rediseño estructural ni los carriles cognitivos: `p0/design-structure` es ancestro de `p0/final-cognitive`, no de `master` (ver `01-ESTADO-GIT.md`).
2. **No hay prueba de cierre.** El repo no tiene `harness/evidence/latest.json` ni `latest-static.json`; el único JSON de evidencia versionado está marcado `dirty: true` (`harness/evidence/companion-preferences-e2e.json:7-11`).
3. **La demo pública no está operativa.** El QR apunta a `https://timing-brought-lamp-aberdeen.trycloudflare.com` (`demo/qr-demo.html:57`), que no resuelve; la preview que sí responde es otra URL y sirve `397039d`, no `b7154ca`.
4. **El pago real no ocurrió.** README, runbook, demo/STATUS y los goals lo repiten; no hay transacción real, comprobante de portal ni evidencia de webhook productivo.
5. **El 404 del checkout sigue siendo un P0 abierto.** El código pretende un 404 real (`web/src/app/pay/[id]/page.tsx:13-26`), pero la preview devuelve **HTTP 200** con la UI “No encontramos este cobro”; la API sí devuelve 404. Ver `05-EVIDENCIA.md`.

---

## 4 · Mapa de esta carpeta

| Archivo | Qué responde |
|---|---|
| `00-INDEX.md` | Este documento; qué es, estado y cómo navegar. |
| `01-ESTADO-GIT.md` | Ramas, worktrees, SHAs, ancestros, stashes, deuda de merges y riesgos de borrado. |
| `02-PRODUCTO.md` | Mapa real de rutas, APIs, DB, estados de pago, venta, fiado, corte, meta, pendientes, checkout, IA/voz, accesibilidad y offline/export. |
| `03-DECISIONES.md` | Decisiones tomadas, propuestas, abandonadas y superseded, con commit/archivo. |
| `04-CRONOLOGIA.md` | Línea de tiempo trazable desde commits y documentos; fechas y autores. |
| `05-EVIDENCIA.md` | Qué está probado, con qué artefacto/SHA y qué vigencia tiene. |
| `06-RIESGOS-Y-DUDAS.md` | Contradicciones, deuda P0/P1/P2 y preguntas abiertas con `VERIFICADO`/`INFERIDO`/`DESCONOCIDO`. |
| `07-GLOSARIO.md` | Términos de negocio, dinero, UI y harness. |
| `state.json` | Estado legible por máquina. |
| `context-recovery-report.md` | Hash, archivos revisados, límites y 10 hallazgos. |

---

## 5 · Diez documentos clave

| # | Documento | Para qué sirve | Vigencia |
|---|---|---|---|
| 1 | `README.md` | Tesis, MVP, demo, stack, riesgos y estado honesto del pago real. | **Vigente en lo conceptual**; algunas cifras y el adjetivo “UI vieja” están desactualizados. |
| 2 | `GOAL.md` | Contrato de profundidad e invariantes de dinero. | **Vigente** para dinero; sus fases F4/F6 son históricas. |
| 3 | `HANDOFF-CIERRE.md` | Handoff operativo del 2 nov: rama final, preview, comandos y límites. | **Parcialmente vigente**; escrito antes del último merge (ver `06`). |
| 4 | `GOAL-CIERRE-DEMO.md` | DoD de cierre, orden de carriles y límites. | **Vigente como intención**, pero su SHA de partida (`71bc4ed`) ya no es `master`. |
| 5 | `HARNESS.md` | Catálogo real de 25 gates, evidencia v2 y reglas de honestidad. | **Vigente**; el `full` no se ejecutó contra el HEAD final. |
| 6 | `HIG-DESIGN.md` | Contrato de interfaz “Mostrador claro” y actualización de material de mostrador. | **Vigente con contradicciones internas** (§16 Manrope vs §18 Atkinson; §18 mesh vs código plano). |
| 7 | `GOAL-ACOMPANAMIENTO.md` | Contrato de carga cognitiva y acompañamiento responsable. | **Vigente** como contrato; varias P1 no están implementadas. |
| 8 | `demo/STATUS.md` | Estado de demo, cifras, video, túnel y límites. | **Histórico/desactualizado**: base `3fe1cc9`, servidor `665d72e`, video “UI vieja”. |
| 9 | `harness/STATE.md` | Handoff vivo del harness y estado verde conocido. | **Histórico**: su propia línea 19 dice que la tabla no prueba el commit actual. |
| 10 | `AUDITORIA-CARGA-COGNITIVA.md` | Auditoría estructural con `archivo:línea`, P0/P1 y lo que faltaba en `499a301`. | **Histórico**: el código posterior cerró varios P0; se usa para rastrear decisiones, no como estado actual. |

Documentos operativos complementarios: `RUNBOOK-DEMO.md` (guion y fallas), `GUION-3-MIN.md` (narración), `PITCH.md` (5 slides), `TEST-USUARIO.md` (protocolo humano), `SECURITY.md` (HTTP/CSRF/Cloudflare Access), `harness/EVALS.md` (qué prueba cada gate), `SWARM/board.md` (tablero de carriles, con cifras históricas).

---

## 6 · Cómo navegar el contexto

### Por pregunta

- **“¿Qué rama debo mirar?”** → `01-ESTADO-GIT.md` §2 y §3. La candidata es `p0/final-cognitive` (`b7154ca`), no `master`.
- **“¿Esto ya está probado?”** → `05-EVIDENCIA.md`. Si no hay `latest.json`/artefacto, la respuesta es **NO VERIFICADO**.
- **“¿Cómo funciona el dinero?”** → `02-PRODUCTO.md` §5 y §6; `GOAL.md:42-69`; `web/src/lib/payment-rules.ts`; `web/src/lib/pey-events.ts`.
- **“¿Qué se decidió y por qué?”** → `03-DECISIONES.md`.
- **“¿Cuándo pasó?”** → `04-CRONOLOGIA.md`.
- **“¿Qué contradice qué?”** → `06-RIESGOS-Y-DUDAS.md` §1.
- **“¿Qué significa X término?”** → `07-GLOSARIO.md`.

### Por fuente primaria

- Git: `git log --all --graph --decorate`, `git branch -vv`, `git worktree list --porcelain`, `git tag -n`, `git reflog`.
- Código: `web/src/app`, `web/src/components`, `web/src/lib`, `web/scripts`, `web/package.json`, `web/next.config.ts`.
- DB: esquema en `web/src/lib/db.ts:107-273`.
- Evidencia: `harness/evidence/`, `demo/`, `demo/hig-before/`, `demo/stageshow/`.
- Entorno: `web/.env.example`, `web/scripts/preflight.mjs`, `web/scripts/tunnel-smoke.py`, `/api/health`.

---

## 7 · Convenciones de este contexto

- **`VERIFICADO`**: lo observé directamente en Git, en el código o con una petición de solo lectura (p. ej. `/api/health`, estado HTTP, `ffprobe`).
- **`INFERIDO`**: se deduce de una ausencia o de un patrón, pero no hay artefacto que lo pruebe.
- **`DESCONOCIDO`**: no hay fuente suficiente.
- **`NO VERIFICADO`**: un documento lo afirma, pero no encontré el JSON, la captura o la corrida que lo respalde.
- **`HISTÓRICO`**: describe un estado anterior; no debe citarse como estado actual.
- **`CONTRADICTORIO`**: dos fuentes primarias o un documento y el código no coinciden.

Regla de oro de este contexto: **un documento no es evidencia de sí mismo**. Si un reporte dice “35/35”, se busca el JSON; si no está, se marca `NO VERIFICADO`.

---

## 8 · Lo que este contexto no hace

- No cambia código, docs existentes, la app, `:3000`, `:3230` ni la preview.
- No hace merge.
- No instala dependencias.
- No lee `.env.local` ni copia secretos.
- No declara “listo” el producto: documenta qué falta para poder declararlo.
