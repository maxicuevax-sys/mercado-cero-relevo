# CLOUD STAGING — VPS + Hermes

## Hallazgo
El VPS **ya existe** y está conectado:
- SSH: `zicua-vps` → `100.96.218.88:2222` (Tailscale `mail`), root con llave.
- Host: `mail.leadly.com.mx`, AlmaLinux, 15.7 GB RAM, 50 GB libres.
- Stack de producción: **CyberPanel/LiteSpeed**, correo, DNS, múltiples webs. **No tocar.**
- **Hermes Agent v0.20.6** ya instalado en `/root/.hermes`; perfiles `orquestador` y `codex-worker` **running**; dashboard 127.0.0.1:9121.
- OpenCode Go está configurado como provider de Hermes (`mimo-v2.6-pro` en default).

## Staging cloud (aislado)
- Ruta: `/opt/mercado-cero-staging`
- Código: snapshot `53b1f61` (Git local del staging `568e8810`)
- Node 22.22.3; build OK
- `.env.local` DEMO; DB demo copiada; **no** se usa DB de producción
- `TZ=America/Mexico_City` (el VPS en UTC causaba hydration #418; corregido)
- Escucha **127.0.0.1:4601**; no público
- 18/18 rutas, 0 pageerrors por túnel
- No se modificó LiteSpeed, CyberPanel, webs, correo ni firewall de producción (se retiró la regla temporal 4601).

### Acceso
```powershell
ssh -N -L 4601:127.0.0.1:4601 zicua-vps
# otra terminal:
http://127.0.0.1:4601
```

### Hermes dashboard
```powershell
ssh -N -L 9121:127.0.0.1:9121 zicua-vps
http://127.0.0.1:9121
```
El gateway de mensajería está **inactive**; los perfiles `orquestador` y `codex-worker` están corriendo. No reiniciar ni cambiar config sin decisión.

## Límite tailnet
Firewalld bloquea puertos tailnet no públicos, incluido 9121; por eso se usa túnel SSH. No se abrió `tailscale0` entero ni se tocó el Serve existente (`mail.tail422afe.ts.net` → 18789). Para Diego: túnel SSH o regla/ACL específica, nunca puerto público.

## Reproducir/operar
```powershell
# estado
ssh zicua-vps 'cd /opt/mercado-cero-staging/web && curl -fsS http://127.0.0.1:4601/api/health'

# reiniciar staging
ssh zicua-vps 'kill $(cat /opt/mercado-cero-staging/server.pid); cd /opt/mercado-cero-staging/web && nohup env TZ=America/Mexico_City node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 4601 > /opt/mercado-cero-staging/server.log 2>&1 & echo $! > /opt/mercado-cero-staging/server.pid'

# logs
ssh zicua-vps 'tail -50 /opt/mercado-cero-staging/server.log'
```

## Próximo
1. Conectar Hermes `orquestador` a health/staging (sin cambiar perfiles de producción).
2. Dar a Diego acceso por túnel SSH o Tailscale Serve acotado.
3. Mantener staging separado; deploy a dominio solo con autorización y backup.
