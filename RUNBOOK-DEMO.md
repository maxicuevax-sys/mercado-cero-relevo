# Runbook de demo — Mercado Cero

> **Estado:** demo mode con datos sembrados. El riel real de CoDi sigue bloqueado por BBVA; la demo se presenta como **modo demo** y el respaldo está grabado.
> **Video:** `demo/mercado-cero-demo.mp4` (36 s, 1280×800, 0.8 MB).
> **Auditoría móvil:** `demo/mobile-audit.json` — 25/25 checks, 360 px emulado con Playwright, 10.2 s de flujo en producción (10–17 s en dev), 0 errores de consola. Falta la prueba en un teléfono físico.
> **Checkout público:** `demo/checkout-audit.json` — 15/15 checks a 360 px, pago demo y pantalla de éxito; Lighthouse 100/100/100.
> **Túnel HTTPS:** `demo/tunnel-smoke.json` — 8/8 checks por Cloudflare: reset, checkout, pago demo y estado pagado.

---

## 1 · Antes de salir (10 minutos)

- [ ] `mercado-cero/web/.env.local` tiene `DEMO_MODE=true`.
- [ ] El servidor corre: `npm run build && npm start` (recomendado; es el modo validado) o `npm run dev`.
- [ ] Abre `http://localhost:3000` y confirma:
  - [ ] La pantalla inicial es **Caja** y muestra **¿Qué vendiste?**.
  - [ ] El pill **DEMO** está visible en la cabecera.
  - [ ] El botón **Verificar** está visible en Caja.
- [ ] Pulsa el icono de **reiniciar demo** en el header. Debe quedar:
  - [ ] Ventas de hoy: **$190.00**
  - [ ] Cobrado: **$70.00**
  - [ ] Por cobrar: **$120.00**
  - [ ] Fiado: **$50.00**
  - [ ] Corte: base **$500.00**, debería haber **$570.00**
  - [ ] Meta: **$300.00 de $1,800.00**
- [ ] Batería, cargador, hotspot y cable.
- [ ] Video de respaldo **descargado en el teléfono**, no solo en la nube.
- [ ] QR impreso de respaldo (`demo/qr-demo.png` o el HTML imprimible).
- [ ] Micrófono probado; si falla, la demo funciona con texto.
- [ ] Túnel HTTPS vivo si vas a mostrar un link/QR real:
  `cloudflared tunnel --url http://localhost:3000`
  y `APP_URL` apuntando a esa URL. Si cambia el túnel, reinicia el servidor y regenera el QR.
- [ ] Prueba el túnel antes de salir: `python scripts/tunnel-smoke.py` (8/8).
- [ ] Corre el preflight completo: `node scripts/preflight.mjs` (18/18).
- [ ] No corras el contrato de webhook justo antes de la demo; reinicia los datos después si lo haces.

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
- Si hay pago real, pide al juez pagar **$0.01** y espera el webhook. Si no, usa **Simular CoDi** y di claramente: **“Esto es modo demo.”**

> “La caja no dice pagado hasta que llega el webhook firmado de pey. Una captura de pantalla no cuenta.”

Cuando aparezca el sello **DEMO** o **PAGADO**, señálalo.

### 1:20–1:50 · Anti-fraude

- Cierra el overlay con **Listo para entregar**.
- Pulsa **Verificar** en la cabecera de Caja.
- Pulsa **Probar con un comprobante falso**.

> “Si el ID no existe en la cuenta de pey, no es un pago verificable. La app no se impresiona con capturas.”

### 1:50–2:20 · Fiado y voz

- Vuelve a **Caja** y pulsa la frase **“Juan me pagó 50 del fiado”**.
- Muestra que el saldo de Juan baja de $50 a $0.
- Pulsa **“¿Cuánto vendí hoy?”**.

> “El fiado no es una venta nueva: es un abono. La voz sirve para cobrar, consultar y cerrar, pero el dinero verificado y el fiado viven separados.”

### 2:20–2:40 · Mi negocio y corte

- Abre **Corte**; la tarjeta **Así va la caja** está en la misma pantalla.
- Cambia **Hoy / Semana / Mes**.
- Muestra el total, el ticket promedio, efectivo vs digital y la gráfica.
- En **Corte**, arriba está **Corte de caja**.
- Pulsa **Actualizar corte**: el abono de Juan sumó **$50 en efectivo**, así que “Debería haber” pasa de $570 a **$620**.
- Pulsa **Contar por billetes y monedas** y escribe: **5** de $100, **2** de $50 y **1** de $20. Muestra el sello **CUADRA**.

> “La comerciante ve cuánto vendió, cuánto cobró de verdad, cuánto le deben y cuánto debería haber en la caja. Todo sale del mismo registro.”

### 2:40–3:00 · Mi camino y cierre

- Abre **Meta**.
- Escribe **25** y pulsa **Apartar**.
- Muestra la meta en **$325.00** y el avance.

> “De vender para el día a día, a construir el negocio que quieres tener. El mercado no necesita más apps. Necesita certeza.”

---

## 3 · Qué no decir

- **No** digas que el pago simulado es real. Di “modo demo” y señala el sello.
- **No** prometas tarjeta/Apple Pay/Google Pay si el checkout real solo muestra CoDi. Di: “CoDi funciona hoy; tarjeta y wallets dependen de la cuenta Stripe.”
- **No** digas que la app ve el saldo o los movimientos de la cuenta de Ana. Solo ve los cobros generados por el negocio.
- **No** digas que los apartados son una cuenta de ahorro o dinero custodiado. Son **declarados**.
- **No** inventes un pago real de $0.01 si no ocurrió. Puedes decir: “El contrato del webhook está en 27/27; el riel bancario es lo que estamos esperando.”

---

## 4 · Si algo falla

| Falla | Qué hacer |
|---|---|
| Micrófono | Usa las frases de ejemplo o **Escribir venta**. La demo sigue. |
| Link/QR no genera | Cambia a QR CoDi; si también falla, muestra el estado pendiente y el video. |
| BBVA/CoDi rechaza | **Simular CoDi** y dilo: “modo demo; el webhook real es el que manda en producción.” |
| Internet | La app local sigue; el teléfono no. Usa el video de respaldo. |
| Servidor caído | `npm run dev`, espera “Ready”, recarga. Si no, video. |
| Datos sucios | Icono de reiniciar demo; si no, reinicia el servidor. |
| Túnel caído | Relanza cloudflared, actualiza `APP_URL`, reinicia, regenera QR. |
| Proyector no muestra | Abre el video en el teléfono; el guion va en este documento. |

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
- [ ] Si hubo pago real, guardar el `transactionId` y la captura del portal (sin datos sensibles).
- [ ] No cambiar código después de las 21:00 del 6 de noviembre.

---

## 7 · Archivos de respaldo

- `demo/mercado-cero-demo.mp4` — video silencioso con subtítulos (36 s).
- `demo/mercado-cero-demo.webm` — original.
- `demo/mobile-360-fold.png` — primer viewport a 360 px.
- `demo/mobile-360-full.png` — página completa a 360 px.
- `demo/mobile-360-cobro.png`, `-link.png`, `-pagado.png`, `-corte.png`, `-meta.png`.
- `demo/mobile-audit.json` — 25/25 checks, 10.2 s en producción, 0 errores.
- `demo/checkout-audit.json` — 15/15 checks del checkout público a 360 px.
- `demo/tunnel-smoke.json` — 8/8 checks a través del túnel HTTPS.
- `scripts/checkout-audit.py` — valida checkout, pago demo y pantalla de éxito.
- `scripts/tunnel-smoke.py` — valida el camino público por Cloudflare.
- `scripts/verify-env.mjs` — revisa demo/real sin imprimir secretos.
- `scripts/preflight.mjs` — 18/18: servidor, túnel, datos, QR y respaldos.
- `scripts/make-demo-qr.mjs` + `scripts/print-qr-pdf.py` — regeneran el QR.
- `demo/feedback.md` — registro de pruebas con personas.
- `demo/qr-demo.png` — QR del túnel actual (regenerar si cambia la URL).
- `scripts/mobile-audit.py`, `scripts/record-demo.py` — reproducibles.

---

## 8 · Cambiar a modo real (cuando lleguen las credenciales)

1. `node scripts/verify-env.mjs` — debe decir **REAL** y no tener fallas.
2. Usa una `DATABASE_PATH` limpia o reinicia la demo; no mezcles historia simulada con un pago real.
3. En `.env.local`: `DEMO_MODE=false`, `PEY_API_KEY` y `PEY_WEBHOOK_SECRET` vigentes, `APP_URL` con el túnel HTTPS vivo.
4. Reinicia el servidor y recarga: el pill **DEMO** debe desaparecer y la app debe hablar de modo real.
5. Cobra **$0.01** y paga desde el banco. Espera el webhook firmado; verifica el estado **pagado** y la conciliación.
6. Si el webhook no llega en 2 minutos, la orden queda **pendiente**. No la marques pagada ni muestres una captura como prueba.
7. Si el riel falla, vuelve a `DEMO_MODE=true`, reinicia y usa el sello **DEMO** y el video de respaldo.

> El contrato del webhook está en 27/27; lo que falta es el riel bancario, no la app.
