# Reporte — follow-up P2/P3 de seguridad

Rama: `p0/fix-sec-followup` · base `3fe1cc9` · sin merge.

## Cambios

1. **413 / buffer**
   - `proxyClientMaxBodySize` baja de 13 MB a **64 KB**, el máximo real de las
     rutas normales (webhook/orders).
   - `/api/voice/transcribe` sale del matcher del Proxy. Su ruta conserva CSRF,
     rate limit y el tope de 12 MB leyendo el multipart por stream.
   - Se documenta el comportamiento real: Next bufferiza hasta el tope y, con
     `Content-Length` mayor, el Proxy responde 413 al llenarlo; **no** es una
     defensa "antes de leer" ni espera necesariamente a que el cliente termine.
   - Test nuevo con subida lenta de 160 KB que verifica que el 413 llega al
     llenar el buffer, y que transcribe >12 MB devuelve el 413 de su ruta sin
     truncarse a 64 KB.
2. **Webhooks inválidos**
   - `payment_events` gana `payload_hash` (SHA-256).
   - Los rechazos con firma inválida guardan solo un prefijo de 4 KB y se podan
     a los últimos 500 (`PAYMENT_EVENT_REJECTED_CAP`).
   - La auditoría con firma válida no se poda.
3. **Backups de reset**
   - Se conservan los 5 backups más recientes; el recién creado nunca se borra.
4. **`X-Forwarded-Host` / CSRF**
   - `X-Forwarded-Host` y `X-Forwarded-Proto` solo se usan con
     `TRUST_PROXY=1`; sin esa variable el allowlist usa `Host`/`APP_URL`.
5. **Rate limit del token de reset**
   - `enforceRateLimit` corre antes de comparar el token, tanto en el Proxy como
     en la ruta. 30 intentos fallidos → 429.
6. **Cuerpos `null`**
   - `PATCH /api/orders/[id]`, `/api/voice/parse`, `/api/demo/pay` y
     `/api/orders/[id]/pay` devuelven 400 con `invalid_json`, no 500.
7. **Errores de dominio**
   - `recordPayment` lanza `NotFoundError` en vez de `Error` genérico.
   - `demo/pay` conserva `appErrorResponse` antes del 500 genérico.
   - Tests de fulfill/pay/create/credit comprueban mensajes seguros y ausencia
     de texto de SQLite.
8. **ACL / backups**
   - `SECURITY.md` documenta `icacls` para `.env.local` y `data/backups`,
     rotación de claves y retención. No se cambiaron claves.

## Evidencia

| Gate | Resultado |
|---|---|
| `npm run lint` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run test:security` (`:3191`, SQLite temporal) | PASS 48/48 |
| `npm run test:fix-datos` | PASS 58 + 20 + 7 |
| `npm run test:perf-data` | PASS (`ok: true`) |
| `webhook-contract.mjs` (`:3250`, DB temporal) | PASS 34/34 |
| `verify-truth.mjs` (`:3250`) | PASS |
| `p0-venta-e2e.py` (`:3250`) | PASS 65/65 |
| `p0-fiado-e2e.py` (`:3250`) | PASS 51/51 |
| `p0-corte-e2e.py` (`:3250`) | PASS 61/61 + 1 KNOWN |
| `p0-integracion-e2e.py` (`:3250`) | PASS 51/51 |
| `p0-dinero-e2e.py` (`:3251`) | PASS 45/45 + 3 KNOWN |

No se usó `:3000` ni se tocó `mercado-cero`. No se hizo merge.

## KNOWN

- **413:** Next bufferiza hasta 64 KB antes del Proxy. Con `Content-Length`
  mayor, el cliente puede recibir 413 antes de terminar de subir; el tope
  limita memoria, no ancho de banda. Sin `Content-Length`, el cuerpo puede
  truncarse a 64 KB y la ruta responde 400/413. Está documentado en
  `SECURITY.md` y cubierto por test.
- **Poda de `payment_events`:** solo aplica a rechazos con
  `signature_valid = 0`. Un evento firmado con payload inválido se conserva.
- **Backups:** locales, sin cifrar ni subir a object storage; retención 5.
  La ACL de `data/backups` es operativa: este worktree no tiene `.env.local`.
- **Rate limit:** en memoria y por proceso; no distribuido.
- **Reset con token:** la UI no envía `DEMO_RESET_TOKEN`; se usa curl/operación.
- **`p0-corte`:** la migración de esquema viejo se omite con
  `P0_EXTERNAL_SERVER=1` (KNOWN del propio carril).
- **`p0-dinero`:** payload real de pey y reconciliación de red siguen sin
  validarse contra el portal (KNOWN del propio carril).

## Archivos tocados

- `web/next.config.ts`, `web/src/proxy.ts`, `web/src/lib/http-security.ts`
- `web/src/lib/db.ts` (solo `payment_events.payload_hash` y retención de backups)
- `web/src/lib/orders.ts` (solo tipo de error de `recordPayment`)
- Rutas: `demo/reset`, `demo/pay`, `orders/[id]`, `orders/[id]/pay`,
  `voice/parse`, `voice/transcribe`, `webhooks/pey`
- `web/scripts/security-contract.mjs`
- `SECURITY.md`, `p0-fix-seguridad-report.md`
