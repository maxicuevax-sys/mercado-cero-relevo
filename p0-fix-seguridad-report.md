# Reporte — P0 fix de seguridad

## Objetivo

- Endurecer la superficie HTTP del demo sin cambiar el contrato de pagos:
  CSRF/mismo origen, token opcional de reset, límites de cuerpo, rate limit,
  headers, errores genéricos y reset con backup/protección de pagos reales.
- Fuera de alcance: autenticación completa de usuaria/sesión, migración a
  Postgres, merge y despliegue.

## Cambios

- `web/src/proxy.ts` (Next 16 renombró Middleware a Proxy): rechaza mutaciones
  cross-origin (`Origin` / `Sec-Fetch-Site`), exime `/api/webhooks/pey` y exige
  `DEMO_RESET_TOKEN` en `/api/demo/reset` cuando está configurado.
- `web/src/lib/http-security.ts`: lectura de JSON/multipart con tope por stream
  (no solo `Content-Length`), rate limit por IP+ruta con Map acotado a 2048
  buckets, IP desde `CF-Connecting-IP` y fallbacks, token en tiempo constante.
- `web/src/lib/db.ts`: reset bloqueado si hay `payments.provider='pey' AND
  status='paid'`; backup `VACUUM INTO` timestamped antes de borrar; con
  `FORCE_DEMO_RESET=1` conserva pedidos/pagos reales, eventos `pey` y auditoría.
- `web/src/app/api/**`: límites de body y rate limit en webhook, voice/parse,
  transcribe, orders, reset, verify, tts y mutadores; errores internos genéricos
  con log server-side; `reconcile` ya no expone el mensaje crudo de pey.
- `web/src/app/api/tts/route.ts`: caché de archivos podado a 512 WAV por mtime.
- `web/next.config.ts`: `nosniff`, `Referrer-Policy`, `DENY` +
  `frame-ancestors 'none'`, `Permissions-Policy`, CSP conservadora, HSTS en
  producción y `proxyClientMaxBodySize: 13mb`.
- `web/scripts/security-contract.mjs` + `test:security`: 29 checks con servidor
  aislado en `127.0.0.1:3121` y SQLite temporal.
- `web/scripts/harden-env-acl.ps1` + `SECURITY.md`: ACL con `icacls`, rotación,
  Cloudflare Access y límites conocidos.
- CI: `permissions: contents: read`, `persist-credentials: false`,
  `npm audit --omit=dev` y `postinstall: next typegen` para que `tsc` funcione
  en un checkout limpio.

## Evidencia

- `npm run lint`: PASS.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS.
- `npm run verify:fast`: PASS (3/3).
- `npm run verify:static`: PASS (4/4).
- `npm run test:security`: PASS (29/29).
- `npm audit --omit=dev`: 0 vulnerabilidades.
- `npm audit`: 16 moderate, todas de la cadena de desarrollo; no se tocaron.
- `harness/evidence/latest.json`: corrida static `ok: true` (se actualiza al
  correr el gate; el SHA base es `7bb0dc5`).

## Verificación manual

- [x] CSRF cross-origin → 403 en reset y en un mutador (`/api/orders`).
- [x] Reset same-origin sin token configurado → 200; con token configurado,
      sin token → 401 y con token → 200.
- [x] Webhook con `Origin` ajeno sigue llegando a la validación de firma (401,
      no 403).
- [x] Bodies: webhook/orders 70 KB, parse 9 KB y transcribe >12 MB → 413.
- [x] Rate limit: petición 61 a `/api/verify` → 429 + `Retry-After`.
- [x] Headers en HTML: `nosniff`, `Referrer-Policy`, `DENY`, CSP, Permissions.
- [x] Reset con pago `pey` real → 409; con `FORCE_DEMO_RESET=1` → 200 y
      conserva pago + auditoría; backups presentes.
- [x] Error de validación interno no aparece en la respuesta.
- [ ] No se probó la app en `:3000` (restricción del carril). La prueba runtime
      usa exclusivamente `:3121`.
- [ ] ACL de `.env.local`: el worktree no tiene el archivo (está ignorado por
      git). El script queda listo; ver Pendientes.

## Pendientes / KNOWN

- **No hay autenticación de sesión.** CSRF no autentica. Para producción:
  Cloudflare Access + sesión firmada + autorización por rol.
- **Cloudflare Access** debe cubrir el dominio y dejar bypass solo en
  `/api/webhooks/pey`; el origen no debe aceptar tráfico directo.
- **`DEMO_RESET_TOKEN`**: la UI de reset no envía el header; con token
  configurado el reset es por curl/operación. Sin token, la protección es
  mismo-origen + `DEMO_MODE`.
- **ACL pendiente en el checkout operativo**: ejecutar
  `powershell -ExecutionPolicy Bypass -File web/scripts/harden-env-acl.ps1`
  donde exista `web/.env.local`. No se tocó `mercado-cero` por la restricción
  del carril. Rotar `PEY_API_KEY`, `PEY_WEBHOOK_SECRET` y `OPENAI_API_KEY` si
  el archivo se expuso; no se cambiaron claves en esta rama.
- **`verify:full` / webhook-contract**: los pagos `pey` firmados de prueba
  bloquean el reset siguiente (409) hasta usar `FORCE_DEMO_RESET=1`. Es
  deliberado; el force conserva esos pagos y la auditoría.
- **Rate limit en memoria** por proceso; no distribuido.
- **CSP** usa `'unsafe-inline'` en scripts por el bootstrap inline del App
  Router.
- **Backups** quedan en `data/backups` sin cifrar ni subir a object storage.
- **`proxyClientMaxBodySize` 13 MB** es necesario para no truncar el audio de
  12 MB; el límite real se valida en la ruta.
