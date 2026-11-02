# Mercado Cero

**La caja que habla.** Cobra, confirma y cuadra sin aprender un sistema.

Documento de trabajo para el hackathon **DevDay Exchange Community Hackathon: Mexico City** (sábado 7 de noviembre de 2026, UTOPÍA Elena Poniatowska, Coyoacán).

**Contrato de profundidad:** [`GOAL.md`](./GOAL.md) — qué se construye, qué se prueba y qué cuenta como “ya está”.
**Rediseño de interfaz (F3):** [`GOAL-HIG.md`](./GOAL-HIG.md) — “Mostrador claro”. **F3 implementado, verificado de forma independiente y desplegado en producción.** Contrato: [`HIG-DESIGN.md`](./HIG-DESIGN.md). Auditoría: [`HIG-AUDIT.md`](./HIG-AUDIT.md). Evidencia: [`VERIFICACION-F3-FINAL-5.md`](./VERIFICACION-F3-FINAL-5.md).
**Benchmark hiperlocal:** [`BENCHMARK-HIPERLOCAL.md`](./BENCHMARK-HIPERLOCAL.md) — qué aprender (y qué no copiar) de CoopCycle, Nearby Shops, Local Vendor App y otros.
**Plan de skills:** [`GOAL-SKILLS.md`](./GOAL-SKILLS.md) — qué skills usar (UI/UX anti-slop, planificación, verificación), cuáles omitir y cómo se mide su efecto.

---

## 1. La tesis

Para una comerciante de barrio que vende sobre todo en efectivo y que recibe transferencias en la cuenta de un familiar, **Mercado Cero** es una caja hablada que:

1. convierte una venta dicha en voz alta en un cobro;
2. genera **un solo link/QR** que acepta CoDi, tarjeta, Apple Pay y Google Pay;
3. solo marca un pedido como pagado cuando llega un **webhook firmado de pey**;
4. registra efectivo, pagos mixtos y fiado en la misma libreta;
5. cierra el día por voz.

No es otro punto de venta. No es otro generador de QR. Es la capa de **certeza** entre lo que la comerciante oye y lo que el banco confirma.

La conversación de producto evoluciona hacia un **sistema operativo del comercio de barrio**: además de cobrar, entender ventas, efectivo, fiado y metas. La regla no cambia: **una sola fuente de verdad** y ningún pago confirmado sin webhook. La frase que guía el resto del hackathon es: *“De vender para el día a día, a construir el negocio que quieres tener.”*

### La frase para el jurado

> El 85% de las compras de $500 o menos en México se pagan en efectivo. No vamos a cambiar ese hábito. Vamos a evitar que el otro 15% se pierda, y vamos a hacer que la comerciante sepa —sin depender de su hija— cuándo el dinero ya llegó.

---

## 2. El giro que cambia la estrategia

La conversación anterior se centraba en CoDi. El problema: **solo 4% de la población adulta mexicana había usado CoDi en 2024** (ENIF 2024, CNBV). Un checkout que solo acepta CoDi reproduce el cuello de botella que queremos resolver.

La documentación actual de pey permite:

- **Links de pago** con checkout alojado para **CoDi, tarjetas, Apple Pay y Google Pay**.
- **QR CoDi** directo y notificaciones push.
- **Webhooks firmados** con Standard Webhooks.
- **Pruebas en producción con montos de $0.01 MXN**, sin esperar a que la cuenta CoDi esté activa.
- Registro de cuentas bancarias por CLABE; la activación CoDi puede tardar hasta **5 días hábiles**.

**Decisión:** el MVP usa **links de pago de pey** como método principal (CoDi + tarjeta + wallets) y deja el QR CoDi puro como segundo modo. Así el cliente paga como quiera, la comerciante no necesita terminal, y seguimos usando la infraestructura CoDi/pey del hackathon.

> **Verificar el día 0:** la referencia de pey indica que el link de pago necesita `bankAccountId` o `stripeAccountId` en la configuración de la API key. Confirmar en el portal qué métodos habilita cada configuración y si las tarjetas requieren onboarding de Stripe. Si no se habilitan tarjetas a tiempo, el plan B es QR CoDi + Stripe Payment Link directo para la demo con tarjeta.

Esto también responde a los datos de FINABIEN–CONCANACO 2026:

- **29%** perdió al menos una venta en 30 días por no aceptar el medio solicitado.
- **35%** señaló las comisiones como obstáculo.
- **26.4%** no tenía cuenta bancaria.
- **67%** usaría una herramienta pública de cobro fácil y de bajo costo (intención declarada).

---

## 3. MVP exacto (lo que se demuestra el 7 de noviembre)

### Incluido

| # | Función | Por qué |
|---|---------|---------|
| 1 | **Venta por voz** (push-to-talk, español) | Inclusión y velocidad; no navegar menús |
| 2 | **Link/QR de pey multi-método** | CoDi + tarjeta + wallets; resuelve la adopción |
| 3 | **Confirmación solo por webhook firmado** | La certeza es el producto |
| 4 | **Efectivo + pago mixto** | El 85% de las compras pequeñas son en efectivo |
| 5 | **Libreta de fiado** con abonos parciales | Dolor real y diferenciador local |
| 6 | **Corte de caja con conteo de efectivo** | Cierra el ciclo operativo y detecta diferencias |
| 7 | **Verificación de comprobantes** | Momento emocional de la demo: el comprobante falso no engaña |
| 8 | **Mi negocio: hoy/semana/mes** | Convierte las operaciones en información útil |
| 9 | **Mi camino: una meta con apartado** | De vender el día a día a construir el negocio que quieres |

### Fuera del MVP (roadmap, no demo)

- Cuenta familiar multi-usuario con permisos formales (se muestra como visión; el MVP usa una cuenta receptora autorizada).
- Catálogo con foto, inventario, proveedores.
- WhatsApp Business API (se usa `share` link).
- Modo offline completo (solo borradores; nunca marcar pagado sin conexión).
- Crédito, préstamos, suscripciones.
- Custodia real de ahorro o acceso a movimientos de cuentas familiares.

### La prueba de fuego

El prototipo debe pasar estas cuatro pruebas, no solo verse bonito:

1. **Pago real:** un pago de $0.01–$90 completado con pey y confirmado por webhook.
2. **Autonomía:** una persona sin capacitación genera y consulta un cobro por voz.
3. **Anti-fraude:** un comprobante falso y un webhook duplicado **nunca** aparecen como dinero recibido.
4. **Cuadre:** el corte del día separa CoDi verificado, tarjeta, efectivo declarado y fiado pendiente.

---

## 4. Arquitectura técnica

```
Comerciante (PWA móvil)
  │  push-to-talk
  ▼
Next.js API
  ├── STT (Whisper / gpt-4o-transcribe)
  ├── Parser de venta (LLM con JSON schema + function calling)
  ├── Orquestador de pedido (state machine)
  ├── Analítica y corte de caja
  │     ├── ventas / cobros / pendientes (una sola fuente)
  │     ├── cash_closes (base, gastos, retiros, diferencia)
  │     └── goals + goal_contributions (apartados declarados)
  ├── pey API
  │     ├── POST /payment-link/create   (CoDi + tarjeta + wallets)
  │     └── POST /codi/qr               (modo CoDi puro)
  └── Webhook /api/webhooks/pey
        ├── verificación Standard Webhooks
        ├── idempotencia por event/transaction ID
        ├── validación de monto y referencia
        └── transición a `paid` + alerta hablada
```

### Stack recomendado

- **Next.js 16 + TypeScript + Tailwind** (PWA mobile-first).
- **SQLite (`node:sqlite`)** para el prototipo; Postgres para producción.
- **OpenAI**: transcripción + LLM para estructurar la venta; voz con **Kokoro `em_santa`** para frases fijas y **Piper es-MX** para dinámicas, sin depender de la voz del navegador. Empezar con push-to-talk; el agente de voz en tiempo real es una mejora, no un requisito.
- **pey**: API key, webhook, link de pago y QR CoDi.
- **Vercel** para el deploy y la URL HTTPS del webhook. Tener un plan B local con ngrok y un video grabado.

### Modelo de datos mínimo

- `merchants` (negocio, cuenta receptora autorizada)
- `orders` (estado, total, método, referencia)
- `order_items` (descripción, cantidad, precio)
- `payments` (monto, método, transaction_id, estado)
- `payment_events` (payload, firma, idempotency_key)
- `customers` + `credits` + `credit_payments` (fiado)
- `cash_closes` (base, ventas en efectivo, gastos, retiros, diferencia)
- `goals` + `goal_contributions` (metas y apartados declarados)
- `audit_log` (quién cambió qué)

### Máquina de estados

```
draft → confirmed → payment_pending → partially_paid → paid → fulfilled
                                   ↘ cancelled / expired
fiado: open → partial → settled
```

Regla de oro: **ningún estado `paid` se alcanza por lógica del cliente, ni por una captura de pantalla, ni por un webhook sin firma válida.**

### Seguridad mínima

- Verificar `webhook-signature` con el secreto de Standard Webhooks.
- Idempotencia por `transactionId` / `eventId`; ignorar duplicados.
- Validar monto, moneda y `clientReferenceId` contra la orden.
- No almacenar datos de tarjeta; el checkout es alojado por pey.
- Secretos solo en el servidor; rate limiting en endpoints públicos.
- Registrar cada evento para auditoría y para explicar cualquier discrepancia.
- CSRF de mismo origen, límites de cuerpo, headers y reset con backup:
  ver [`SECURITY.md`](./SECURITY.md). Para producción, Cloudflare Access es la
  capa de autenticación; el webhook queda fuera de Access y se autentica con
  firma.

---

## 5. Demo de 3 minutos

**Personaje:** Lupita, quesadillas en Coyoacán. Vende en efectivo; cuando le transfieren, el dinero cae en la cuenta de su hija.

| Tiempo | Qué pasa | Qué prueba |
|--------|----------|------------|
| 0:00–0:20 | Lupita cuenta su problema: efectivo, cuenta de la hija, comprobantes falsos. | Empatía y problema real |
| 0:20–0:50 | Dice: «Cóbrale dos quesadillas de 35 y un agua de 20». La app muestra el desglose y pide confirmar. | Voz → estructura → control |
| 0:50–1:20 | Se genera **un link/QR**. El juez paga $90 (o $0.01) con tarjeta o CoDi. La app muestra «esperando pago». Llega el webhook y dice: «Pago recibido. Noventa pesos. Pedido 18». | Pago real + certeza |
| 1:20–1:50 | Alguien muestra una captura de transferencia. La app la verifica y responde: «No verificado». | Anti-fraude |
| 1:50–2:20 | «Juan me pagó cincuenta del fiado». La app abre la hoja con saldo vivo, monto y método; al elegir **Efectivo** y confirmar, actualiza el saldo. «¿Cuánto vendí hoy?» → desglose. | Fiado confirmado y corte por voz |
| 2:20–2:40 | Abre **Corte**: efectivo, fiado y pendiente digital. Cuenta $620 y muestra el sello **CUADRA**. | Corte de caja |
| 2:40–3:00 | **Meta**: aparta $25 para la sombrilla y la meta avanza a $325. Visión: cuenta familiar autorizada y piloto con 10 comerciantes. | Progreso y siguiente paso |

**Plan B:** video grabado de la demo completa, QR impreso de respaldo y un pago de $0.01 ya confirmado en la base de datos.

---

## 6. Narrativa de pitch

1. **Problema:** 29% de los comercios perdió una venta por no aceptar el medio pedido; 85% de las compras pequeñas son en efectivo; muchas comerciantes dependen de un familiar para confirmar transferencias.
2. **Insight:** el producto no es el QR ni la voz. Es la **certeza** de que el dinero llegó, sin compartir contraseñas ni revisar otro teléfono.
3. **Solución:** una caja hablada que acepta efectivo, CoDi, tarjeta y wallets, y que solo dice «pagado» cuando pey lo confirma.
4. **Demo:** pago real + comprobante falso rechazado + corte por voz.
5. **Impacto público:** inclusión financiera, reducción de fraude, formalización y autonomía para mujeres comerciantes.
6. **Pedido:** piloto con 10 comerciantes de Coyoacán y una carta de intención con pey.

---

## 7. Riesgos y respuestas adversariales

| Objeción | Respuesta |
|----------|-----------|
| «CoDi casi no se usa.» | Por eso el link acepta tarjeta, Apple Pay y Google Pay. CoDi es el riel gratuito; la tarjeta es el puente de adopción. |
| «¿Por qué voz y no una app normal?» | 26.4% no tiene cuenta bancaria y hay baja alfabetización digital; la voz reduce menús. Incluimos modo silencioso y confirmación en pantalla para no obligar a hablar frente al cliente. |
| «La cuenta es de un familiar; ¿es legal?» | El MVP no accede a la cuenta ni a sus movimientos: solo muestra los pagos generados por nuestro sistema. El titular autoriza la cuenta receptora. La integración bancaria completa queda para una fase con pey. |
| «¿Y si el internet falla?» | Los borradores se guardan localmente; nunca se marca pagado sin verificación. Hay video de respaldo. |
| «¿No es otro POS?» | Un POS cobra; nosotros además verificamos, registramos efectivo/fiado y cerramos el día por voz. El competidor real es la transferencia que ya usan, no otro POS. |
| «¿Cómo ganan dinero?» | Comisión por transacción o suscripción; CoDi gratuito, tarjeta con costo transparente. No es necesario resolverlo para el hackathon, pero hay que decirlo. |

---

## 8. Criterio de éxito

Ganar no es el único resultado, pero el listón es:

- **Pago real** completado y verificado durante la demo.
- **Cero falsos positivos** en las pruebas de comprobante falso y webhook duplicado.
- **Una comerciante** completa el flujo sin ayuda.
- **Un jurado técnico** no encuentra una afirmación engañosa sobre acceso al dinero, cuentas familiares o confirmación.

Si no se puede demostrar con dinero real, se recorta el alcance hasta que se pueda. Una demo pequeña y sólida vale más que una plataforma simulada.

---

## 9. Cómo correr y probar

```bash
cd web
npm install
npm run dev
```

Sin `PEY_API_KEY`, la app arranca en **modo demo** y permite simular pagos desde el checkout. Para forzar la demo aunque exista una API key, pon `DEMO_MODE=true` en `.env.local` y reinicia. El webhook real sigue exigiendo firma; el dinero simulado usa `/api/demo/pay`.

En modo demo, **Reiniciar demo** siembra un historial de 30 días, un cobro pendiente, un corte de ayer y una meta. Todo se marca como demo: no son pagos reales ni dinero verificado por el banco. El reset hace un backup SQLite antes de borrar y se niega si detecta un pago `pey` confirmado (ver [`SECURITY.md`](./SECURITY.md)).

Para probar el contrato del webhook:

```bash
node scripts/webhook-contract.mjs
```

Requiere `PEY_WEBHOOK_SECRET` en `.env.local` y el servidor en `localhost:3000`. El script firma eventos como Standard Webhooks y verifica **9 escenarios / 27 aserciones**: pago válido, replay, firma falsa, monto distinto, orden inexistente, timestamp viejo, evento fuera de orden, JSON inválido y QR CoDi.

Para revisar que los pagos digitales del día cuadren con pey:

```bash
node scripts/reconcile.mjs
```

En modo demo avisa que no hay transacciones reales. Con la API key consulta `GET /transaction/{id}`, compara monto, método y referencia, y reporta diferencias sin corregirlas automáticamente. La misma conciliación está en la tarjeta **“¿Cuadra con pey?”** del corte.

Para el pago real:

1. Crea la API key en el portal de pey ligada a la cuenta CoDi de pruebas.
2. Configura el webhook en `https://<tu-tunel>/api/webhooks/pey`.
3. Copia `.env.example` a `.env.local` y llena `PEY_API_KEY`, `PEY_WEBHOOK_SECRET` y `APP_URL`.
4. Reinicia el servidor. El modo demo se desactiva en cuanto exista `PEY_API_KEY`.

No commitees `.env.local`.

---

## 10. Dirección visual — “Mercado de papel”

La app no es un dashboard genérico de IA. Es un **objeto editorial de mercado**: papel, tinta verde, sello terracota, recibo, libreta y tarjeta de metas.

- **Hero asimétrico** con foto real de tianguis en duotono, sello “Mercado Cero” y el cero como timbre.
- **Caja hablada como recibo**: bloque de tinta verde, micrófono de papel, frases de ejemplo subrayadas.
- **Cobro como ticket** y overlay con sello **PAGADO / DEMO / FIADO**.
- **Mi negocio como libreta**: total editorial, cifras alineadas, barras de tinta, mejor día y hora.
- **Corte de caja como hoja de conteo** con sello **CUADRA / DIFERENCIA**.
- **Mi camino como tarjeta de perforación** con la meta de la sombrilla.
- **Banda editorial de cierre** con la frase: “El mercado no necesita más apps. Necesita certeza.”

Inspiración: `mono-color-skill` (un ink dominante, halftone, papel), `taste-skill` (reglas para app screens, anti-slop) y Asli (fotografía, tipografía editorial, recibo/sello). No se copiaron assets ni layouts de Asli.

**Accesibilidad medida:** Lighthouse **100 accesibilidad · 100 best practices · 100 SEO**.

**Fotos:** `web/CREDITS.md` y `web/public/credits.txt`, con autores, licencias y enlaces a Wikimedia Commons.

---

## 11. Demo y respaldo

- **`RUNBOOK-DEMO.md`** — guion de 3 minutos, qué no decir, fallas y Q&A.
- **`GUION-3-MIN.md`** — narración palabra por palabra, versión de 60 s y checklist de ensayo.
- **`PITCH.md`** — 5 slides, evidencia y notas para el speaker.
- **`TEST-USUARIO.md`** — protocolo para probar con una persona ajena.
- **`demo/mercado-cero-demo.mp4`** — video silencioso con subtítulos (34 s, 1280×800).
- **`demo/mobile-audit.json`** — 25/25 checks a 360 px emulado, flujo de 10.2 s en producción, 0 errores.
- **`demo/checkout-audit.json`** — 15/15 checks del checkout público y la pantalla de éxito a 360 px.
- **`demo/tunnel-smoke.json`** — 8/8 checks del camino público por Cloudflare.
- **`demo/rehearsal.json`** — 3 ensayos, 14/14 pasos, promedio 4.8 s de flujo mecánico.
- **`demo/qr-demo.pdf`** — QR imprimible para abrir la demo; regenerar si cambia el túnel.
- **`web/scripts/mobile-audit.py`**, **`checkout-audit.py`**, **`tunnel-smoke.py`**, **`record-demo.py`**, **`rehearse-demo.py`** — reproducibles.
- **`web/scripts/verify-env.mjs`** — revisa demo/real sin imprimir secretos.
- **`web/scripts/preflight.mjs`** — 18/18: servidor, túnel, datos, QR y respaldos.
