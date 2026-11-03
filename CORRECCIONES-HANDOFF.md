# Correcciones propuestas al handoff y a los docs

> **No aplicadas.** Este carril es de supervisión: no se editó `HANDOFF-CIERRE.md` ni el código. Base: `b7154caaa2185b2cafb44a02a6bf5f8b69bef045`. Las citas son a la versión auditada; los reemplazos son texto propuesto.

## 0. Orden correcto de cierre (propuesto)

1. Actualizar docs y scripts de video **antes** del último commit de fuente.
2. Commitear; hacer `git merge --ff-only p0/final-cognitive` desde `master`.
3. `npm ci && npm run build` desde ese SHA exacto; arrancar `:3000`.
4. Reset demo; generar artefactos móviles/checkout/túnel; `preflight` 18/18.
5. `npm run verify:full` 23/23; `npm run verify:evidence` PASS.
6. Repetir los cuatro E2E cognitivos sobre el mismo build y persistir JSON con SHA.
7. Grabar video/Stageshow, verificar `$550`, commitear entregables.
8. Computer use final y declaración de límites; recién entonces marcar la DoD.

No se puede hacer el paso 5 antes del 4 si se parte de un árbol sin `demo/mobile-audit.json`, `demo/checkout-audit.json` y `demo/tunnel-smoke.json`: el gate `preflight` los exige.

## 1. `HANDOFF-CIERRE.md`

### 1.1 §1 — SHAs de partida y build

Actual (`:14-20`):

```text
- Rama final: p0/final-cognitive (worktree mercado-cero-rehearsal).
  Contiene master b5c59e1 + diseño estructural + los carriles cognitivos.
...
- Build PASS sobre el código de app e6f3107:
  BUILD SHA e6f310739622b8905bd025875abfce7b04322380.
```

Propuesto:

```text
- Rama final: p0/final-cognitive (worktree mercado-cero-rehearsal), HEAD b7154ca.
  Contiene master d35c791 (23 commits por delante de b5c59e1), diseño estructural
  y los cuatro carriles cognitivos.
- Build pre-final PASS sobre el código de app e6f3107 (20:49). No es el build del
  HEAD b7154ca: úsalo solo como referencia; el build de cierre se hace después
  del último commit de docs/scripts.
```

Motivo: `master` real `d35c791`; `b5c59e1` es ancestro; `e6f3107` es anterior a `b7154ca`. El código de app es idéntico (`git diff --name-only e6f3107 b7154ca -- web` vacío), pero `serverBuildSha === HEAD` es obligatorio.

### 1.2 §2/§3 — preflight y `APP_URL`

Actual (`:64-76`):

```powershell
$env:APP_URL='https://TU-TUNEL.trycloudflare.com'
...
node scripts/preflight.mjs
```

Problema: `web/scripts/preflight.mjs:40` hace `const appUrl = (env.APP_URL ?? LOCAL)`, donde `env` viene **solo** de `web/.env.local`; `$env:APP_URL` no se lee. Con el worktree final sin `.env.local`, el preflight compara contra `http://localhost:3000` y falla `APP_URL es HTTPS` y `El QR apunta al túnel actual`.

Propuesto, añadir antes del reset:

```powershell
# web/.env.local (ignorado por git; no versionar)
# DEMO_MODE=true
# APP_URL=https://involve-picking-wellness-retreat.trycloudflare.com
```

Y cambiar la nota del handoff:

```text
El preflight lee APP_URL de web/.env.local, no de $env:APP_URL. El servidor sí
puede heredar $env:APP_URL. Si el túnel cambia, actualiza .env.local y regenera QR/PDF.
```

Además, el preflight exige tres artefactos que no están versionados. Añadir antes del preflight (o dejar que `verify:full` los genere, pero entonces el preflight no puede ser el primer gate):

```powershell
python scripts/mobile-audit.py
python scripts/checkout-audit.py
python scripts/tunnel-smoke.py
node scripts/preflight.mjs
```

Verificación real hecha en este carril: con `BASE_URL=http://127.0.0.1:3302` y `APP_URL=involve...` el script dio **6/18** (2 fallas de `APP_URL`/QR y 3 artefactos ausentes; la restante fue el pendiente `$120` porque `:3302` no tiene la DB demo). No es un fallo del script por el pendiente, pero sí por `APP_URL` y por el orden.

### 1.3 §3 — E2E cognitivos y evidencia

Actual (`:86-102`): solo lista comandos. Propuesto: después de cada comando, guardar stdout/JSON en `harness/evidence/runs/<timestamp>-e2e/` (ignorado) y exigir en el JSON `git.sha`, `buildSha` y `dirty:false`.

Hallazgos concretos:

- `payment-truth-e2e.py` **no escribe JSON**; solo imprime y deja screenshots en `%TEMP%`.
- `sin-ia-e2e.py` escribe en `%TEMP%\opencode\sin-ia\sin-ia-e2e.json`, sin SHA.
- `closing-checklist-e2e.py` escribe en `%TEMP%\opencode\cierre-cognitivo\closing-checklist-e2e.json`, sin SHA.
- `companion-preferences-e2e.py` escribe `harness/evidence/companion-preferences-e2e.json`, pero con `gitAtStart.dirty:true` y SHA `e6f3107`.

Propuesto en el handoff:

```text
Ningún E2E cuenta como cierre si su JSON no declara el SHA del build y dirty:false.
payment-truth debe guardar un JSON (hoy no lo hace); closing/sin-ia deben firmar
su JSON con el SHA; companion debe reejecutarse limpio.
```

`verify:full` 23/23 **no** cubre estos cuatro E2E; el catálogo de 25 gates no los incluye. No se puede sustituir su corrida por el full.

### 1.4 §4 — video

Actual (`:106-113`): “Los scripts viven en la rama `p0/fix-video` (`c395e3e`)”. Es cierto en la rama, pero `p0/fix-video` **no es ancestro** de `p0/final-cognitive` y el HEAD tiene versiones viejas:

- `web/scripts/record-demo.py:25` hardcodea `BASE = "http://localhost:3000"` y no lee `DEMO_BASE_URL`.
- `web/scripts/film-check.py:33` usa `BASE_URL`, no `DEMO_BASE_URL`.
- `web/scripts/demo_ui.py` no existe en HEAD.

Propuesto: integrar los scripts al carril final **antes** del build, sin arrastrar docs viejos:

```powershell
git checkout p0/fix-video -- web/scripts/record-demo.py web/scripts/film-check.py web/scripts/demo_ui.py
git add web/scripts/record-demo.py web/scripts/film-check.py web/scripts/demo_ui.py
git commit -m "chore(video): integrar scripts de grabación final"
# rebuild desde este nuevo HEAD; luego:
$env:DEMO_BASE_URL='http://127.0.0.1:3000'
python scripts/record-demo.py
python scripts/film-check.py
```

Después verificar `demo/record-demo.json` (manifiesto de la versión de `p0/fix-video`), `$550`, “Cuadra”, duración y frames; commitear MP4/Stageshow solo si es el definitivo. El MP4 actual está bien identificado como histórico: 39.76 s, 1,704,744 B, 1280x800 y `$570` en el frame del corte.

### 1.5 §5 — `latest.json`

Actual (`:118-119`): “`harness/evidence/latest.json` es viejo (no es del HEAD final)”. Matiz necesario:

- En el worktree `mercado-cero` (master) sí existe: `mode:static`, SHA `0c052c4`, 15:36, `ok:true`.
- En el worktree final `mercado-cero-rehearsal` **no existe** `latest.json` ni `latest-static.json`.
- Ese archivo se llama `latest.json` pero declara `mode:static`; el contrato de `harness/evidence/README.md` dice que static escribe `latest-static.json`. Está mal nombrado.

Propuesto:

```text
No hay latest.json full en el worktree final. El único latest.json está en el
worktree master, es mode:static de 0c052c4 y no sirve para el HEAD final.
No copiarlo: generar full nuevo en el worktree final. Renombrar el static viejo
a latest-static.json o borrarlo para no confundir al siguiente agente.
```

`verify:evidence` hoy sale **1**: falta `latest-static.json`/`latest.json` en el worktree final.

### 1.6 §6 — auditoría

Actual (`:145`): “`AUDITORIA-CARGA-COGNITIVA.md` — Auditoría actual con `archivo:línea`”. La auditoría declara código `499a301` (`AUDITORIA-CARGA-COGNITIVA.md:3,30`); HEAD es `b7154ca` y difiere en 36 archivos, +6262/-579. Propuesto: “Auditoría histórica de `499a301`; re-auditar HEAD antes de citar líneas como actuales”.

### 1.7 §7 — DoD

Actual (`:158-165`) incluye “computer use final ... sin P0/P1”. El §5 admite 404 HTTP 200, forced-colors ausente y 320/200% bajo el pliegue. Propuesto:

```text
- [ ] Computer use final sin P0/P1 **nuevos**; los P0/P1 conocidos
      (404 de checkout, forced-colors, 320/200% bajo el pliegue) están listados
      y aceptados explícitamente o corregidos.
```

Si no se corrigen, no se puede marcar “sin P0/P1”.

## 2. `demo/STATUS.md`

| Línea | Actual | Propuesto |
|---|---|---|
| 3, 15-16 | SHA `3fe1cc9`; servidor `665d72e` | SHA final (hoy `b7154ca`; tras ff, el de `master`); `:3000` con build del HEAD; `:3230` preview `397039d` |
| 9 | túnel `timing-brought-lamp-aberdeen...` | `involve-picking-wellness-retreat.trycloudflare.com` (verificado HTTP 200) |
| 19, 42 | ensayo en master `75179c7` | marcar histórico; no usarlo como evidencia del HEAD |
| 47 | `p0-dinero-e2e.json` “del árbol” | el archivo **no existe**; decir “artefacto local ausente; regenerar” |
| 55-56 | `latest.json` para static; full pendiente | `latest-static.json` para static; `latest.json` full solo si existe y es del HEAD |
| 88 | conservar PID 13932; detener `:3230` | PID 13932 es el túnel de `:3000` (caído); **no** detener `:3230`, que es la preview viva; conservar su túnel |

## 3. `RUNBOOK-DEMO.md`

| Línea | Actual | Propuesto |
|---|---|---|
| 5, 33-37 | túnel `timing...`; preflight 18/18 | túnel `involve...`; preflight con `APP_URL` en `.env.local` y artefactos generados |
| 16 | solo `DEMO_MODE=true` | añadir `APP_URL=...` en `.env.local` (el preflight no lee el env del shell) |
| 44-48 | conservar PID 13932; detener `:3230` | PID 13932 es `:3000`; la preview es `:3230` (next PID 37272; túneles cloudflared PID 18952/32124). No detenerla si se va a mostrar el link/QR |
| 208 | MP4 histórico 39.8 s, 1280x800, `$570` | correcto; mantener y añadir que el definitivo debe mostrar `$550` y manifiesto |
| 223-224 | preflight 18/18 y rehearsal 3/3 | marcar “última corrida conocida”; no hay artefactos en el árbol |
| 228 | QR con `timing...` | regenerar QR/PDF con `involve...` antes de imprimir |

## 4. `GOAL-CIERRE-DEMO.md`

| Línea | Actual | Propuesto |
|---|---|---|
| 3 | master `71bc4ed` | master `d35c791`; final `b7154ca` |
| 4 | “Falta integrar p0/design-structure” | ya está integrado (ancestro de final) |
| 21 | `data 123` | `data 85 (58+20+7)` según `HARNESS.md:97` y `demo/STATUS.md:49` |
| 68 | audit `42d8f3f` | correcto como rama, pero la auditoría es snapshot de `499a301`; no llamarla actual |
| 86 | preview `techno-committees...` | preview viva `involve-picking...`; el link `techno` no está verificado |
| 104 | “Auth de sesión: no existe” | correcto; mantener como límite |
| 158-165 | DoD sin P0/P1 | “sin P0/P1 nuevos; conocidos listados” |

## 5. `harness/STATE.md`

- Línea 12: sustituir `timing...` por `involve...`.
- Líneas 49-51: sustituir `3fe1cc9`/`665d72e` por el estado real (`b7154ca`, `:3000` caído, preview `397039d`, evidencia pendiente).
- Línea 55: “cierre pendiente” sigue siendo correcto.
- Línea 60: catálogo 25/full 23 correcto.
- Añadir: “el único `latest.json` está en el worktree master y es `mode:static` de `0c052c4`; no usarlo”.

## 6. `AUDITORIA-CARGA-COGNITIVA.md`

- Encabezado: “Código auditado `499a301`; snapshot histórico. Los `archivo:línea` no describen `b7154ca` (36 archivos, +6262/-579).”
- Si se quiere usar como auditoría de cierre: reejecutar sobre `b7154ca` y actualizar líneas; mientras tanto, no citarla como “actual”.

## 7. `README.md`

- Línea 8: “F3 implementado, verificado de forma independiente y **desplegado en producción**”. La única URL viva es un quick tunnel `:3230` con `397039d`; no hay evidencia de deploy de producción. Propuesto: “**disponible en preview**” o añadir la evidencia del deploy.
- Línea 178: el MP4 histórico está bien descrito; mantener.

## 8. `web/scripts/preflight.mjs` (cambio de código, no aplicado)

Opción A (mínima, sin tocar código): poner `APP_URL` en `web/.env.local`.

Opción B (más robusta):

```js
const appUrl = (process.env.APP_URL ?? env.APP_URL ?? LOCAL).replace(/\/+$/, "");
```

Si se aplica B, actualizar `HARNESS.md` y `RUNBOOK` para decir que el preflight acepta `APP_URL` del entorno. En este carril no se aplicó.

## 9. Git y worktrees

- `p0/cognitive-integration` (no ancestro; le faltan 3898 líneas netas de final): archivar, no mergear.
- `p0/fix-video` (no ancestro): integrar solo los tres scripts necesarios; no mergear la rama completa sin revisar docs.
- `p0/design-final` y `p0/perf-data`: no están en final; decidir si se descartan o se revisan.
- 47 ramas y 48 worktrees; 4 punteros en `b7154ca` (`p0/final-cognitive`, `p0/adversarial`, `p0/context-recovery`, `p0/supervisor`). Limpiar después del cierre, no antes de congelar evidencia.
