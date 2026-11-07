# Seguridad — Mercado Cero

Este documento cubre la capa HTTP del prototipo. **No sustituye autenticación
de usuarios**: el MVP sigue siendo una demo de una sola comerciante sin sesión.
Para cualquier despliegue fuera de la demo, Cloudflare Access es obligatorio.

## 1. Qué protege cada capa

| Capa | Qué hace | Dónde vive |
|---|---|---|
| CSRF / mismo origen | Rechaza `POST`/`PATCH`/`DELETE` con `Origin` ajeno o `Sec-Fetch-Site: cross-site`. El allowlist usa `Host`/`APP_URL`; `X-Forwarded-Host` solo se acepta con `TRUST_PROXY=1`. Excepción: `/api/webhooks/pey`. | `web/src/proxy.ts` + `web/src/lib/http-security.ts` |
| Token de reset | Si `DEMO_RESET_TOKEN` existe, `/api/demo/reset` exige `x-demo-token` o `Authorization: Bearer`. El rate limit se aplica **antes** de comparar el token. | `proxy.ts` y la ruta de reset |
| Modo demo | El reset solo funciona con `DEMO_MODE` activo. | `isDemoMode()` |
| Rate limit | Ventana fija por IP + ruta, Map acotado a 2048 buckets. | `checkRateLimit()` |
| Límites de cuerpo | Next bufferiza hasta `proxyClientMaxBodySize` antes del Proxy; con `Content-Length` mayor, el 413 se emite al llenar el buffer (64 KB), no "antes de leer" ni esperando el cuerpo completo. | `proxy.ts`, `next.config.ts` + helpers de lectura |
| Reset seguro | Bloquea si hay pagos `pey` + `paid`; backup `VACUUM INTO`; conserva pagos/auditoría reales con `FORCE_DEMO_RESET=1`. Conserva solo los 5 backups más recientes. | `web/src/lib/db.ts` |
| Auditoría de webhook | Los rechazos sin firma guardan hash SHA-256 + payload truncado a 4 KB y se limitan a los últimos 500 (configurable con `PAYMENT_EVENT_REJECTED_CAP`). La auditoría con firma válida no se poda. | `api/webhooks/pey` |
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

`proxyClientMaxBodySize` está en **64 KB**, el máximo real de las rutas
normales (`/api/webhooks/pey` y `/api/orders`). No es una defensa "antes de
leer": Next 16 clona/bufferiza el cuerpo para que el Proxy y la ruta puedan
leerlo. Con `Content-Length` mayor al tope, el Proxy responde 413 en cuanto el
buffer llega a 64 KB, sin esperar a que el cliente termine de subir; el 413
acota memoria, no necesariamente ancho de banda. Sin `Content-Length`, el
cuerpo puede quedar truncado a 64 KB y la ruta responde 400/413. El test
`413 al llenar el buffer del Proxy` documenta ese comportamiento real.
`/api/voice/transcribe` es la única ruta que supera 64 KB: está fuera del
matcher del Proxy y su ruta lee el multipart por stream con el tope de 12 MB,
aplicando el mismo CSRF y rate limit.

El rate limit del token de reset es de **5 intentos por IP y minuto** antes de
comparar el token, tanto en el Proxy como en la ruta.

La IP se toma, en este orden, de `CF-Connecting-IP`, `True-Client-IP`,
`X-Real-IP` y `X-Forwarded-For`. **Solo confía en estas cabeceras si el origen
está detrás de Cloudflare** y no acepta tráfico directo. Fuera de ese proxy,
cualquiera puede falsificarlas.

`X-Forwarded-Host` y `X-Forwarded-Proto` solo se usan para el allowlist CSRF si
`TRUST_PROXY=1`. Sin esa variable se ignora `X-Forwarded-Host` y se usa `Host`
(o `APP_URL`); así un cliente no puede declarar un origen ajeno y pasar el
chequeo. Activa `TRUST_PROXY=1` únicamente cuando el único camino al origen sea
un proxy propio que sobrescriba esas cabeceras.

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
- Se conservan los **5 backups más recientes**; los anteriores se borran para
  que el reset repetido no llene el disco. El backup recién creado nunca se
  poda. Los backups contienen datos de la demo: protégelos igual que la base
  (ver §4).
- Si existe al menos un pago `provider = 'pey' AND status = 'paid'`, responde
  **409** y no toca nada. `FORCE_DEMO_RESET=1` permite continuar, pero aun así
  **conserva** los pedidos/pagos reales, los eventos `pey` y toda la auditoría.
- Los webhooks rechazados por firma inválida se guardan con hash SHA-256 y un
  payload truncado a 4 KB; solo se retienen los últimos 500 rechazos no
  firmados (`PAYMENT_EVENT_REJECTED_CAP`). Los eventos con firma válida —y por
  tanto auditables— no entran en esa poda.

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

El directorio de backups también contiene datos sensibles. Restríngelo al
mismo usuario (la carpeta puede no existir hasta el primer reset):

```powershell
$user = "$env:USERDOMAIN\$env:USERNAME"
icacls web\data\backups /inheritance:r /grant:r "${user}:(OI)(CI)(F)"
# Si DATABASE_BACKUP_DIR apunta a otra ruta, aplica la misma ACL allí.
```

No se imprimen valores. El script no falla si el archivo no existe (por ejemplo,
en un worktree recién creado cuyo `.env.local` está ignorado por git).

La retención de backups (§2) limita el crecimiento, pero no sustituye la ACL:
un backup viejo sigue teniendo datos de la demo hasta que se poda.

**Rotación:** si `.env.local` se compartió por error (zip, captura, chat, commit
accidental, otro usuario del equipo), rota `PEY_API_KEY`, `PEY_WEBHOOK_SECRET` y
`OPENAI_API_KEY` en sus portales, actualiza el archivo y reinicia el servidor.
Al rotar el secreto del webhook, los eventos viejos fallarán la firma: es el
comportamiento esperado. No cambies claves solo por esta auditoría; la ACL es
una mitigación, no una rotación. Los backups no se rotan con las claves: si un
backup contiene secretos de configuración, trátalo como el `.env.local`.

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
headers, CSRF (incluido `X-Forwarded-Host` hostil), token de reset con rate
limit, cuerpos `null`, límites, crecimiento acotado de `payment_events`,
retención de backups, errores de dominio y headers. No usa `:3000`, no toca
`mercado-cero` ni la base de la demo.

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
- Los backups locales no se suben a object storage ni se cifran en reposo; se
  conservan solo los 5 más recientes y deben protegerse con ACL.
- `TRUST_PROXY=1` solo debe activarse si el origen acepta exclusivamente
  tráfico de un proxy propio que sobrescriba `X-Forwarded-*`.
- El 413 por `Content-Length` se emite al llenar el buffer de 64 KB del Proxy;
  no espera a que el cliente termine y no es una defensa "antes de leer". El
  tope limita memoria por petición, no el ancho de banda ni el tiempo de subida.
  `/api/voice/transcribe` no pasa por ese buffer: su ruta aplica el tope de
  12 MB por stream.
- La poda de `payment_events` solo elimina rechazos con `signature_valid = 0`;
  los eventos firmados se conservan aunque el payload sea inválido.
