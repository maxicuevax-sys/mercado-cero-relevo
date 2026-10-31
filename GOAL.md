# GOAL — Mercado Cero

> Reformulado con la skill **be-ambitious** (`DannyMac180/skills/be-ambitious`): *más profundo, no más grande.*
> El rediseño de interfaz vive en **`GOAL-HIG.md`** (“Mostrador claro”). Este archivo conserva los invariantes de dinero y producto.
> El plan día a día vive en **`PLAN-8-DIAS.md`**. El plan de skills (UI/UX anti-slop, planificación y verificación) vive en **`GOAL-SKILLS.md`**. Este archivo es el contrato de profundidad: qué se construye, qué se prueba y qué cuenta como “ya está”.

---

## 1 · La misión (una frase)

Convertir Mercado Cero en una caja que **solo dice “pagado” cuando un pago real de pey lo confirma con un webhook firmado**, y demostrarlo en vivo con **$0.01 MXN** el sábado 7 de noviembre de 2026.

La frase que debe poder decir el jurado al final:

> “El link se puede falsificar. El comprobante se puede falsificar. El webhook firmado, no. Por eso Mercado Cero no marca nada como pagado hasta que el banco lo confirma.”

### 1.b · La perspectiva actual (30 de octubre de 2026)

La conversación nueva amplía el producto sin romper la tesis: Mercado Cero no es solo una caja que cobra, es el **sistema operativo del comercio de barrio**. La frase que lo resume:

> “De vender para el día a día, a construir el negocio que quieres tener.”

La voz sigue siendo la interfaz amable, pero el valor defendible es:

- **certeza:** saber qué dinero llegó y cuál solo se declaró;
- **claridad:** ventas, cobros, efectivo, fiado y pendientes en una sola fuente de verdad;
- **progreso:** convertir el corte y las metas en la siguiente acción concreta.

El competidor real no es otro POS: es la transferencia que la comerciante ya usa y el cuaderno donde anota el fiado. La app tiene que devolverle tiempo y claridad, no agregarle trabajo administrativo.

---

## 2 · Qué haría un profesional top que no estamos pidiendo

1. **Tratar el webhook como un libro mayor, no como una notificación.** La orden no “recibe un aviso”: se concilia contra un evento firmado, con monto, moneda y referencia exactos, y con un registro inmutable de lo que llegó, lo que se aceptó y lo que se rechazó. La UI es la última en enterarse.
2. **Verificar el checkout real antes de prometer métodos.** Una API key ligada solo a CoDi puede no mostrar tarjeta, Apple Pay ni Google Pay. El guion debe decir la verdad de lo que el riel permite hoy; si Stripe no está listo, el pitch se ajusta a **CoDi + efectivo + fiado**, sin inventar.
3. **Ensayar la demo con un desconocido y con un plan B grabado.** El 7 de noviembre no se descubre que el QR no carga, que el webhook no llega o que nadie entiende el flujo. Se ensaya antes, se mide y se graba.

---

## 3 · Leyes del sistema (invariantes que no se negocian)

**1 · Sin firma no hay pago.**
El endpoint `/api/webhooks/pey` verifica Standard Webhooks **siempre**, incluso en modo demo. El dinero simulado usa `/api/demo/pay`; nunca el webhook.

**2 · El monto y la referencia deben cuadrar.**
Un evento solo marca pagado si el monto coincide con el saldo digital pendiente, la moneda es MXN y `clientReferenceId` / `paymentLinkId` / `numRef` corresponden a la misma orden. Una diferencia no se “aproxima”: se rechaza y se registra.

**3 · Una transacción entra una sola vez.**
Idempotencia por `webhook-id` y por `transactionId`. Un replay devuelve 200 sin duplicar el pago ni la transición de estado.

**4 · Todo evento se conserva.**
Payload crudo, firma válida o inválida, resultado y motivo del rechazo. Un evento fallido no se borra: se marca y se puede explicar.

**5 · El modo demo se declara.**
La UI dice “simulado · demo” y nunca presenta un pago simulado como confirmación real de pey.

**6 · El corte cuadra contra pey.**
El resumen del día separa CoDi verificado, tarjeta, efectivo declarado y fiado pendiente, y reconcilia contra las transacciones de pey. Si no cuadra, se muestra la diferencia; no se esconde.

**7 · La prueba es un pago real.**
Una captura de pantalla no es prueba. Un pago de $0.01 confirmado por webhook en un endpoint HTTPS público, con 200 en el portal de pey y una sola transición en SQLite, sí lo es.

**8 · Una sola fuente de verdad.**
Ventas, pagos, efectivo declarado, fiado y apartados se derivan del mismo registro. Un abono de fiado no es una venta nueva; un apartado no es dinero depositado; un pago pendiente no es ingreso.

**9 · La IA no inventa dinero.**
Los cálculos financieros son deterministas; la IA solo explica, guía o propone. Ninguna cifra de negocio se genera por el modelo.

---

## 4 · Métodos y validación (pase/fallo medible)

| Método | Qué demuestra | Pase |
|---|---|---|
| HMAC SHA-256 de Standard Webhooks sobre el **body crudo**, tolerancia de 300 s, comparación en tiempo constante | autenticidad e integridad | firma válida aceptada; firma falsa o timestamp viejo → 401 |
| `scripts/webhook-contract.mjs` con matriz adversarial | que el invariante se cumple en código | 9 escenarios / 27 aserciones; **ningún** evento inválido marca pagado |
| Validación de monto / moneda / referencia contra la orden | que un evento real no se aplica a otra orden | mismatch → 409, orden intacta |
| Idempotencia por `webhook-id` + `transactionId` | que un replay no duplica dinero | segundo POST → 200, una sola fila en `payments` |
| Pago real de $0.01 por CoDi con la cuenta de pruebas de pey | que el riel funciona de verdad | webhook 200 en el portal; orden `paid` exactamente una vez |
| `GET /transaction/{id}` como reconciliación | que el estado local coincide con pey | monto, método y estado coinciden |
| Dashboard hoy/semana/mes | que las cifras salen del mismo registro | ventas, cobros y pendientes coinciden con SQLite |
| Corte de caja | que el efectivo esperado es auditable | base + ventas + abonos − gastos − retiros = esperado; diferencia = contado − esperado |
| Mi camino | que una aportación no se confunde con venta | `saved_cents` sube; no se crea payment ni order |
| Prueba con una persona ajena, sin capacitación | que el producto es usable | completa venta + cobro + verificación en < 3 min |
| Consulta SQLite + `audit_log` | que todo es explicable | cada evento tiene payload, firma y resultado |
| Playwright / navegador real | que la UI no miente | demo y real se distinguen; sin errores de consola |
| Lighthouse + inspector de diseño | que la experiencia sea accesible y no genérica | accesibilidad 100; sin glass; headline de 2 líneas; 3 fotos con crédito |

**Definición de ganar:** (a) el pago real llega y el portal muestra 200; (b) ningún evento inválido marca pagado; (c) una persona ajena completa el flujo sin ayuda; (d) el corte cuadra contra las transacciones de pey.

**Definición de fallar:** cualquier falso positivo, cualquier pago que solo “funcione” en demo, o cualquier afirmación de métodos que el checkout real no ofrezca.

**Correr el contrato:**

```bash
cd web
node scripts/webhook-contract.mjs   # invariantes del webhook
node scripts/reconcile.mjs          # pagos digitales vs pey
```

Requiere el servidor en `localhost:3000` y `PEY_WEBHOOK_SECRET` en `.env.local`. El script no imprime el secreto. El secreto de `.env.local` es de prueba: al conectar pey hay que reemplazarlo por el real. La conciliación en modo demo avisa que no hay transacciones reales.

---

## 5 · Fases y estado (30 de octubre de 2026)

| Fase | Estado |
|---|---|
| **F0 · Scaffold Next.js + SQLite + UI** | ✅ build limpio |
| **F1 · Flujo demo de venta por voz/texto, link, QR, efectivo, fiado y corte** | ✅ probado localmente |
| **F2 · Checkout público del cliente (`/pay/[id]`) con simulación** | ✅ probado |
| **F3 · Endurecer webhook: firma siempre, monto/referencia, auditoría, arnés adversarial** | ✅ **27/27 aserciones en verde** |
| **F4 · Pago real de $0.01 con pey + webhook HTTPS público** | 🔴 pendiente de credenciales rotadas en `.env.local` |
| **F5 · Reconciliación contra `GET /transaction/{id}` y corte que cuadra** | 🟡 implementado y probado en demo; falta la prueba con pey real |
| **F6 · Runbook de demo, video de respaldo, QR impreso** | 🔴 |
| **F7 · Pitch, impacto público y ensayo con un desconocido** | 🟡 |
| **F8 · Dashboard hoy/semana/mes con comparación y gráfica** | ✅ probado con datos reales |
| **F9 · Corte de caja con conteo por denominaciones y diferencia** | ✅ probado; el corte cuadra |
| **F10 · Mi camino: meta, progreso y aportaciones** | ✅ probado; no duplica ventas |
| **F11 · Guía/FAQ contextual y primeros pasos** | ✅ probada |
| **F12 · Dirección visual “Mercado de papel”** | ✅ Lighthouse 100/100/100; build limpio |
| **F13 · Auditoría 360 px, checkout, túnel, ensayo, runbook, video y QR** | 🟡 Caja 25/25 y checkout 15/15; Lighthouse 100; túnel 8/8; video y QR listos; falta teléfono físico y persona ajena |

### 5.b · Prioridades del hackathon (nueva perspectiva)

| Prioridad | Qué entra | Criterio para darlo por terminado |
|---|---|---|
| **P0** | Pago real verificado, dashboard hoy/semana/mes, corte de caja | El pago y las cifras cuadran una sola vez |
| **P1** | Venta mixta, fiado, onboarding/FAQ, una meta de “Mi camino” | Se entiende sin explicación y no duplica ventas |
| **P2** | Resurtido/merma, quincenas/calendario, permisos familiares, analítica avanzada | Roadmap; no se promete en la demo |

**Gap cerrado el 30 oct:** el webhook ya exige firma válida siempre, incluso en modo demo. El dinero simulado sigue usando `/api/demo/pay`, nunca el webhook.

---

## 6 · Bloqueos y acciones del humano

1. **Crear la API key con la cuenta de pruebas CoDi** en el portal de pey:
   - CLABE `012180015826225713`
   - Nombre `Ramón Orraca Lascurain`
   - Se activa el mismo día. No esperar los 5 días de la cuenta propia.
   - Solo probar con **$0.01 MXN**; los pagos a esa cuenta no se reembolsan.
2. **Configurar el webhook** en la API key, apuntando a un endpoint HTTPS público:
   `https://<túnel-o-dominio>/api/webhooks/pey`
3. **Guardar `PEY_API_KEY` y `PEY_WEBHOOK_SECRET` en `web/.env.local`**, nunca en el chat. Si un secreto ya se pegó en un chat, considéralo comprometido y rótalo antes de usarlo.
4. **Decidir Stripe:** si no hay onboarding a tiempo, el pitch real es CoDi + efectivo + fiado. Tarjeta/Apple Pay/Google Pay quedan como visión, no como promesa.
5. **Activar la cuenta CoDi propia** (5 días hábiles) para después del hackathon.

---

## 7 · Fuera de alcance (para no inflar)

- Cuenta familiar multi-usuario con permisos formales (solo visión; nunca acceso a movimientos privados).
- Catálogo con fotos, inventario o proveedores.
- WhatsApp Business API.
- Modo offline completo.
- Crédito, préstamos o suscripciones.
- Custodia de dinero o cuentas de ahorro reales.
- Pronósticos de ventas sin historial suficiente.
- Diez módulos aislados: se construye un recorrido vertical.

La regla es simple: **si no ayuda a probar el invariante del dinero o a cerrar el recorrido abrir → vender → cobrar → cerrar → avanzar, no entra esta semana.**

---

## 8 · El encargo reformulado (be-ambitious)

```text
Quiero que el tramo de pagos de Mercado Cero quede demostrable, no solo maquetado. Trabaja
desde las fuentes primarias: el openapi.json de pey, el payload real de webhook que aparezca
en Webhook Logs, la respuesta de GET /transaction/{id}, la CLABE de pruebas 012180015826225713
(Ramón Orraca Lascurain) y los logs/SQLite de la app. No asumas que el link acepta tarjeta,
Apple Pay o Google Pay: verifica qué métodos ofrece una API key CoDi-only y ajusta el guion
a la verdad.

Cierra el bypass de demo del webhook: la firma se exige siempre. Implementa y prueba
verificación Standard Webhooks sobre el body crudo, idempotencia por webhook-id y
transactionId, validación de monto/moneda/referencia, y reconciliación contra la API. Arma
una matriz adversarial (firma falsa, replay, monto distinto, orden inexistente, evento fuera
de orden, duplicado) y haz que ninguno marque pagado. Conserva el payload crudo y el motivo
de cada rechazo.

Haz un pago real de $0.01 por CoDi con la cuenta de pruebas, confírmalo por webhook en un
endpoint HTTPS público con cloudflared o ngrok, y demuestra que la orden transiciona
exactamente una vez. Cierra con un runbook de demo y un video de respaldo.

Se considera logrado solo si: (a) el pago real llega y el portal muestra 200; (b) ningún
evento inválido marca pagado; (c) una persona ajena completa el flujo sin ayuda; (d) el corte
cuadra contra las transacciones de pey. Si algo no pasa, se recorta el alcance antes que
simular la confirmación.
```
