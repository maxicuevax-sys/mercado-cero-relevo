# OPERACIÓN VOLUMEN — CIERRE

## Flota
- 3 goals OpenCode con **9 subagentes**:
  - Fixes visuales (`Lane A/B/C`) → candidato `071a2d1`.
  - Deploy VPS → v2/v3/v4.
  - Contenido/demo → 19 archivos.
- Dispatcher local con backlog y estado.

## Candidato integrado
- Worktree `integration-candidate-fixes`, branch `revision/assembly-fixes`.
- Merge `53b1f61` + `071a2d1` → HEAD **`48fe63f`**.
- Servido en **4582**.
- **18/18 rutas + Detalle, 0 pageerrors.**
- Gates:
  - security **58/58**
  - demo-pay **66/66**
  - B1 **73/73**
  - build OK
- **No merge a main**, sin push de producto.

## Deploy VPS
- **v4 integrado:** `/opt/mercado-cero-staging-v4`, **4604**, build `2776b10`.
- **18/18 rutas + Detalle, 0 errores** por túnel.
- v1 4601, v2 4602, v3 4603 intactos.
- Producción mail/CyberPanel/LiteSpeed/DNS/443 intacta.
- Acceso:
```powershell
ssh -N -L 4604:127.0.0.1:4604 zicua-vps
# http://127.0.0.1:4604
```

## Contenido
- `reports/RELEVO/OC-CONTENT/`:
  - `guion-demo.md`
  - `one-pager.md`
  - `captures/` 16 PNG 390.

## Límites
- No hay auditoría visual completa de las 24 refs contra el candidato integrado.
- `paid` real no verificado.
- Tailscale Serve 8443 sigue limitado por ACL; acceso por túnel.
- No se tocó 4580/4497.
