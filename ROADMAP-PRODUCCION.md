# Roadmap a Producción — Mercado Cero

Este documento define la ruta crítica de ingeniería para llevar **Mercado Cero** desde su estado de prototipo funcional (Next.js 16 + `node:sqlite`, single-merchant, endurecido tras **Operación B.1**) hacia un sistema en **producción real**, preservando intacta la **Regla de Oro**: *ningún pedido transiciona a `paid` sin el webhook firmado de pey*.

---

## Estrategia en Dos Escalones

1. **Piloto en vivo (1 a 10 comerciantes en Coyoacán):**
   - Requiere **Fase 0 + Fase 1**.
   - Se opera con una instancia dedicada + SQLite WAL + backups en almacenamiento externo y **Cloudflare Access** (con bypass para `/pay/*`, `/api/checkout/*`, `/api/webhooks/pey` y `/api/health`) más `OPERATOR_ACCESS_TOKEN` en el Proxy de Next 16.
2. **Producción abierta / Multi-comercio (SaaS / Serverless):**
   - Requiere **Fase 2 + Fase 3 + Fase 4**.
   - Migración a PostgreSQL, tabla `merchants` y sesiones con `merchant_id`, rate limiting distribuido y cierre completo de Oleada C/D.

---

## Fase 0 · Desbloqueo de Rieles Reales y Certificación `verify:full` (Corto Plazo / Día 1–3)

1. **Conexión y prueba real con pey ($0.01 MXN):**
   - Configurar `PEY_API_KEY` y `PEY_WEBHOOK_SECRET` reales en `web/.env.local` (usando `web/.env.example` como plantilla y aplicando ACL con `web/scripts/harden-env-acl.ps1`).
   - Verificar en el portal de pey los métodos habilitados (`bankAccountId` para CoDi y/o `stripeAccountId` para tarjetas, Apple Pay y Google Pay).
   - Ejecutar un cobro real de `$0.01 MXN`, confirmar transición única `payment_pending → paid` vía `/api/webhooks/pey` y validar con `node scripts/reconcile.mjs`.
2. **Dominio HTTPS permanente (eliminar Quick Tunnel efímero):**
   - Reemplazar `*.trycloudflare.com` por un **Named Tunnel de Cloudflare** o dominio productivo fijo en `APP_URL`.
   - Validar el entorno con `npm run verify:prod-env` (`node scripts/verify-env.mjs --prod`).
3. **Voz e IA en vivo:**
   - Configurar `OPENAI_API_KEY` con tope mensual de facturación para habilitar `/api/voice/transcribe` y `/api/voice/parse`.
4. **Sello de Evidencia 23/23 (`verify:full`):**
   - Compilar con `npm run build` y correr `npm run verify:full` + `npm run verify:evidence` sobre árbol limpio.

---

## Fase 1 · Autenticación, Perímetro Público/Privado y Apagado de Demo (Semana 1–2)

1. **Separación estricta de perímetro (`web/src/proxy.ts` y `web/src/lib/http-security.ts`):**
   - **Perímetro Público (comprador y riel bancario):**
     - `/pay/[id]` y `/api/checkout/[id]` (el comprador consulta y paga su orden desde su celular sin sesión de comerciante).
     - `/api/webhooks/pey` (autenticado con firma HMAC SHA-256 Standard Webhooks).
     - `/api/health` (identidad del build y estado `demoMode`, sin datos del negocio).
   - **Perímetro Privado (comerciante):**
     - Todas las vistas de caja (`/`, `/inicio`, `/caja`, `/ventas`, `/fiados`, `/corte`, `/metas`, `/pendientes`, `/ayuda`, `/ajustes`) y las APIs operativas (`/api/orders`, `/api/cash`, `/api/credits`, `/api/goals`, `/api/tasks`, `/api/voice/*`, `/api/tts`, `/api/reconcile`, `/api/verify`, `/api/dashboard`, `/api/analytics`).
   - Protegido en el borde por **Cloudflare Access** y en la aplicación por `OPERATOR_ACCESS_TOKEN`.
2. **Clausura de endpoints de Demo en Producción:**
   - Con `DEMO_MODE=false`, el Proxy bloquea `/api/demo/*` (`/api/demo/pay`, `/api/demo/reset`) con `403 demo_disabled` y `db.ts` omite cualquier seed de datos demo.
3. **Roles de Cuenta Familiar:**
   - Separar permisos de `operadora` (vender, cobrar, verificar, corte) y `titular` (configuración de cuenta receptora CLABE y ajustes sensibles).

---

## Fase 2 · Datos, Multi-Tenancy e Infraestructura Escalable (Semana 2–4)

1. **Tabla `merchants` y desacoplamiento de `MERCHANT` fijo:**
   - Reemplazar la constante `MERCHANT` en `web/src/lib/config.ts` por la tabla `merchants` (`id`, `name`, `owner_name`, `receiver_name`, `receiver_clabe_mask`, `pey_account_id`, `timezone`, `created_at`).
   - Propagar `merchant_id` desde la sesión autenticada en todas las consultas y mutaciones.
2. **Evolución de Persistencia:**
   - **Piloto (1–10 comercios):** SQLite WAL + replicación continua a S3/Cloudflare R2 con Litestream.
   - **Escala multi-comercio:** Migración de `web/src/lib/db.ts` a **PostgreSQL** con transacciones y bloqueos fila a fila (`SELECT ... FOR UPDATE`) en webhook y abonos.
3. **Rate Limiting Distribuido:**
   - Mover `checkRateLimit()` de memoria de proceso a Redis (Upstash) o reglas de Cloudflare WAF.

---

## Fase 3 · Cierre de Deuda de Producto y UI — Oleadas C y D (Semana 3–5)

1. **R-01 (Retiro de pantallas legacy):** Consolidar `/inicio`, `/caja` y `/ventas` vNext como única experiencia y retirar la Caja Clásica legacy.
2. **R-02 (Rendimiento en `/ventas`):** Resolver el N+1 de créditos mediante un read model con `JOIN`, paginación (20/página) y búsqueda.
3. **R-03 (Rutas 404 y `/pay/[id]`):** Añadir `web/src/app/not-found.tsx` en español y devolver HTTP 404 real con `notFound()` en `/pay/[id]` inexistente.
4. **R-04 (Unificación de Ayuda):** Conectar `?ayuda=1` en `/caja` y `/ventas` con `/ayuda`.
5. **R-05 (Contrato de ítems v2):** Preservar `productId`/`sku` en `SaleItemInputV2`.
6. **R-07 (Oleada D — Exportación y Folios):** Impresión/descarga de folio de corte de caja y exportación CSV/PDF.

---

## Fase 4 · Observabilidad, Resiliencia y Operación Continua (Semana 5–6)

1. **Conciliación programada y alertas:** Ejecución automática de conciliación contra `GET /transaction/{id}` de pey antes del cierre diario y alertas ante respuestas `401`/`409`/`500` en `/api/webhooks/pey`.
2. **Backups cifrados off-site:** Retención de 30–90 días en Object Storage externo con pruebas periódicas de restauración.
3. **Certificación en campo:** Pruebas en iOS/Safari, Android gama media con red móvil real, lectores de pantalla (TalkBack/VoiceOver) y piloto presencial con comerciantes.

