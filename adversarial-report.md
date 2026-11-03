# Reporte adversarial — Mercado Cero

**Código auditado:** `b7154caaa2185b2cafb44a02a6bf5f8b69bef045`  
**Rama:** `p0/adversarial` (worktree `mercado-cero-adversarial`)  
**Fecha:** 2–3 de noviembre de 2026  
**Entrega:** los hallazgos completos están en `AUDITORIA-ADVERSARIA.md`; el resumen está en `adversarial.json`.

## Hash

- **Base auditada:** `b7154caaa2185b2cafb44a02a6bf5f8b69bef045` (`Merge branch 'master' into p0/final-cognitive`).
- **Build servido en las pruebas:** `b7154caaa2185b2cafb44a02a6bf5f8b69bef045`.
- **Commit de auditoría:** se reporta en la respuesta de entrega (los tres archivos nuevos: `AUDITORIA-ADVERSARIA.md`, `adversarial-report.md`, `adversarial.json`).
- **No se modificó** código, tests ni documentos existentes; no se mergeó nada.

## Método

1. Lectura independiente de `web/src`, rutas API, `web/scripts`, migraciones, tests y docs. No se usaron como evidencia `AUDITORIA-CARGA-COGNITIVA.md`, `AUDITORIA-COGNITIVA.md`, los reportes de carril ni el handoff.
2. `npm ci` en `web/`.
3. `npm run build` → PASS, `BUILD SHA b7154ca...`.
4. `npm run verify:fast` → 3/3 (guard, lint, types).
5. `node scripts/webhook-gate.mjs` con `PEY_WEBHOOK_SECRET` de prueba → **40/40** en `:3193` con DB temporal y `DEMO_MODE=true`.
6. `node scripts/security-contract.mjs` en `:3121` con DB temporal → **48/48**.
7. Servidor aislado `next start` en `127.0.0.1:3317`, DB SQLite temporal, `DEMO_MODE=true`, `APP_URL` aislado. Se usó para:
   - webhook firmado con HMAC real,
   - reset posterior,
   - consultas API sin credenciales,
   - Playwright a 360/320 px y 200 %,
   - axe en normal/alto contraste,
   - reproducción de truncamiento con 51 pendientes y 101 créditos.
8. Mock local de pey en `:3320` + Next aislado en `:3318` para probar `/api/verify` con una transacción PAID sin referencias.
9. El servidor `:3317` se apagó al terminar. No se tocó `:3000`, `:3230`, la app ni la preview.

## Los 10 hallazgos principales

| # | Severidad | Hallazgo | Estado | Evidencia |
|---|---|---|---|---|
| 1 | **P0** | El reset de demo borra un pago firmado de pey registrado en demo y responde `preservedRealPayments: 1` | CONFIRMADO | `db.ts:1943-1957`, `:1848-1855`, `:1973`, `:2005`; probe |
| 2 | **P0** | `/` renderiza el dashboard privado en HTML y lo declara `Cache-Control: public, s-maxage=60` | CONFIRMADO | `page.tsx:12-17`, `next.config.ts:190-195`; HTML con nombres/saldos |
| 3 | **P1** | Webhook firmado en demo produce `paid` (no `demo_paid`), permite `fulfill` y suma a “verificado por pey” | CONFIRMADO | `orders.ts:591`, `:677-683`, `:968-974`; probe |
| 4 | **P1** | No hay auth de sesión; `/api/dashboard`, `/api/orders`, `/api/credits` y `/api/demo/reset` responden sin credenciales | CONFIRMADO (declarado en SECURITY) | `proxy.ts:60-103`, `SECURITY.md:168` |
| 5 | **P1** | `/api/verify` acepta una transacción PAID sin `payableId`/metadata si el monto coincide | CONFIRMADO con mock | `verify/route.ts:229-240`; mock pey |
| 6 | **P1** | Checkout y success inexistentes devuelven HTTP 200, no 404 | CONFIRMADO | `pay/[id]/page.tsx:26`; Playwright |
| 7 | **P1** | Totales de cobros/fiado se calculan sobre 50/100 filas sin paginación visible | CONFIRMADO | `pagination.ts:13-16`, `pending-payments.tsx:99-103`, `caja-app.tsx:3035-3040`; 51/101 probe |
| 8 | **P2** | “Recordatorios” y “Explicaciones” se guardan pero no tienen efecto | CONFIRMADO | `companion-preferences.tsx:41-48`; solo `suggestions` se lee |
| 9 | **P2** | “Antes de cerrar” llama “Esperando confirmación” a pedidos “Sin link” | CONFIRMADO (código) | `closing-checklist.tsx:306-320`, `:592-610` |
| 10 | **P2** | El success de un fiado saldado sigue diciendo “Quedó a fiado” | CONFIRMADO | `success-client.tsx:104-110`; probe |

En `AUDITORIA-ADVERSARIA.md` hay además: P2-4 (“personas” cuenta créditos), P2-5 (`forced-colors`), P2-6 (`/api/demo/pay` multi-proceso, no verificado) y P2-7 (docs/evidencia).

## Los dos hallazgos más graves (detalle)

### 1. Reset destructivo y mentiroso (P0)

Secuencia reproducida:

```text
POST /api/orders (1000)
POST /api/orders/{id}/pay {mode:"link"}
POST /api/webhooks/pey  [firma HMAC válida, status=paid, MXN, 10.00]
  -> 200 {"result":"processed"}
GET /api/orders/{id}
  -> status "paid", paidCents 1000, provider "pey", payments.demo = 1
PATCH /api/orders/{id} {"action":"fulfill"}
  -> 200, status "fulfilled"
POST /api/demo/reset
  -> 200 {"ok":true,"preservedRealPayments":1,"realDataCount":0}
SELECT orders/payments
  -> 0 filas
```

La causa es una asimetría: `recordPayment` marca `demo=1` por `isDemoMode()`, pero `countRealData` solo bloquea filas `demo=0`; `listRealPeyPayments` sí encuentra el pago de pey, pero su resultado no se usa para bloquear. Después, `DELETE FROM payments WHERE demo=1` lo borra.

Esto contradice:
- `README.md:231` (“se niega si detecta un pago pey confirmado”).
- `SECURITY.md:84-86` (“Si existe al menos un pago provider='pey' AND status='paid', responde 409”).

El test `security-contract.mjs:749-751` inserta el pago manualmente con `demo=0`, por eso pasa. El `webhook-contract.mjs` crea pagos firmados en demo y al final llama reset (`:601-605`), sin comprobar que sobrevivan.

### 2. Dashboard privado en HTML público (P0)

`web/src/app/page.tsx:12-17` hace SSR de `getDashboardData()` y lo pasa a `CajaApp`. `web/next.config.ts:190-195` responde:

```text
Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300
```

En la respuesta real de `/` (111 KB) aparecen nombres de clientes, “100 personas”, “$100.00” de fiado, `paymentUrl` y `qrString`. El comentario del propio `next.config.ts` dice que es un shell y que los datos se piden por API; ya no es cierto. No hay `private`, `no-store` ni `Vary: Cookie`. Cualquier caché compartida que honre `s-maxage` puede reutilizar el HTML privado.

## Qué sí pasó (no confundir con “todo mal”)

- Build de producción: PASS.
- `verify:fast`: 3/3.
- Webhook firmado: **40/40**; firma falsa 401, replay no duplica, monto distinto 409, timestamp viejo 401, QR CoDi, reintentos corregidos.
- Seguridad HTTP: **48/48**; CSRF, headers, límites, rate limit, backups, bloqueo de pey manual.
- 320 px: sin overflow horizontal.
- 200 %: sin overflow horizontal; CTA principal queda bajo el pliegue (alcanzable).
- axe en home 360: 0 violaciones serious/critical; `color-contrast` quedó “incomplete”, no “pass”.
- Tokens de color principales: ratios ≥ 4.8:1.
- No hay `.env.local` ni claves versionadas.

## Qué no se pudo probar

- **Pago real** con pey/BBVA/CoDi; no se movió dinero real. El webhook se probó con firma HMAC y el verify con un mock.
- **Payload real de pey** y si siempre incluye `payableId`/`payableType`/metadata (afecta la gravedad final de P1-5).
- **Full 23/23**, `verify:evidence` y `latest.json`: no se ejecutaron. El árbol no tiene `harness/evidence/latest.json`; solo un JSON de preferencias de `e6f3107`, sucio.
- **Gates** `mobile`, `checkout`, `hig`, `motion`, `contrast`, `mobile-320`, `p0-venta`, `p0-fiado`, `p0-corte`, `p0-integracion`, `p0-dinero`, `rehearsal`, `tunnel`, `preflight`, `film`: no corridos.
- **TalkBack/VoiceOver, lector real, teléfono físico, zoom real, estudio con 6–8 comerciantes**: no hechos.
- **Cloudflare Access / caché del CDN / preview**: no inspeccionados. El P0-2 es el header y el HTML; no afirmo que el CDN actual esté cacheando.
- **Carrera multi-proceso de `/api/demo/pay`**: no reproducida; solo riesgo estático.
- **`forced-colors` real**: solo ausencia de CSS y emulación; no inspección visual exhaustiva.

## Límites de esta auditoría

- Es una auditoría de código y de runtime aislado, no una certificación de producción.
- No mide carga cognitiva percibida, tiempos humanos ni comprensión real.
- No valida la exactitud de cifras de negocio externas (ENIF, FINABIEN, etc.).
- No reemplaza una prueba con comerciantes, lector de pantalla ni pago real.
- No se mergeó ni se corrigió nada; los P0/P1 quedan documentados para que otro carril decida.

## Archivos de esta entrega

- `AUDITORIA-ADVERSARIA.md` — auditoría completa con `archivo:línea`, reproducción y pruebas faltantes.
- `adversarial-report.md` — este reporte.
- `adversarial.json` — resumen por severidad y lista de hallazgos.

*Servidor aislado `:3317` apagado. No se tocó la app, `:3000`, `:3230` ni la preview.*
