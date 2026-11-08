# HANDOFF DE ROTACIÓN — Operación Mañana

**Fecha:** 2026-11-06 21:25 America/Mexico_City
**Para:** nueva sesión de Lead/DSH
**Objetivo:** continuar la Operación Mañana sin arrastrar el contexto de la sesión anterior.

## 0. Lee esto primero
1. `reports/RELEVO/CLICKABLE-SCREEN-MATRIX.md` — pantallas/rutas/dueños.
2. `references/DEFINITIVE/MANIFEST.json` + `SCREEN-MATRIX.md` — 31 refs activas.
3. Este handoff y `reports/RELEVO/watchdog-live.json`.
4. `reports/RELEVO/INFRA-MACRO.html` — mapa visual de infraestructura.
5. `docs/DEMO-RUNBOOK-EMERGENCY.md` — fallback de demo.

## 1. Estado del producto
- **Candidato servido:** `http://127.0.0.1:4497` — build **`d1fe344fcaa15a5625d09db10a6e049c6464ba03`**; DB demo; estable.
- **Fallback obligatorio:** el mismo `d1fe344` y su DB; no sobrescribir.
- **Ensamblaje B:** `C:\Users\Public\Documents\MercadoCero-Visual-Sync\integration-assembly`
  - branch `revision/assembly-2`, merge de `revision/caja-b` + fixes P1/B2/B5 (`8e4e675`/`393f600`) + A/OC/Onboarding/Detalle.
  - build **`53b1f61cea9dbabddd3ccf31c3428db756cd05a0`**, servido en **4580** (aislado).
  - gates: security 58/58, demo-pay 66/66, B1 73/73, static 5/5, 18 rutas 0 errores.
  - A post-fix: P1/B2/B5 GO condicionado; Detalle implementado.
  - smoke 18 rutas 200/0 pageerrors.
- **No hay merge a la rama principal ni push.**

## 2. Workers vivos
### Codex
- A: worktrees de revisión; cuota limitada hasta 21:11 (ya pasó, reintentar); no es writer de 4497.
- B: `b-refs-worktree`, branch `revision/caja-b`, 14 commits + reporte `B-REFS-IMPLEMENT.md`; terminado. B2/B5 se están corrigiendo en una sesión OpenCode dentro de ese worktree.
- B elevado falló por `CODEX_HOME`/UAC; no insistir sin autorización.

### OpenCode pagado
- Bridge `http://127.0.0.1:4096` vivo.
- Sesiones nuevas y sus 9 subagentes reales (verificado `parent_id`):
  - S1 `ses_e4c393d81ffdJnB3rCQJNEF0Nc` — Fiados; hijos `S1-A/B/C`.
  - S2 `ses_e4c0ce405ffeba7fA5VNSQSsqW` — Corte/Metas/Pendientes; hijos `S2-A/B/C`.
  - S3 `ses_e4c0cc04cffd1yK85Vw78lnCTO` — QA clickable; hijos `S3-A/B/C`.
- Onboarding: worktree `oc-onboarding-worktree`, branch `revision/onboarding-oc`.
- B2/B5: worktree `b-refs-worktree`, sesión OpenCode nueva.
- A pantallas: `a-screens-worktree`, branch `revision/a-screens`; actualmente sin commits.
- Estados: `oc-estados-worktree`, branch `revision/oc-estados`; cambios sin commit.

## 3. Infra ya construida
- **Watchdog:** `reports/RELEVO/tools/relevo-watchdog` — 52/52 tests; estado real en `watchdog-live.json`:
  - web OK, STT OK, SHA OK, MANIFEST OK.
  - WARN solo por colas históricas viejas en `Public\...\queues` (0 críticas).
- **Router/Triggers:** `reports/RELEVO/tools/relevo-router` — 47 tests; CLI `emit|list|next|ack|lease|triggers`.
- **ref.tools:** `reports/RELEVO/tools/relevo-ref` — verify **31/31 PASS**.
- **Worktree manager:** `reports/RELEVO/tools/relevo-worktrees`.
- **Timer/plugins DSH:** Cordis 229 entries; plugin AgentOS activo; sin panel de estado todavía.

## 4. Contexto y fuentes de verdad
- **Context Fabric/AgentOS MCP:** `agentos-mcp`; 17 tools; event-chain 237 OK.
  - **Ojo:** `agentos_status` está **blocked** por presupuesto histórico (2,134,052 > 2,000,000 tokens; período 2026-11-05). No confundir con el estado del producto.
- **Refs:** `C:\Users\Public\Documents\MercadoCero-Visual-Sync\references\DEFINITIVE` (31 activos: 24 móvil, 1 desktop, composites/tableros/assets).
- **Evidencia:** `reports/RELEVO/` y `reports/RELEVO/evidence/`.
- **Worktrees:** todos bajo `C:\Users\Public\Documents\MercadoCero-Visual-Sync\`.
- **Regla de contexto:** cada worker recibe solo su prompt + worktree + refs + scope + ruta de evidencia; el Lead lee resúmenes, no logs gigantes.

## 5. Invariantes
1. **No merge/push** sin aprobación explícita y evidencia.
2. **No tocar 4497** mientras se construye en worktrees; build/servidor solo en aislado.
3. **Un writer por worktree**.
4. **Demo_paid**, nunca `paid` sin webhook firmado.
5. Ref exacta `DEFINITIVE`; sin “parecido”.
6. Desktop solo Inicio tiene ref; no inventar desktop 2–18.
7. Si B/OpenCode no pasan, fallback `d1fe344`.

## 6. Pendientes inmediatos
1. Recoger commits de S1/S2/Onboarding; si no hay commits, no integrar.
2. Cerrar B2/B5 con OpenCode; mergear a assembly solo con capturas/tests.
3. Revisar `A-REVIEW-B.md` y veredicto de A.
4. Integrar pantallas A/OpenCode en `revision/assembly-2` solo si gates.
5. Crear **panel de estado** (watchdog + router + SHA + workers).
6. Ensayo de demo con watchdog armado y runbook; recortar a P0 si el tiempo no alcanza.
7. Registrar deuda: pantallas no P0, desktop 2–18, `paid` real no verificado, AgentOS budget.

## 7. Próximos comandos de control
```powershell
# 4497 estable
Invoke-RestMethod http://127.0.0.1:4497/api/health

# assembly B
Invoke-RestMethod http://127.0.0.1:4580/api/health

# watchdog una vez
python reports\RELEVO\tools\relevo-watchdog\watchdog.py --once --root "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-rehearsal-ab" --manifest "C:\Users\Public\Documents\MercadoCero-Visual-Sync\references\DEFINITIVE\MANIFEST.json" --expected-manifest-sha <sha> --queues-dir "C:\Users\Public\Documents\MercadoCero-Visual-Sync\queues" --port 4497 --stt-port 4097

# refs
python reports\RELEVO\tools\relevo-ref\relevo_ref.py verify
```

## 8. Qué NO hacer
- No abrir otro servidor sobre 4497.
- No mergear B/A/OpenCode directo a `main`.
- No declarar “todas las pantallas listas” sin captura/ruta clickable.
- No gastar A/B en tareas que OpenCode puede hacer.
- No usar refs viejas de `_SUPERSEDED` salvo auditoría.
