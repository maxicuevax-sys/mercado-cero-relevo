# 01 · Estado Git

> **Corte:** 3 nov 2026 · **Rama:** `design/mercado-cero-v2`
> **HEAD:** `b8f127d85985fd519a0010128a1f42bf5346e24e` — `feat(inicio): rescate del dashboard con layout de referencia y ruta separada`
> **Padre:** `d49b649` — `docs(paridad): auditoria de referencias y fixes de heading/panel`
> **Master local:** `9206ea1` — la rama está 11 commits adelante, sin merge.
> **Remoto/upstream:** no configurado (`git remote -v` vacío).

## `git status --short`

```text
 M web/src/app/inicio/inicio.css
 M web/src/app/inicio/page.tsx
 M web/src/assets/inicio/sidebar-plantas.png
```

## `git diff --stat`

```text
 web/src/app/inicio/inicio.css             |  86 ++++++++++++++++++++++++++++++
 web/src/app/inicio/page.tsx              |   3 +-
 web/src/assets/inicio/sidebar-plantas.png | Bin 103371 -> 100863 bytes
 3 files changed, 88 insertions(+), 1 deletion(-)
```

## `git diff --name-status`

```text
M	web/src/app/inicio/inicio.css
M	web/src/app/inicio/page.tsx
M	web/src/assets/inicio/sidebar-plantas.png
```

## Untracked / staged / stash

- Untracked no ignorados: **`quality-reports/mercado-cero-intervencion/`** (los 8 informes de esta intervención). No hay otros untracked.
- Staged: **0**.
- Stash: **0**.
- `git diff --check`: `web/src/app/inicio/page.tsx:263: new blank line at EOF.`

## Runtime actual

- Servidor local: `http://localhost:3100` (build de este worktree).
- `/api/health` → `{"ok":true,"buildSha":"b8f127d85985fd519a0010128a1f42bf5346e24e"}`.
- `http://127.0.0.1:3000` pertenece a otro worktree (`mercado-cero-final-closure`); **no usarlo** como evidencia de esta rama.
- `http://localhost:3000` sirve el dev server de esta rama; no es build de producción.

## Evidencia de harness

`harness/evidence/latest.json` existe, pero está atado a:

```text
ok=true
mode=full
gitAtStart.sha=9206ea10a517e16d992b91fc52d14e23c0170be9
gitAtStart.branch=p0/final-closure
```

No corresponde a `b8f127d` ni al árbol actual. **No es evidencia válida de este HEAD.**

## Archivos nuevos en el commit de rescate

- `web/src/app/inicio/page.tsx`
- `web/src/app/inicio/inicio.css`
- `web/src/assets/inicio/*` (4 PNG + README + manifest)
- `AUDITORIA-RUTA-INICIO.md`
- `design-references/mercado-cero-rescate/*` (11 archivos)

## Conclusión de estado

**WIP válido para iterar, NO-GO para cierre/merge.** Hay tres archivos sucios, una regresión de codificación en `manifest.ts`, falta cobertura de `/inicio` y la evidencia de harness no está atada a este HEAD.
