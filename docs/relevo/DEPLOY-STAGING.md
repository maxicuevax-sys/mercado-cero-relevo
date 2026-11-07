# DEPLOY STAGING — VPS

## Estado
- **Staging v1:** `/opt/mercado-cero-staging`, loopback **4601**, build `568e881`, health OK.
- **Staging v2:** `/opt/mercado-cero-staging-v2`, loopback **4602**, build `568e881`, health OK.
- Host: `mail.leadly.com.mx` / Tailscale `100.96.218.88:2222` (`zicua-vps`).
- Node 22.22.3; `TZ=America/Mexico_City`.
- DB demo copiada; no DB de producción.
- **18/18 rutas + Detalle**: 0 errores por túnel.
- Producción (CyberPanel/LiteSpeed/mail/DNS) intacta.

## Acceso
```powershell
# v2
ssh -N -L 4602:127.0.0.1:4602 zicua-vps
# abrir http://127.0.0.1:4602

# v1
ssh -N -L 4601:127.0.0.1:4601 zicua-vps
# abrir http://127.0.0.1:4601
```
Tailscale Serve `:8443 → 4601` quedó configurado, pero la ACL de tailnet no permite 8443 desde esta PC; 443 sí. No se abrió firewall ni se tocó el 443 de producción.

## Operación
```powershell
# health
ssh zicua-vps 'curl -fsS http://127.0.0.1:4602/api/health'

# restart v2
ssh zicua-vps 'kill $(cat /opt/mercado-cero-staging-v2/server.pid); cd /opt/mercado-cero-staging-v2/web && nohup env TZ=America/Mexico_City node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 4602 > /opt/mercado-cero-staging-v2/server.log 2>&1 & echo $! > /opt/mercado-cero-staging-v2/server.pid'

# logs
ssh zicua-vps 'tail -50 /opt/mercado-cero-staging-v2/server.log'
```

## Rollback
- v2 falla → usar v1 4601 o 4580 local.
- Matar solo PID de v2; nunca tocar LiteSpeed/CyberPanel.
- No borrar `/opt/mercado-cero-staging` (v1) mientras v2 no esté estable.

## Límites
- No hay URL pública; acceso por túnel/tailnet autorizado.
- No se validó Let's Encrypt/dominio; no se cambió DNS.
- El build del staging es `568e881` (snapshot 53b1f61); no incluye futuros fixes de la flota.
