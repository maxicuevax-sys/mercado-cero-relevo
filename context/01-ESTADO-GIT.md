# 01 · Estado Git

> **Snapshot:** 2 de noviembre de 2026, 21:43; actualizado 21:56 (America/Mexico_City).
> **Worktree:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-context`
> **Rama actual:** `p0/context-recovery`
> **Código de producto documentado:** `b7154caaa2185b2cafb44a02a6bf5f8b69bef045`
> **HEAD de la rama de contexto (primer commit):** `65c9b4fd79cb41ce97c772dc2a9f1ea4e385d98e`
> **Árbol:** limpio al snapshot (`git status --porcelain --untracked-files=all` vacío).
>
> **Aviso de vigencia:** este documento es un snapshot anterior a los fixes
> P0/P1 y a los commits de consolidación. Para el estado actual usa
> `RELEVO-VERIFICADO.md` y confirma los SHA con `git rev-parse`.

---

## 1 · Identidad del HEAD

**Código de producto documentado:** `b7154ca` (la base pedida). **Punta actual de esta rama de contexto:** `65c9b4f` (el commit que añade `context/`).

```
b7154caaa2185b2cafb44a02a6bf5f8b69bef045
Merge branch 'master' into p0/final-cognitive
Padres: 2fb0ca4  d35c791
Autor: Mercado Cero <dev@mercado-cero.local>
Fecha: 2026-11-02T20:56:45-06:00
```

El commit `b7154ca` es un **merge de `master` dentro de `p0/final-cognitive`**. No es un commit de producto nuevo: integra la punta de `master` (`d35c791`, solo docs) con el trabajo final de diseño + carga cognitiva. Ese código está contenido en:

- `p0/final-cognitive` (punta actual `2a786f1`, que solo añade el doc de bloqueo)
- `p0/adversarial` (punta `3939133`, auditoría)
- `p0/supervisor` (punta `ca3f95c`, auditoría)
- `p0/fix-adversarial` (punta `b7154ca`, sin correcciones aún)
- `p0/context-recovery` (punta `65c9b4f`, este contexto)

**No confundir:** el HEAD de producto (`b7154ca`) no es el HEAD de la rama de contexto (`65c9b4f`) ni la punta de la final (`2a786f1`).

No hay upstream configurado. `git branch -vv` muestra todas las ramas locales sin `[origin/...]`.

---

## 2 · La relación que importa: `master` vs rama final

### 2.1 · Snapshot original (21:43)

En el momento de la recuperación, el estado era:

```
*   b7154ca (HEAD -> p0/context-recovery, p0/supervisor, p0/final-cognitive, p0/adversarial)
|\  Merge branch 'master' into p0/final-cognitive
| * d35c791 (master) docs(relevo): comando correcto de preflight
* | 2fb0ca4 Merge branch 'master' into p0/final-cognitive
|\|
| * 517cb93 docs(relevo): handoff de cierre y siguiente sesion
* | fe97c00 test(cognitiva): evidencia de preferencias sobre merge final
* | e6f3107 Merge branch 'master' into HEAD
```

| Pregunta | Respuesta (21:43) |
|---|---|
| `master` | `d35c791` |
| `p0/final-cognitive` | `b7154ca` |
| Merge-base | `d35c791` |
| Commits de la final que `master` no tiene | **23** |
| Fast-forward | posible |

### 2.2 · Estado actual (21:56, tras la auditoría adversaria)

Mientras se redactaba este contexto, otro carril avanzó `master` y la final con documentación de gobernanza:

```
* 65c9b4f (HEAD -> p0/context-recovery) docs(contexto): reconstruir estado...
| * 2a786f1 (p0/final-cognitive) Merge branch 'master' into p0/final-cognitive
|/|
| * a85d903 (master) docs(relevo): bloquear merge hasta corregir P0 adversarios
|/
* b7154ca Merge branch 'master' into p0/final-cognitive
```

| Pregunta | Respuesta (21:56) | Cómo se verificó |
|---|---|---|
| `master` | `a85d903936af607e3c209fedceb2a40d8410a66e` | `git rev-parse master` |
| `p0/final-cognitive` | `2a786f14184567744b15b211993a4da30436e8a0` | `git rev-parse p0/final-cognitive` |
| ¿`master` es ancestro de `final`? | **Sí** | `git merge-base --is-ancestor master p0/final-cognitive` → exit 0 |
| Merge-base | `a85d903` | `git merge-base master p0/final-cognitive` |
| Commits de la final que `master` no tiene | **24** | `git rev-list --count master..p0/final-cognitive` |
| ¿Fast-forward posible? | **Sí, pero prohibido por el propio `master`** | `HANDOFF-CIERRE.md` (master) dice “⛔ NO MERGEAR TODAVÍA” |
| ¿La final contiene el diseño/cognitivo? | **Sí** | `b7154ca` es ancestro de `2a786f1` |
| ¿`master` contiene el diseño/cognitivo? | **No** | sigue siendo un doc de bloqueo sobre `d35c791` |

**Cambio concreto:** `master` avanzó de `d35c791` a `a85d903` con un solo commit de docs (`HANDOFF-CIERRE.md`, 7 líneas). `p0/final-cognitive` avanzó de `b7154ca` a `2a786f1` con el merge de ese doc. **No cambió código de producto.** El bloqueo dice:

> “La supervisión independiente (`p0/supervisor`, `ca3f95c`) y la auditoría adversaria (`p0/adversarial`, `3939133`) encontraron 13 afirmaciones falsas/obsoletas en este handoff y **2 P0**: el reset de demo puede borrar un pago firmado de pey, y `/` se sirve con caché pública aunque contiene datos privados. No avanzar `master` hasta integrar `p0/fix-adversarial` y leer `RELEVO-VERIFICADO.md`.” — `HANDOFF-CIERRE.md` en `master` (21:54).

**Consecuencia:** el “fast-forward” ya no es una recomendación operativa: está **bloqueado** hasta corregir los P0. La rama de contexto (`65c9b4f`) es un hermano de `b7154ca`, no está en `master` ni en la final; no se debe mergear sin decisión.

**Ramas nuevas del carril de auditoría:**

| Rama | SHA | Qué es |
|---|---|---|
| `p0/adversarial` | `3939133` | Auditoría adversaria; añade `AUDITORIA-ADVERSARIA.md`, `adversarial-report.md`, `adversarial.json`. |
| `p0/supervisor` | `ca3f95c` | Auditoría de supervisión del handoff. |
| `p0/fix-adversarial` | `b7154ca` | Rama de corrección, **sin commits todavía**; apunta al código auditado. |

**Matiz histórico:** `HANDOFF-CIERRE.md:34-37` decía que el fast-forward era posible y que “no hay merge que resolver”. Eso era verdad a las 20:55; el merge final `b7154ca` ocurrió a las 20:56. A las 21:54 el propio handoff se actualizó para bloquear el merge. La historia no se borra: se documenta.

---

## 3 · Ramas: 48 locales, 0 remotas

`git for-each-ref refs/heads` devuelve **48 ramas** (la cifra subió con `p0/fix-adversarial`). No hay remotos (`git remote` vacío), ni stashes (`git stash list` vacío), ni tags anotados además de los cuatro listados abajo.

### 3.1 Núcleo

| Rama | SHA | Posición | Estado |
|---|---|---|---|
| `master` | `a85d903` | 0 adelante / 24 detrás de la final | **Vigente como rama publicada**; contiene el bloqueo de merge, no el cierre. |
| `p0/final-cognitive` | `2a786f1` | 24 adelante / 0 detrás | **Candidata final**; no está en `master`; incluye el doc de bloqueo. |
| `p0/context-recovery` | `65c9b4f` | 1 commit propio sobre `b7154ca` | Carril de recuperación documental; no es producto. |
| `p0/supervisor` | `ca3f95c` | 1 commit de auditoría sobre `b7154ca` | Carril de supervisión; no es producto. |
| `p0/adversarial` | `3939133` | 1 commit de auditoría sobre `b7154ca` | Carril adversarial; no es producto. |
| `p0/fix-adversarial` | `b7154ca` | sin commits propios | Rama de corrección de los P0; vacía al snapshot. |

### 3.2 Ramas de carril que sí están dentro de la final, pero no de `master`

Valores de “adelante/detrás” calculados contra `master` **`d35c791`**, el snapshot de 21:43; tras `a85d903` todas están una unidad más detrás.

| Rama | SHA | Adelante/Detrás de `d35c791` | Qué aporta |
|---|---|---|---|
| `p0/design-structure` | `7a178a5` | 19 / 15 | Diseño “amable y de barrio”, checkout, success, CSS; ancestro de `b7154ca`. |
| `p0/verdad-pago` | `dfb2b79` | 7 / 15 | Una sola verdad visible del pago; `payment-labels.ts`; success pendiente. |
| `p0/sin-ia` | `207d369` | 8 / 15 | Venta manual con parser 500; consultas locales antes del parser. |
| `p0/cierre-cognitivo` | `6012b65` | 7 / 15 | “Antes de cerrar” en Corte. |
| `p0/preferencias` | `539a547` | 8 / 15 | “¿Cómo quieres que te ayude?” en Ayuda. |
| `p0/cognitive-audit` | `42d8f3f` | 6 / 15 | Auditoría de carga cognitiva; sin código de producto. |

### 3.3 Ramas con commits únicos que **no** están en la final

| Rama | SHA | Adelante/Detrás de `d35c791` (snapshot) | Commits únicos vs `HEAD` | Riesgo / lectura |
|---|---|---|---|---|
| `p0/fix-video` | `c395e3e` | 1 / 5 | `c395e3e fix(video): grabar demo por roles y verificar mp4/stageshow` | **Deuda de merge real**: añade `web/scripts/demo_ui.py` y reescribe `record-demo.py`/`film-check.py`; no está en `HEAD`. |
| `p0/design-final` | `dd3e3c9` | 2 / 21 | `dd3e3c9`, `572847d` | Dirección visual alternativa “amable y de barrio”; no es ancestro de `HEAD`. La preview detached apunta a `572847d`. No hay documento que la declare adoptada. |
| `p0/perf-data` | `87ebd0c` | 2 / 57 | `87ebd0c docs(perf-data)`, `669ab50 evidence(perf-data)` | Solo docs/evidencia; **incluye un `harness/evidence/latest.json` trackeado** en esa rama, lo que viola la regla de `HARNESS.md:139`. |
| `p0/cognitive-integration` | `ddd87dc` | 11 / 2 | `ddd87dc`, `7b1ab92` | Integración obsoleta según `HANDOFF-CIERRE.md:122-123`; no incluye preferencias/verdad/cierre. **No mergear**. |

### 3.4 Ramas históricas ya contenidas en `master` (sin deuda)

Estas ramas son ancestros de `master`; sus tips quedaron viejos pero su contenido ya está integrado:

`p0/corte` (`f87c21f`), `p0/fiado` (`fba1f62`), `p0/fix-a11y` (`f8dbdf1`), `p0/fix-data-mig` (`a0de42e`), `p0/fix-datos` (`8dc2b4f`), `p0/fix-demo-docs` (`5e31eba`), `p0/fix-demo-real` (`4db08a0`), `p0/fix-dinero` (`2990581`), `p0/fix-diseno` (`7238028`), `p0/fix-flujos` (`2c48544`), `p0/fix-harness` (`f48584e`), `p0/fix-harness-evidence` (`b8540b1`), `p0/fix-harness-p0` (`15de820`), `p0/fix-mobile-qa` (`199bc7d`), `p0/fix-rehearsal` (`d0728d1`), `p0/fix-sec-followup` (`9da8622`), `p0/fix-seguridad` (`adb3db5`), `p0/integracion` (`2afbed0`), `p0/knowns` (`bf2eec6`), `p0/pendientes` (`5242891`), `p0/pendientes-negocio` (`0cce0df`), `p0/perf-baseline` (`c0248ba`), `p0/perf-core` (`63b9cff`), `p0/perf-ui` (`b877ee3`), `p0/shell` (`4a25ac3`), `p0/venta-durable` (`a7a6088`), `p0/verify-dinero` (`c0248ba`), `p0/verify-tecleo` (`c0248ba`), `swarm/api`, `swarm/payments`, `swarm/ui` (`8c76cc4`).

También `hig-redesign` (`82aa986`, “docs: close F3 with independent LISTO verdict”) es ancestro de `master`, aunque su nombre sugiera una rama viva.

---

## 4 · Worktrees: 49

`git worktree list --porcelain` devuelve **49 worktrees** (la cifra subió con el worktree de `p0/fix-adversarial`). Es un número alto para un repo local; muchos apuntan a SHAs antiguos y varios comparten el mismo commit.

### 4.1 Worktrees clave

| Worktree | Rama / estado | SHA | Nota |
|---|---|---|---|
| `mercado-cero` | `master` | `a85d903` | Worktree principal; contiene el bloqueo de merge. **No tocar** en este carril. |
| `mercado-cero-context` | `p0/context-recovery` | `65c9b4f` | Este carril (commit de contexto). |
| `mercado-cero-rehearsal` | `p0/final-cognitive` | `2a786f1` | Worktree de la rama final; incluye el doc de bloqueo. |
| `mercado-cero-supervisor` | `p0/supervisor` | `ca3f95c` | Carril de supervisión (auditoría). |
| `mercado-cero-adversarial` | `p0/adversarial` | `3939133` | Carril adversarial (auditoría). |
| `mercado-cero-fix-adversarial` | `p0/fix-adversarial` | `b7154ca` | Carril de corrección de P0, sin commits propios. |
| `mercado-cero-design-preview` | **detached** | `572847d` | Preview de la dirección `p0/design-final`; no es la preview `:3230`. |
| `mercado-cero-design-structure` | `p0/design-structure` | `7a178a5` | Diseño estructural integrado en la final. |
| `mercado-cero-verdad-pago` | `p0/verdad-pago` | `dfb2b79` | Verdad de pago integrada. |
| `mercado-cero-sin-ia` | `p0/sin-ia` | `207d369` | Venta manual integrada. |
| `mercado-cero-preferencias` | `p0/preferencias` | `539a547` | Preferencias integradas. |
| `mercado-cero-cierre-cognitivo` | `p0/cierre-cognitivo` | `6012b65` | “Antes de cerrar” integrado. |
| `mercado-cero-fix-video` | `p0/fix-video` | `c395e3e` | Herramientas de video **no** integradas. |
| `mercado-cero-cognitive-audit` | `p0/cognitive-audit` | `42d8f3f` | Auditoría histórica. |
| `mercado-cero-integration` | `p0/cognitive-integration` | `ddd87dc` | Integración obsoleta. |

El resto son worktrees de carriles antiguos (fiado, corte, shell, perf, a11y, harness, datos, seguridad, swarm, etc.) en SHAs que ya están contenidos en `master` o en la final. No es necesario listarlos uno por uno para entender el estado; el conteo y los SHAs están en `state.json`.

### 4.2 Riesgos de borrar worktrees

1. **No borrar `mercado-cero`:** es el worktree de `master` y el que la app usa como referencia.
2. **No borrar `mercado-cero-rehearsal`:** es el checkout de `p0/final-cognitive`, la rama candidata.
3. **`mercado-cero-design-preview` está detached** en `572847d`. El commit es alcanzable desde `p0/design-final` (`dd3e3c9` es su hijo), así que no se pierde si se elimina el worktree, pero **no se debe hacer `git worktree prune` sin revisar**.
4. **No asumir que un worktree viejo está limpio.** No se inspeccionaron los árboles de los otros 47 worktrees; podrían tener cambios sin commitear. Borrar un worktree con `--force` puede destruirlos.
5. **Branches vs worktrees:** eliminar un worktree no elimina la rama, pero `git branch -d` falla si la rama está checked out en otro worktree. Hacerlo en el orden incorrecto deja el repo en un estado confuso.
6. **49 worktrees + listeners viejos:** hay listeners en `:3211` y `:3230` que pueden servir builds de SHAs distintos. `/api/health` es la única forma de saber qué código responde. La documentación ya advierte de esto (`RUNBOOK-DEMO.md:40-55`).

---

## 5 · Stashes, remotos y tags

| Elemento | Estado |
|---|---|
| Stashes | **0** (`git stash list` vacío). |
| Remotos | **0** (`git remote` vacío). No hay `origin`, no hay push/pull. |
| Tags | **4**: `pre-hig` (`4d33a46`), `hig-baseline` (`7f107f9`), `pre-hig-merge` (`74730e1`), `pre-remediation` (`7bb0dc5`). |
| Tag ancestry | Los cuatro son ancestros de `master` y de `HEAD`. |
| Reflog reciente | Confirma la creación de `p0/context-recovery`, `p0/supervisor` y `p0/adversarial` a las 21:29:46–51, todas desde `b7154ca`. |

### Tags y su significado

- `pre-hig` (`4d33a46`, 31 oct 15:20): baseline “Mercado de papel” antes del rediseño HIG.
- `hig-baseline` (`7f107f9`, 31 oct 15:43): auditoría base HIG y skill fijada (F0–F1).
- `pre-hig-merge` (`74730e1`, 31 oct 16:00): contrato de diseño HIG (F2).
- `pre-remediation` (`7bb0dc5`, 2 nov 07:38): punto previo a la remediación de movimiento/ASLI.

Los tags son la red de seguridad para volver atrás; no hay remoto que los respalde.

---

## 6 · Estado sucio y artefactos

- `git status --porcelain --untracked-files=all` está **vacío** en este worktree.
- No hay `.next/BUILD_SHA` en este worktree (`web/.next` no existe). No hay build local.
- No hay `web/node_modules`, `web/.env.local` ni `web/data/mercado-cero.db` en este worktree. Por eso no se corrieron gates ni build.
- Los artefactos de gates están ignorados por `.gitignore:24-50`: `demo/mobile-*`, `demo/checkout-*`, `demo/rehearsal.json`, `demo/tunnel-*`, `harness/evidence/motion*`, `harness/evidence/a11y-contrast*`, `harness/evidence/mobile-*`, `harness/evidence/p0-*`, `harness/evidence/runs/`, `latest.json`, `latest-static.json`.
- El único JSON de evidencia versionado es `harness/evidence/companion-preferences-e2e.json`; su propio contenido dice `dirty: true` (`:7-11`).

---

## 7 · Deuda de merges, en orden de riesgo

1. **`master` no tiene la final, pero ahora la bloquea.** 24 commits de diferencia. `master` (`a85d903`) dice “⛔ NO MERGEAR TODAVÍA” hasta corregir 2 P0 adversarios. El fast-forward sigue siendo técnicamente posible, pero está **prohibido por gobernanza**.
2. **P0-1: el reset de demo borra un pago firmado de pey.** `recordPayment` marca `demo=1` si `isDemoMode()` incluso para `provider='pey'` (`orders.ts:591`); `resetDemoData` borra `payments WHERE demo=1` (`db.ts:1973`) y calcula `preservedRealPayments` antes del borrado (`db.ts:2005`, `:2012`). El audit lo reprodujo en `:3317` con webhook firmado y `preservedRealPayments: 1`. **Corregir antes de mergear.**
3. **P0-2: `/` SSR contiene datos privados y se cachea público.** `page.tsx:10-18` renderiza `getDashboardData`; `next.config.ts:190-195` declara `Cache-Control: public, max-age=0, s-maxage=60`. El HTML puede contener nombres, saldos, fiado y URLs de cobro. **Corregir antes de mergear.**
4. **P1-1: un webhook firmado en demo produce `paid`, no `demo_paid`.** `recordPayment` pone `paid` si `provider='pey'` (`orders.ts:677-683`), aunque `demo=1`; `fulfillOrder` solo rechaza `status='demo_paid'` (`orders.ts:968-974`). El audit lo reprodujo. **Corregir antes de la demo.**
5. **P1-3: `/api/verify` acepta una transacción PAID sin referencias si el monto coincide.** `hasReferenceMismatch` solo compara referencias si el payload las trae (`verify/route.ts:212-245`). **Corregir antes de la demo.**
6. **P1-4: checkout/success inexistentes devuelven 200.** Ya observado en preview `397039d`; el audit lo confirmó en `b7154ca`.
7. **`p0/fix-video` no está integrada.** La rama final tiene `web/scripts/record-demo.py` y `film-check.py` antiguos; la versión que graba por roles y valida MP4/stageshow está en `c395e3e`. Sin ese merge, la grabación final no tiene las herramientas nuevas. `HANDOFF-CIERRE.md:106-110` dice que los scripts viven en `p0/fix-video`, lo que confirma la deuda.
8. **`p0/design-final` no está integrada.** Es una dirección visual alternativa, con `572847d` (WIP) y `dd3e3c9`; no es ancestro de `b7154ca`. No hay decisión documentada de adoptarla. No mergear sin revisión de diseño.
9. **`p0/perf-data` no está integrada.** Solo aporta reporte/evidencia; su `harness/evidence/latest.json` trackeado es un anti-patrón. Si se integra, hay que quitar ese archivo del commit.
10. **`p0/cognitive-integration` está obsoleta.** `HANDOFF-CIERRE.md:122-123` lo dice explícitamente. No mergear; la buena es `p0/final-cognitive`.
11. **Ramas históricas viejas:** no son deuda de contenido (`p0/fiado`, `p0/corte`, etc. ya están en `master`), pero sus tips pueden confundir si alguien las usa para “revisar el último estado”. Mirar `master`/`final`, no el tip de una rama de carril.

---

## 8 · Comandos de reproducción

```powershell
cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-context"

git status --short --branch
git log --all --graph --decorate --oneline -n 80
git branch -vv
git worktree list --porcelain
git stash list
git tag -n
git remote -v
git reflog --all --date=iso -n 60

# Ancestros y adelanto de la final
git merge-base master p0/final-cognitive
git merge-base --is-ancestor master p0/final-cognitive; $LASTEXITCODE
git rev-list --left-right --count master...p0/final-cognitive

# Diff de la final contra master
git diff --stat master..p0/final-cognitive
git diff --name-status master..p0/final-cognitive

# Ramas no integradas
git log --oneline p0/final-cognitive..p0/fix-video
git log --oneline p0/final-cognitive..p0/design-final
git log --oneline p0/final-cognitive..p0/perf-data
git log --oneline p0/final-cognitive..p0/cognitive-integration
```

---

## 9 · Conclusión operativa

- **Rama final candidate:** `p0/final-cognitive` = `2a786f1` (código de producto = `b7154ca` + doc de bloqueo).
- **Rama publicada:** `master` = `a85d903`, 24 commits atrás de la final.
- **Merge a `master`:** **bloqueado** por el propio `master` hasta corregir 2 P0 adversarios.
- **No hay remoto ni stash.**
- **No hay evidencia de full atada a `b7154ca`.**
- **Prioridad absoluta:** corregir P0-1 (reset borra pago pey) y P0-2 (home cachea datos privados) en `p0/fix-adversarial`; después, P1-1/P1-3/P1-4.
- **Deuda de demo:** `p0/fix-video` y el video/QR desactualizados.
