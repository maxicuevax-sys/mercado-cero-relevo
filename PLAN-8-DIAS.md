# Plan de 8 días — Mercado Cero

Hoy: **viernes 30 de octubre de 2026**.
Hackathon: **sábado 7 de noviembre de 2026**, 10:00–16:00, UTOPÍA Elena Poniatowska, Coyoacán.
Entrega: **domingo 8 de noviembre, 1:00 p.m.**

> **Estado real al 30 oct:** scaffold, flujo demo end-to-end, endurecimiento del webhook (27/27 aserciones), conciliación contra pey, dashboard hoy/semana/mes, corte de caja y “Mi camino” implementados. La dirección visual **“Mercado de papel”** está aplicada; la auditoría móvil 360 px emulada pasó 25/25; el runbook, el video de respaldo y el QR imprimible están listos. Ver **`GOAL.md`** para el contrato y las fases. Este plan es la intención original; algunas decisiones cambiaron: el prototipo usa SQLite y Next.js 16, no Postgres ni Next 15.
>
> **Rediseño de interfaz (F2+ parked):** ver **`GOAL-HIG.md`** — “Mostrador claro”, Apple HIG adaptado a web. **F0/F1 completados; base en `HIG-AUDIT.md`.** No se toca la UI antes del 7 nov sin decisión explícita.

---

## Regla de prioridad

Cada día tiene **una sola cosa que debe quedar funcionando**. Si algo se atora, se recorta, no se pospone.

Orden de importancia:

1. **Pago real verificado** (pey + webhook firmado).
2. **Venta por voz** que produzca una orden correcta.
3. **Anti-fraude** (comprobante falso y webhook duplicado).
4. **Efectivo + fiado + corte**.
5. **Pulido visual y pitch**.

---

## Día 0 — Viernes 30 de octubre (hoy)

**Objetivo: tener un pago de $0.01 confirmado por webhook.**

- [ ] Crear cuenta en el portal de pey y generar API key.
- [ ] Registrar la cuenta bancaria receptora (si es personal, usar la de un miembro del equipo con autorización). La activación CoDi puede tardar hasta 5 días hábiles: **hacerlo hoy**.
- [ ] Configurar el webhook en el portal y guardar el secreto.
- [ ] Confirmar en el portal qué métodos habilita el link de pago con la cuenta configurada (`bankAccountId` vs. `stripeAccountId`); si las tarjetas requieren Stripe, iniciar el onboarding hoy.
- [ ] Probar `POST /payment-link/create` con $0.01 y `successUrl`/`backUrl` HTTPS.
- [ ] Confirmar que llega `payment_link.status_updated` con `status: paid`.
- [ ] Verificar la firma con un SDK de Standard Webhooks.
- [ ] Scaffold de Next.js + TypeScript + Tailwind + Postgres (Neon/Supabase) + Drizzle.
- [ ] Deploy inicial en Vercel con endpoint `/api/webhooks/pey` público.
- [ ] Variables de entorno: `PEY_API_KEY`, `PEY_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `DATABASE_URL`.

**Entregable:** un pago real de $0.01 aparece en la base de datos como `paid` después de un webhook verificado.

---

## Día 1 — Sábado 31 de octubre

**Objetivo: venta por voz → orden → link de pago.**

- [ ] Pantalla de caja mobile-first: botón grande de push-to-talk, lista de pedido, total.
- [ ] Grabar audio con MediaRecorder; enviar a API route; transcribir con OpenAI.
- [ ] Parser de venta con JSON schema: items, cantidades, precios, cliente, fiado, efectivo.
- [ ] Si falta un precio o hay ambigüedad, preguntar antes de confirmar.
- [ ] Confirmación visual del pedido; botón «Generar cobro».
- [ ] Crear payment link en pey con `clientReferenceId = orderId` y metadata.
- [ ] Mostrar QR (generado en cliente desde la URL) y botón «Compartir por WhatsApp».
- [ ] Estado `payment_pending` con temporizador y opción de cancelar.

**Entregable:** decir «dos quesadillas de 35 y un agua de 20» produce una orden de $90 y un link de pago real.

---

## Día 2 — Domingo 1 de noviembre

**Objetivo: confirmación verificada + anti-duplicados.**

- [ ] Endpoint de webhook: verificar firma, parsear payload, responder 2xx rápido.
- [ ] Tabla `payment_events` con idempotency key; ignorar eventos repetidos.
- [ ] Validar `clientReferenceId`, monto y moneda contra la orden.
- [ ] Transición `payment_pending → paid` solo desde el webhook.
- [ ] Alerta visual + sonido + TTS: «Pago recibido. Noventa pesos. Pedido 18».
- [ ] Manejar `pending`, `processing`, `paid`, expiración y error.
- [ ] Pruebas: webhook duplicado, monto alterado, referencia desconocida, firma inválida.

**Entregable:** un pago real cambia la orden a `paid` una sola vez; los ataques de la lista no la cambian.

---

## Día 3 — Lunes 2 de noviembre

**Objetivo: efectivo, pago mixto y fiado.**

- [ ] Registrar abono en efectivo; estado `partially_paid` si falta saldo.
- [ ] Cobrar el resto con link/QR; conciliar ambos pagos en la misma orden.
- [ ] Libreta de fiado: cliente, saldo, abonos, fecha acordada, recordatorio.
- [ ] Voz: «Juan me pagó cincuenta del fiado y se llevó veinte más».
- [ ] Corte de caja por voz: CoDi verificado, tarjeta, efectivo, fiado pendiente.
- [ ] Historial de pedidos y detalle de cada pago.

**Entregable:** una venta mixta y un abono de fiado se reflejan correctamente en el corte.

---

## Día 4 — Martes 3 de noviembre

**Objetivo: validación con comerciantes reales.**

- [ ] Entrevistar 6 negocios en Coyoacán: 2 puestos de comida, 2 abarrotes, 2 tianguis/mercado.
- [ ] Observar una venta real en cada uno (sin datos personales).
- [ ] Medir: pasos y tiempo para confirmar una transferencia; objeciones; vocabulario real.
- [ ] Probar el prototipo con al menos 3 comerciantes; no explicar, observar.
- [ ] Ajustar las 3 fricciones más repetidas; no agregar funciones nuevas.
- [ ] Grabar clips de reacción (con permiso) para el pitch.

**Entregable:** lista priorizada de fricciones observadas y cambios aplicados.

---

## Día 5 — Miércoles 4 de noviembre

**Objetivo: anti-fraude y robustez.**

- [ ] Flujo «Verificar comprobante»: buscar `transactionId` en pey; si no existe, rechazar.
- [ ] Prueba con captura falsa, comprobante de otro comercio y monto alterado.
- [ ] Manejo de errores de red, expiración de QR y webhook tardío.
- [ ] Rate limiting y logs de auditoría.
- [ ] Revisión de accesibilidad: botones grandes, contraste, modo silencioso.
- [ ] Pulido visual: una sola pantalla clara, no un dashboard.

**Entregable:** la demo de fraude funciona en vivo y no hay estados inconsistentes.

---

## Día 6 — Jueves 5 de noviembre

**Objetivo: deploy estable y video de respaldo.**

- [ ] Deploy final en Vercel + Postgres; migraciones y seeds.
- [ ] Probar el flujo completo desde un teléfono real en red móvil.
- [ ] Grabar video de 3 minutos con pago real (sin cortes falsos).
- [ ] Escribir el guion palabra por palabra y los slides (máximo 5).
- [ ] Preparar QR impreso de respaldo y una orden ya pagada en la base.
- [ ] Carta de intención / lista de 10 comerciantes para el piloto.

**Entregable:** URL pública estable + video + pitch escrito.

---

## Día 7 — Viernes 6 de noviembre

**Objetivo: ensayar hasta que salga sin pensar.**

- [ ] Ensayar la demo 5 veces cronometradas; recortar a 3:00.
- [ ] Probar en un lugar con ruido y con internet inestable.
- [ ] Cargar baterías, llevar hotspot, cables, adaptador, QR impreso.
- [ ] Preparar respuestas a las 6 objeciones del README.
- [ ] Dormir. No tocar código nuevo después de las 9 p.m.

**Entregable:** demo ensayada, backup listo, equipo descansado.

---

## Día 8 — Sábado 7 de noviembre

**Objetivo: ejecutar y disfrutar.**

- [ ] Llegar temprano, conectar laptop y probar internet.
- [ ] Integración final solo si es crítica; congelar a las 2 p.m.
- [ ] Demo en vivo: pago real, comprobante falso, corte por voz.
- [ ] Recoger feedback de mentores y jurados.
- [ ] Subir el proyecto al portal antes de la fecha límite (domingo 8, 1 p.m.).

---

## Tabla de recorte

Si el tiempo se acorta, este es el orden en que se sacrifica:

| Se queda | Se recorta |
|----------|------------|
| Pago real + webhook firmado | Cuenta familiar multi-usuario |
| Venta por voz | Catálogo con foto |
| Anti-fraude | WhatsApp API |
| Efectivo + fiado | Inventario |
| Corte por voz | Modo offline completo |
| Demo de 3 minutos | Panel de administración |

**Nunca se recorta:** verificación de firma, idempotencia, validación de monto y la regla de no marcar pagado sin webhook.

---

## Checklist de riesgo

- [ ] Cuenta pey/CoDi registrada hoy (5 días hábiles).
- [ ] API key y webhook secret guardados fuera del repo.
- [ ] Webhook accesible por HTTPS; probado desde el portal.
- [ ] Pago de $0.01 real confirmado.
- [ ] OpenAI API key con crédito y límites.
- [ ] STT probado con español mexicano y ruido de fondo.
- [ ] Video de respaldo descargado en el teléfono, no solo en la nube.
- [ ] QR impreso y link de pago de respaldo.
- [ ] Batería, hotspot y cables.
- [ ] Alguien del equipo sabe reiniciar el servidor y la base.
