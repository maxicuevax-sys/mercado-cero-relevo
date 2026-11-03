# Runbook de demo — Mercado Cero

> **Estado:** demo mode con datos sembrados. El riel real de CoDi sigue bloqueado por BBVA; la demo se presenta como **modo demo**. No hubo pago real.
> **Video:** `demo/mercado-cero-demo.mp4` es **histórico**: 39.8 s, 1,704,744 B, UI vieja y muestra $570. No es respaldo de la UI actual; se regrabará tras el rediseño. No borrar.
> **Túnel vivo (2 nov 2026):** `https://involve-picking-wellness-retreat.trycloudflare.com` — sirve la preview `2a1f166`, **no** el build final; quick tunnel efímero. El túnel `timing-brought-lamp-aberdeen...` de este documento y del QR **no resuelve**. Si cambia, regenerar `APP_URL`, QR y PDF.
> **P0/P1:** P0-1, P0-2, P1-1, P1-3 y P1-5 corregidos en `ac9e5a6`/`fabe7cc`; siguen abiertos P1-2 (auth) y P1-4 (404 HTTP 200). **Full 23/23 y `latest.json` del HEAD siguen pendientes.** Detalle: `HANDOFF-CIERRE.md`.
> **Declaración honesta:** Estamos en modo demo: los pagos se simulan con `demo_paid`. No hubo pago real de $0.01; BBVA/CoDi sigue bloqueado. Solo el webhook firmado de pey marca `paid`. Las pruebas con comerciantes y lectores de pantalla están pendientes.
> **Verdad:** los pagos demo usan `demo_paid`; `/api/verify` solo marca `pey`. Comprobación: `node scripts/verify-truth.mjs`.
> **Auditoría móvil:** última corrida conocida (2 nov 2026) — 25/25 checks, 360 px emulado con Playwright, ≈9 s de flujo en producción (10–17 s en dev), 0 errores de consola. Artefacto ignorado, no en el árbol. Falta la prueba en un teléfono físico.
> **Checkout público:** última corrida conocida (2 nov 2026) — 19/19 checks a 360 px, pago demo y pantalla de éxito; Lighthouse 100/100/100. Artefacto ignorado.
> **Túnel HTTPS:** última corrida conocida (2 nov 2026) — 8/8 checks por Cloudflare: reset, checkout, pago demo y estado pagado. Repetir contra la URL vigente.

---

## 1 · Antes de salir (10 minutos)

- [ ] `mercado-cero/web/.env.local` tiene `DEMO_MODE=true` y `APP_URL=https://<túnel-vivo>` (el preflight lee `APP_URL` de ese archivo, no de `$env:APP_URL`).
- [ ] El servidor corre: `npm run build && next start -H 127.0.0.1` (recomendado; es el modo validado) o `npm run dev`.
- [ ] Abre `http://localhost:3000` y confirma:
  - [ ] La pantalla inicial es **Caja** y muestra **¿Qué vendiste?**.
  - [ ] El pill **DEMO** está visible en la cabecera.
  - [ ] El botón **Verificar** está visible en Caja.
- [ ] Pulsa el icono de **reiniciar demo** en el header. Debe quedar:
  - [ ] Ventas de hoy: **$190.00**
  - [ ] Cobrado: **$70.00**
  - [ ] Por cobrar: **$120.00**
  - [ ] Fiado: **$50.00**
  - [ ] Corte: base **$500.00** y esperado **$500.00** (el efectivo demo no cuenta como real)
  - [ ] Meta: **$300.00 de $1,800.00**
- [ ] Batería, cargador, hotspot y cable.
- [ ] Video **histórico** descargado en el teléfono (solo último recurso; muestra la UI vieja y $570; no es respaldo actual).
- [ ] QR impreso de respaldo (`demo/qr-demo.png` o el HTML imprimible).
- [ ] Micrófono probado; si falla, la demo funciona con texto.
- [ ] Túnel HTTPS vivo si vas a mostrar un link/QR (demo). URL vigente al **2 nov 2026**:
  `https://involve-picking-wellness-retreat.trycloudflare.com` (preview `2a1f166`, no final)
  Es un **quick tunnel efímero**: si cambia, actualiza `APP_URL`, reinicia el servidor y regenera QR/PDF (`node scripts/make-demo-qr.mjs` + `python scripts/print-qr-pdf.py`).
- [ ] Prueba el túnel antes de salir: `python scripts/tunnel-smoke.py` (última corrida conocida 8/8, 2 nov 2026; repetir contra la URL del servidor final, no contra `2a1f166`).
- [ ] Corre el preflight completo **después del reset**: `node scripts/preflight.mjs` (la última corrida conocida fue 18/18, pero hoy no es ejecutable: faltan `APP_URL` y `mobile-audit.json`, `checkout-audit.json`, `tunnel-smoke.json`).
- [ ] No corras el contrato de webhook justo antes de la demo; reinicia los datos después si lo haces.

### Limpieza operativa antes de arrancar (solo documentada; no la ejecutes desde un carril de docs)

Conservar:
- el servidor de demo en `:3000` cuando exista;
- la preview `:3230` y su túnel si vas a mostrar el link/QR actual (**sirve `2a1f166`; no es la final**).

No confundir: el `cloudflared` **PID 13932** apunta a `:3000` (caído), no a la preview. Detener solo servidores de gates/carriles que no estés usando (`:3125`, `:3195`, `:3211`, `:3220`) y no matar `:3230` si se va a mostrar.

Arranque limpio:
1. `cd web`
2. `npm run build`
3. `next start -H 127.0.0.1` (o `npm start -- -H 127.0.0.1`) en `:3000`.
4. Reiniciar demo (`POST /api/demo/reset` o el botón **Reiniciar demo**).
5. `node scripts/preflight.mjs` **después** del reset, con `APP_URL` en `.env.local` y los artefactos mobile/checkout/túnel generados.

---

## 2 · Guion de 3 minutos

> Narración palabra por palabra y versión de 60 s: **`GUION-3-MIN.md`**.

### 0:00–0:20 · El problema

> “Lupita vende quesadillas en Coyoacán. Casi todo es efectivo, pero cuando le transfieren, el dinero cae en la cuenta de su hija Ana. Para saber si ya le pagaron, Lupita tiene que llamarle a Ana, esperar una captura y confiar. Si la captura es falsa, pierde la venta.”

Señala la línea **“Cuenta receptora: Ana (hija) •••• 4812”** y el sello **Mercado Cero**.

### 0:20–0:50 · La venta por voz

- Caja es la pantalla inicial; **¿Qué vendiste?** está arriba.
- Pulsa la frase de ejemplo **“Dos quesadillas de 35 y un agua de 20”**.
- Si hay micrófono, mantén presionado y dilo tú.

> “La caja arma el pedido: dos quesadillas, un agua, noventa pesos. No hay menús, no hay catálogo.”

Señala el total **$90.00** y pulsa **Confirmar venta**.

### 0:50–1:20 · Un solo cobro, cualquier forma de pagar

> “Se genera un solo link/QR. El cliente puede pagar con CoDi; si la cuenta tiene Stripe, también tarjeta, Apple Pay o Google Pay.”

- Pulsa **Link de pago**.
- Muestra el QR y el link.
- En esta demo **no hay pago real**: usa **Simular CoDi** y di claramente: **“Esto es modo demo.”** El riel BBVA/CoDi sigue bloqueado; no pidas al juez pagar $0.01.

> “La caja no dice pagado hasta que llega el webhook firmado de pey. Una captura de pantalla no cuenta.”

Cuando aparezca el sello **DEMO** o **PAGADO**, señálalo.

### 1:20–1:50 · Anti-fraude

- Cierra el overlay con **Listo para entregar**.
- Pulsa **Verificar** en la cabecera de Caja.
- Pulsa **Probar con un comprobante falso**.

> “Si el ID no existe en la cuenta de pey, no es un pago verificable. La app no se impresiona con capturas.”

### 1:50–2:20 · Fiado y voz

- Vuelve a **Caja** y pulsa la frase **“Juan me pagó 50 del fiado”**.
- La app abre la hoja con el saldo vivo y el monto interpretado; **no ejecuta** el abono.
- Elige **Efectivo** en “¿Cómo lo recibiste?” y pulsa **Registrar abono**; el saldo de Juan baja de $50 a $0.
- Pulsa **“¿Cuánto vendí hoy?”**.

> “El fiado no es una venta nueva: es un abono. La voz sirve para cobrar, consultar y cerrar, pero el dinero verificado y el fiado viven separados.”

### 2:20–2:40 · Mi negocio y corte

- Abre **Corte**; la tarjeta **Así va la caja** está en la misma pantalla.
- Cambia **Hoy / Semana / Mes**.
- Muestra el total, el ticket promedio, efectivo vs digital y la gráfica.
- En **Corte**, arriba está **Corte de caja**.
- Pulsa **Actualizar corte**: el abono de Juan sumó **$50 en efectivo**, así que “Debería haber” sube a **$550** (base $500 + $50 en efectivo).
- Pulsa **Contar por billetes y monedas** y escribe: **5** de $100, **1** de $50 y **0** de $20. Total contado: **$550**. Muestra el sello **CUADRA**.
- Pulsa **Guardar corte**, revisa la hoja de confirmación (gastos, retiros, debería haber) y confirma. Queda **Corte #1**; la foto no cambia con ventas o cobros posteriores.

> “La comerciante ve cuánto vendió, cuánto cobró de verdad, cuánto le deben y cuánto debería haber en la caja. Todo sale del mismo registro.”

### 2:40–3:00 · Mi camino y cierre

- Abre **Meta**.
- Escribe **25** y pulsa **Apartar**.
- Muestra la meta en **$325.00** y el avance.

> “De vender para el día a día, a construir el negocio que quieres tener. El mercado no necesita más apps. Necesita certeza.”

---

## Accesibilidad para personas mayores o con vista disminuida

La app está pensada para usarse sin leer letras pequeñas:

- Abre **Ayuda y accesibilidad** (el icono **?**) y ajusta:
  - **Texto:** Normal, Grande o Muy grande.
  - **Contraste:** alto contraste para fondo blanco y texto negro.
  - **Voz:** lenta, normal o rápida.
- **Leer esta pantalla** lee los títulos y estados visibles.
- **Repetir último aviso** repite la última frase de la app.
- En Caja, el botón **Escuchar** da las instrucciones en voz alta.
- El micrófono mide **80 px** y el texto alternativo para escribir siempre está visible.
- Las preferencias se guardan en el dispositivo.

Para una persona mayor, antes de empezar: activa **Texto grande** y **Alto contraste**, y deja la voz en **Lenta** si hace falta.

## 3 · Qué no decir

- **No** digas que el pago simulado es real. Di “modo demo” y señala el sello.
- **No** prometas tarjeta/Apple Pay/Google Pay si el checkout real solo muestra CoDi. Di: “CoDi funciona hoy; tarjeta y wallets dependen de la cuenta Stripe.”
- **No** digas que la app ve el saldo o los movimientos de la cuenta de Ana. Solo ve los cobros generados por el negocio.
- **No** digas que los apartados son una cuenta de ahorro o dinero custodiado. Son **declarados**.
- **No** inventes un pago real de $0.01 si no ocurrió. En esta demo no ocurrió. Puedes decir: “El contrato del webhook está en 40/40 (última corrida conocida); el riel bancario es lo que estamos esperando.”

---

## 4 · Si algo falla

| Falla | Qué hacer |
|---|---|
| Micrófono | Usa las frases de ejemplo o **Escribir venta**. La demo sigue. |
| Link/QR no genera | Cambia a QR CoDi; si también falla, muestra el estado pendiente y, solo como último recurso, el video histórico (UI vieja; no es respaldo actual). |
| BBVA/CoDi rechaza | **Simular CoDi** y dilo: “modo demo; el webhook real es el que manda en producción.” |
| Internet | La app local sigue; el teléfono no. Usa el video histórico solo como último recurso y di que es de la UI anterior. |
| Servidor caído | `npm run dev`, espera “Ready”, recarga. Si no, video histórico con la misma advertencia. |
| Datos sucios | Icono de reiniciar demo; si no, reinicia el servidor. |
| Túnel caído | Relanza cloudflared, actualiza `APP_URL`, reinicia, regenera QR/PDF. |
| Proyector no muestra | Abre el video histórico en el teléfono; el guion va en este documento. |

---

## 5 · Preguntas del jurado (respuestas cortas)

**¿Por qué voz?**
Porque reduce menús para personas con baja alfabetización digital o manos ocupadas. La app también funciona tocando; la voz no es obligatoria.

**¿Dónde entra OpenAI?**
En dos puntos: transcribe el audio y estructura la venta en JSON validado con Zod. Si no hay `OPENAI_API_KEY`, un parser local mantiene la demo funcionando; la confirmación hablada usa `speechSynthesis` del navegador.

**¿Y si el cliente no usa CoDi?**
El mismo link acepta CoDi y, con Stripe, tarjeta/wallets. El efectivo y el fiado son ciudadanos de primera clase, no un “modo alterno”.

**¿La cuenta es de la hija?**
La app muestra solo los cobros del negocio. No accede al saldo ni a los movimientos personales de Ana. Un piloto de cuenta autorizada requiere consentimiento y validación con pey.

**¿Qué pasa si el webhook no llega?**
La orden queda pendiente. No se marca pagada. La conciliación consulta `GET /transaction/{id}` y muestra la diferencia; nunca inventa un pago.

**¿Cómo ganan dinero?**
Comisión por transacción o suscripción. CoDi es el riel gratuito; la tarjeta tiene costo transparente. El hackathon no requiere resolver el pricing, pero el modelo es claro.

**¿Por qué ahora?**
29% perdió una venta por no aceptar el medio pedido; 85% de las compras pequeñas son efectivo; 85% de los comerciantes de abarrotes reporta clientes que piden fiado. La certeza y la administración son el cuello de botella.

---

## 6 · Después de la demo

- [ ] Reiniciar demo.
- [ ] Guardar feedback de jueces/mentores en `demo/feedback.md`.
- [ ] Bajar el servidor y el túnel.
- [ ] Esta demo **no tuvo pago real**; si se llegara a hacer uno, guardar el `transactionId` y la captura del portal (sin datos sensibles).
- [ ] No cambiar código después de las 21:00 del 6 de noviembre.

---

## 7 · Archivos de respaldo

- `demo/mercado-cero-demo.mp4` — **histórico**: 39.8 s, 1,704,744 B, 1280×800, UI vieja, muestra $570. Se regrabará tras el rediseño; no es respaldo actual. No borrar.
- `demo/stageshow/flow-1280.webm` — original del stageshow (no es el MP4 histórico de la demo).
- `demo/stageshow/contact-sheet-1280.png` — 8 beats del flujo real; generado por `film-check.py`, no versionado.
- `demo/stageshow/motion-sheet.png` — revisión de movimiento a 2 fps; generada, no versionada.
- `demo/mobile-360-fold.png` — primer viewport a 360 px; generado por `mobile-audit.py`, no versionado.
- `demo/mobile-360-full.png` — página completa a 360 px; generada, no versionada.
- `demo/mobile-360-cobro.png`, `-link.png`, `-pagado.png`, `-corte.png`, `-meta.png` — capturas generadas, no versionadas.
- `demo/mobile-audit.json` — última corrida conocida: 25/25 checks, ≈9 s en producción, 0 errores. Generado e ignorado.
- `demo/checkout-audit.json` — última corrida conocida: 19/19 checks del checkout público a 360 px. Generado e ignorado.
- `demo/tunnel-smoke.json` — última corrida conocida: 8/8 checks a través del túnel HTTPS. Generado e ignorado.
- `demo/rehearsal.json` — última corrida en master `75179c7`: 3/3 corridas, 19/19 pasos, ~8.1 s, todo en verde. Generado e ignorado.
- `harness/evidence/mobile-320-e2e.json` - última corrida conocida: 42/42 checks HIG a 320/360 px en 3 motores. Generado e ignorado.
- `scripts/checkout-audit.py` — valida checkout, pago demo y pantalla de éxito.
- `scripts/tunnel-smoke.py` — valida el camino público por Cloudflare.
- `scripts/verify-env.mjs` — revisa demo/real sin imprimir secretos.
- `scripts/preflight.mjs` — última corrida conocida: 18/18, pero **hoy falla** sin `APP_URL` en `.env.local` y sin `mobile-audit.json`, `checkout-audit.json` y `tunnel-smoke.json`.
- `scripts/rehearse-demo.py` — última corrida en master `75179c7`: 3/3, 19/19, ~8.1 s.
- `scripts/verify-truth.mjs` — un `transactionId` demo no se verifica.
- `scripts/make-demo-qr.mjs` + `scripts/print-qr-pdf.py` — regeneran el QR y el PDF del túnel vigente.
- `demo/feedback.md` — registro de pruebas con personas (0/6–8 ejecutadas).
- `demo/qr-demo.png` — QR del túnel **muerto** `timing-brought-lamp-aberdeen...`; no imprimir. Regenerar con el túnel del servidor final (`node scripts/make-demo-qr.mjs` + `python scripts/print-qr-pdf.py`).
- `scripts/mobile-audit.py`, `scripts/record-demo.py` — reproducibles.

---

## 8 · Cambiar a modo real (cuando lleguen las credenciales)

1. `node scripts/verify-env.mjs` — debe decir **REAL** y no tener fallas.
2. Usa una `DATABASE_PATH` limpia o reinicia la demo; no mezcles historia simulada con un pago real.
3. En `.env.local`: `DEMO_MODE=false`, `PEY_API_KEY` y `PEY_WEBHOOK_SECRET` vigentes, `APP_URL` con el túnel HTTPS vivo.
4. Reinicia el servidor y recarga: el pill **DEMO** debe desaparecer y la app debe hablar de modo real.
5. Cobra **$0.01** y paga desde el banco. Espera el webhook firmado; verifica el estado **pagado** y la conciliación.
6. Si el webhook no llega en 2 minutos, la orden queda **pendiente**. No la marques pagada ni muestres una captura como prueba.
7. Si el riel falla, vuelve a `DEMO_MODE=true`, reinicia y usa el sello **DEMO** y, solo como último recurso, el video histórico (advirtiendo que es de la UI anterior).

> El contrato del webhook está en 40/40 (última corrida conocida); lo que falta es el riel bancario, no la app. El ensayo del guion ya pasó en master `75179c7`: 3/3, 19/19, ~8.1 s, todo en verde.
