# Pitch — Mercado Cero

> 5 slides, 3 minutos. El guion en vivo está en `RUNBOOK-DEMO.md`.
> Regla: no afirmar un pago real que no ocurrió. El modo demo se dice en voz alta.

---

## Slide 1 — La frase

**Mercado Cero**
*La caja que habla.*

> “Cobra hablando. El banco confirma.”

Lupita vende quesadillas en Coyoacán. Cobra en efectivo y recibe transferencias en la cuenta de su hija. Para saber si le pagaron, depende de una llamada, una captura y confianza.

**Mercado Cero convierte esa incertidumbre en un estado verificable: pendiente, pagado o fiado.**

---

## Slide 2 — El problema

| Dato | Qué significa |
|---|---|
| **85%** de las compras de $500 o menos se pagan en efectivo (ENIF 2024) | No podemos construir solo para CoDi |
| **29%** perdió una venta en 30 días por no aceptar el medio pedido (FINABIEN–CONCANACO 2026) | El cliente ya quiere pagar distinto |
| **85%** de comerciantes de abarrotes reporta clientes que piden fiado (ANPEC 2024) | La libreta es parte del negocio |
| **4%** de adultos usó CoDi en 2024 (ENIF 2024) | El link debe aceptar más que CoDi |
| **26.4%** no tiene cuenta bancaria (FINABIEN–CONCANACO 2026) | La cuenta receptora puede ser de un familiar |

**El competidor real no es otro POS: es la transferencia que ya usan y el cuaderno donde anotan el fiado.**

---

## Slide 3 — El producto

**Una caja hablada que distingue dinero confirmado, efectivo declarado y deuda pendiente.**

```
Voz / texto
   ↓
Pedido confirmado
   ↓
Un link/QR: CoDi + tarjeta + wallets
   ↓
Webhook firmado de pey
   ↓
Pagado · efectivo · fiado
   ↓
Corte de caja y Mi camino
```

- **Certeza:** nada se marca pagado sin webhook firmado, monto y referencia exactos.
- **Multimétodo:** CoDi, tarjeta/wallets cuando la cuenta lo permite, efectivo y fiado.
- **Administración:** hoy/semana/mes, ticket promedio, corte con conteo y diferencia.
- **Progreso:** “Mi camino” convierte el corte en una meta concreta, sin custodia bancaria.
- **Voz como accesibilidad:** todo se puede hacer tocando; la voz reduce menús.
- **OpenAI:** transcribe el audio y estructura la venta en JSON validado con Zod; sin key, un parser local mantiene la demo funcionando.

---

## Slide 4 — La evidencia

> **Cifras de gates:** última corrida conocida (2 nov 2026); los artefactos están ignorados y no están en el árbol. No son evidencia de la base auditada `3fe1cc9`. El ensayo sí se corrió en master `75179c7`.

| Prueba | Resultado |
|---|---|
| Contrato del webhook | **40/40** aserciones: firma, replay, monto, referencia, QR, JSON inválido |
| Build de producción | **limpio** |
| Lighthouse | **100 accesibilidad · 100 best practices · 100 SEO** |
| 360 px emulado | **25/25** checks; sin scroll horizontal en cada estado; 0 errores de consola |
| Checkout público 360 px | **19/19** checks; pago demo y éxito; Lighthouse 100/100/100 |
| Túnel público | **8/8** por Cloudflare: reset, checkout, pago demo y estado pagado |
| Ensayo del guion | **3/3** corridas; **19/19** pasos; **~8.1 s**; `todo en verde: True` (master `75179c7`) |
| Video | **histórico**: 39.8 s, 1,704,744 B, UI vieja, muestra $570; se regrabará tras el rediseño |
| Pago real | **no hubo**. BBVA/CoDi sigue bloqueado; la demo usa `demo_paid` y el contrato del webhook está probado |

**La honestidad también es parte del producto:** si el riel real falla, la app no inventa un “pagado”.

---

## Slide 5 — Impacto y siguiente paso

**Impacto público:** inclusión financiera, autonomía para mujeres comerciantes, reducción de fraude por comprobantes y una libreta de fiado que no se pierde.

**Modelo:** comisión por transacción o suscripción. CoDi es el riel gratuito; la tarjeta tiene costo transparente.

**Piloto:** 10 comerciantes de Coyoacán durante 4 semanas. Métricas:

- tiempo hasta certeza vs. transferencia actual;
- % de ventas cobradas sin ayuda de un familiar;
- fiado recuperado;
- discrepancias de caja;
- pagos confirmados solo por webhook.

**Ask:** cuenta receptora autorizada, riel CoDi/Stripe operativo y una carta de intención para el piloto.

> “El mercado no necesita más apps. Necesita certeza.”

---

## Notas para el speaker

- Guion narrado con tiempos: **`GUION-3-MIN.md`**.
- No leas las slides; úsalas como apoyo.
- Di “modo demo” cuando uses la simulación. En esta demo **no hubo pago real de $0.01**; no lo presentes como si lo hubiera.
- No prometas tarjeta/Apple Pay si el checkout real solo muestra CoDi.
- No digas que la app ve la cuenta de Ana; solo ve los cobros del negocio.
- No digas que los apartados son una cuenta de ahorro; son declarados.
- Si el jurado pregunta por el banco: “El contrato del webhook está probado 40/40 en la última corrida conocida; el riel bancario es lo que estamos esperando.”
