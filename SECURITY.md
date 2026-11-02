# Seguridad — Mercado Cero

Este documento cubre la capa HTTP del prototipo. **No sustituye autenticación
de usuarios**: el MVP sigue siendo una demo de una sola comerciante sin sesión.
Para cualquier despliegue fuera de la demo, Cloudflare Access es obligatorio.

## 1. Qué protege cada capa

| Capa | Qué hace | Dónde vive |
|---|---|---|
| CSRF / mismo origen | Rechaza `POST`/`PATCH`/`DELETE` con `Origin` ajeno o `Sec-Fetch-Site: cross-site`. Excepción: `/api/webhooks/pey`. | `web/src/proxy.ts` + `web/src/lib/http-security.ts` |
| Token de reset | Si `DEMO_RESET_TOKEN` existe, `/api/demo/reset` exige `x-demo-token` o `Authorization: Bearer`. | `proxy.ts` y la ruta de reset |
| Modo demo | El reset solo funciona con `DEMO_MODE` activo. | `isDemoMode()` |
| Rate limit | Ventana fija por IP + ruta, Map acotado a 2048 buckets. | `checkRateLimit()` |
| Límites de cuerpo | Se rechaza por `Content-Length` antes de leer y por stream si el cliente miente. | `proxy.ts` + helpers de lectura |
| Reset seguro | Bloquea si hay pagos `pey` + `paid`; backup `VACUUM INTO`; conserva pagos/auditoría reales con `FORCE_DEMO_RESET=1`. | `web/src/lib/db.ts` |
| Headers | CSP, `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS en producción. | `web/next.config.ts` |
| Errores | Respuestas genéricas; detalle solo en el log del servidor. | Rutas + `internalErrorResponse()` |

### Límites y rate limits

| Ruta | Body | Rate limit |
|---|---:|---:|
| `/api/webhooks/pey` | 64 KB | 120/min |
| `/api/voice/parse` | 8 KB | 20/min |
| `/api/voice/transcribe` | 12 MB (archivo) | 6/min |
| `/api/orders` (POST) | 64 KB | 60/min |
| `/api/demo/reset` | 1 KB | 5/min |
| `/api/verify` | — | 60/min |
| `/api/tts` | 4 KB | 40/min |
| `/api/orders/[id]/pay` | 8 KB | 30/min |
| `/api/demo/pay` | 8 KB | 30/min |
| `/api/credits/[id]/pay` | 8 KB | 60/min |
| `/api/cash/close`, `/api/cash/preview` | 16 KB | 30/60 por min |
| `/api/goals`, `/api/tasks` | 8–16 KB | 30–60/min |

`proxyClientMaxBodySize` está en **13 MB** para que el audio de 12 MB no se
trunque al pasar por el Proxy de Next 16. El límite real se valida en la ruta.

La IP se toma, en este orden, de `CF-Connecting-IP`, `True-Client-IP`,
`X-Real-IP` y `X-Forwarded-For`. **Solo confía en estas cabeceras si el origen
está detrás de Cloudflare** y no acepta tráfico directo. Fuera de ese proxy,
cualquiera puede falsificarlas.

El rate limit es en memoria y por proceso. Si se escala a varias instancias,
moverlo a Cloudflare WAF/Rate Limiting o a un almacén compartido.

## 2. Reset de demo

- `POST /api/demo/reset` exige modo demo y mismo origen.
- Si `DEMO_RESET_TOKEN` está definido, también exige el token. La UI actual no
  envía ese header; con token configurado el reset se hace por operación:
  ```bash
  curl -X POST https://tu-dominio/api/demo/reset \
    -H "x-demo-token: $DEMO_RESET_TOKEN" \
    -H "Origin: https://tu-dominio"
  ```
- Antes de borrar se crea `data/backups/mercado-cero-<timestamp>.db` con
  `VACUUM INTO` (o `DATABASE_BACKUP_DIR` si está definido). Si el backup falla,
  el reset no continúa.
- Si existe al menos un pago `provider = 'pey' AND status = 'paid'`, responde
  **409** y no toca nada. `FORCE_DEMO_RESET=1` permite continuar, pero aun así
  **conserva** los pedidos/pagos reales, los eventos `pey` y toda la auditoría.
- Los backups contienen datos de la demo; protégelos igual que la base.

## 3. Cloudflare Access (despliegue)

1. Publica la app por **Cloudflare Tunnel**; no abras el puerto de Next al
   público. El origen debe aceptar solo tráfico del túnel.
2. En Zero Trust → Access → Applications, protege el dominio completo con una
   política de identidad (correo, IdP, OTP) o service token para operadores.
3. Crea una **bypass policy** únicamente para `https://tu-dominio/api/webhooks/pey`
   (pey no puede autenticarse con Access). La firma Standard Webhooks sigue
   siendo obligatoria dentro de la ruta.
4. Mantén `CF-Connecting-IP` como fuente de IP; Cloudflare la sobrescribe.
5. Revisa los logs de Access para intentos denegados y no compartas el dominio
   del túnel fuera del equipo durante el hackathon.

## 4. Secretos y ACL de `.env.local`

El archivo debe vivir solo en el checkout que ejecuta el servidor. En Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File web/scripts/harden-env-acl.ps1
```

Equivale a:

```text
icacls web\.env.local /inheritance:r /grant:r "USUARIO:(F)"
```

No se imprimen valores. El script no falla si el archivo no existe (por ejemplo,
en un worktree recién creado cuyo `.env.local` está ignorado por git).

**Rotación:** si `.env.local` se compartió por error (zip, captura, chat, commit
accidental, otro usuario del equipo), rota `PEY_API_KEY`, `PEY_WEBHOOK_SECRET` y
`OPENAI_API_KEY` en sus portales, actualiza el archivo y reinicia el servidor.
Al rotar el secreto del webhook, los eventos viejos fallarán la firma: es el
comportamiento esperado. No cambies claves solo por esta auditoría; la ACL es
una mitigación, no una rotación.

## 5. Dependencias y CI

- `npm audit --omit=dev` debe quedar en **0 vulnerabilidades**.
- `npm audit` completo reporta **16 moderate de desarrollo** (cadena de ESLint).
  No se corrigen con `npm audit fix --force` porque rompería versiones fijadas
  de Next/React/ESLint.
- CI (`.github/workflows/harness.yml`) usa `permissions: contents: read` y corre
  `npm audit --omit=dev` además de `verify:static`.

## 6. Prueba de seguridad

```bash
cd web
npm run build
npm run test:security
```

Arranca un servidor aislado en **127.0.0.1:3191** con base temporal, prueba
headers, CSRF, token, límites, rate limit, backup y protección de pagos reales.
No usa `:3000`, no toca `mercado-cero` ni la base de la demo.

## 7. Límites conocidos

- **No hay autenticación de usuaria/sesión.** CSRF no es autenticación. Para
  producción real: Cloudflare Access + sesión firmada + autorización por rol.
- La UI de reset no envía `DEMO_RESET_TOKEN`; con token configurado se usa curl
  u operación asistida.
- `verify:full` y `webhook-contract.mjs` crean pagos `pey` firmados de prueba.
  Después de correrlos, el reset responderá 409 hasta usar
  `FORCE_DEMO_RESET=1` (que conserva esos pagos y su auditoría). Esto es
  deliberado: un pago firmado por pey no se borra por accidente.
- El rate limit no es distribuido.
- La CSP usa `'unsafe-inline'` en scripts porque el App Router inyecta bootstrap
  inline; una CSP con nonce requiere integración específica de Next.
- Los backups locales no se suben a object storage ni se cifran en reposo.
