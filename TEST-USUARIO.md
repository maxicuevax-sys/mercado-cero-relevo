# Prueba con una persona ajena — Mercado Cero

> **Objetivo:** observar si una comerciante que no conoce la app puede completar el recorrido sin ayuda.
> **No es una demo guiada.** No expliques, no señales, no digas “ahí está el botón”. Observa.

---

## 1 · Participantes

Mínimo 3, ideal 6:

- 2 puestos de comida.
- 2 tiendas de abarrotes.
- 2 comerciantes de tianguis o mercado.

No invites a alguien que ya vio la demo ni a alguien que te ayude a “quedar bien”. La prueba sirve si la persona se atora.

## 2 · Montaje

- [ ] App en `http://localhost:3000` o en el túnel, en **modo demo**.
- [ ] Reiniciar demo antes de cada persona.
- [ ] Teléfono a 360 px o el teléfono real de la persona.
- [ ] Una hoja de observación y cronómetro.
- [ ] Sin datos personales ni bancarios reales; todo es demo.

## 3 · Tareas (una a la vez)

Lee la tarea en voz alta y deja que la persona la resuelva. No des pistas.

1. **“Quiero cobrar $90: dos quesadillas de $35 y un agua de $20.”**
   - Puede hablar o escribir.
   - Debe confirmar la venta y generar el link/QR.

2. **“El cliente dice que ya pagó y te muestra esta captura. Verifica si es real.”**
   - Usa el botón **Probar con un comprobante falso**.
   - Debe entender que no está verificado.

3. **“Juan te debía $50 y te acaba de pagar. Regístralo.”**
   - Puede usar la frase de ejemplo o escribir.
   - Debe entender que es un abono, no una venta nueva.

4. **“Al final del día, cuenta el efectivo y cierra caja.”**
   - Debe actualizar el corte, contar y guardar.
   - Si el abono de Juan fue en efectivo, el esperado es $620.

5. **“Quieres apartar $25 para una sombrilla.”**
   - Debe encontrar **Mi camino** y registrar la aportación.

## 4 · Qué medir

| Tarea | Tiempo | ¿Necesitó ayuda? | ¿Dónde se atoró? |
|---|---:|---|---|
| 1. Venta + link | | | |
| 2. Comprobante falso | | | |
| 3. Abono de fiado | | | |
| 4. Corte de caja | | | |
| 5. Apartado | | | |

Además:

- ¿Entendió la diferencia entre **pendiente** y **pagado**?
- ¿Entendió que el fiado **no es dinero recibido**?
- ¿Encontró el **Corte** sin que le dijeras?
- ¿Le incomodó hablar frente a otra persona? ¿Usó el modo texto?
- ¿Qué palabra usó para “link”, “QR”, “fiado”, “corte”?
- ¿Qué botón tocó primero?
- ¿Qué parte le dio desconfianza?

## 5 · Criterio de pase

- [ ] Tarea 1 en **menos de 60 s**, sin ayuda.
- [ ] Las 5 tareas en **menos de 3 min**, sin ayuda.
- [ ] Ningún comprobante falso aparece como pagado.
- [ ] La persona explica con sus palabras: “pendiente no es pagado”.
- [ ] No hay scroll horizontal a 360 px.
- [ ] La persona puede repetir la venta sin que le expliques.

## 6 · Qué hacer si se atora

- Espera **60 s** antes de ayudar.
- Anota el punto exacto y la frase que dijo.
- Si sigue atorada, da la pista mínima y marca “necesitó ayuda”.
- No defiendas la app ni expliques la arquitectura.
- Al final, pregunta: “¿Qué fue lo más confuso?” y “¿Qué te haría usarla mañana?”.

## 7 · Hallazgos heurísticos de la revisión interna

No sustituyen la prueba con una persona real; son hipótesis para observar.

- El CTA **Cobrar ahora** y las frases de ejemplo hacen obvio el primer paso.
- Los estados **pendiente / pagado / fiado** se distinguen por color, sello y copy.
- El **corte** está en una sección aparte; el tab **Corte** ayuda, pero la persona puede no asociarlo con “cerrar caja”.
- El abono de fiado en efectivo cambia el esperado del corte; hay que pulsar **Actualizar corte**. Es el punto más probable de confusión.
- El link largo es menos natural que el QR; en el teléfono, el QR es el camino.
- La **Guía** existe, pero una persona no la busca si no sabe que está.
- **Mi camino** es la parte más emocional; la gente entiende rápido “apartar para la sombrilla”.

## 8 · Registro

Guarda cada sesión en `demo/feedback.md`:

```md
## Persona 1 — puesta de comida, 42 años
- Fecha:
- Tiempo total:
- Tarea 1: 38 s, sin ayuda
- Tarea 2: 12 s, entendió “no verificado”
- Tarea 3: 20 s, preguntó “¿esto no es venta?”
- Tarea 4: 55 s, no encontró “Actualizar corte”
- Tarea 5: 18 s, sin ayuda
- Frase textual:
- Cambio prioritario:
```

La regla: **si tres personas se atoran en el mismo punto, se arregla esa semana; si solo fue una, se anota y se sigue.**
