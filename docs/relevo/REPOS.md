# Repositorios de colaboraciÃ³n

## CÃ³digo
https://github.com/maxicuevax-sys/mercado-cero-relevo

- Privado.
- Candidato inicial: `53b1f61`.
- Issue de onboarding: https://github.com/maxicuevax-sys/mercado-cero-relevo/issues/2
- Docs: `docs/relevo/`.

## Refs / evidencia
https://github.com/maxicuevax-sys/mercado-cero-refs

- Privado.
- **Git LFS**: 35 archivos, 31 refs DEFINITIVE, ~53 MB.
- `MANIFEST.json`, `SCREEN-MATRIX.md`, `UPDATES.md`.

## Reglas
1. Cada ingeniero usa su propio worktree/branch `diego/<tarea>` o `lead/<tarea>`.
2. PR a `main`; no push directo; no merges sin aprobaciÃ³n.
3. No secretos, DB, `.env` reales ni evidencia con PII en el repo.
4. No tocar 4497; entorno local propio 4600.
5. `demo_paid`; nunca `paid` sin webhook firmado.
6. Un writer por worktree.
7. Refs/evidencia en el repo LFS; no duplicar capturas pesadas.

## Pendiente de acceso
- Invitar a Diego como collaborator (falta su usuario GitHub).
- Tailscale/Headscale: ACL lectura 4497 + su propio 4600.
- HumanLayer: staging/self-hosted.
- Branch protection tÃ©cnica no disponible en repo privado sin GitHub Pro; se aplica por proceso/CODEOWNERS.

