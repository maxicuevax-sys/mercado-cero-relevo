# AUDITORÍA-COGNITIVA — Mercado Cero

> **Fase F0 de `GOAL-ACOMPANAMIENTO.md`** · 1 de noviembre de 2026 · commit `26d06ce`.
> **Método:** tres auditorías de carril en paralelo (venta/cobro, fiado/corte, shell/meta/verificación), lectura de código y artefactos, GETs de solo lectura. Sin mutar la demo, sin Playwright y sin gates.
> **Límite:** auditoría estructural. No mide carga percibida con personas ni sustituye TalkBack/VoiceOver, teléfono físico o estudio de comerciantes.
> **Evidencia de carril:** `harness/f0-venta.md`, `harness/f0-dinero.md`, `harness/f0-shell.md`.

---

## 1 · Veredicto en una frase

La app **se ve** como una herramienta de mostrador, pero todavía **no se comporta** como una memoria operativa: la venta depende de la IA, el efectivo real no cabe, el borrador no sobrevive, el fiado tiene dos saldos, el corte se pisa y el 200 % rompe el shell.

**No está listo para implementar “Pendientes” como módulo nuevo** antes de corregir estas bases. El P0 del goal debe reordenarse: primero quitar trabajo y errores reales; después añadir la bandeja de tareas.

---

## 2 · Mapa del sistema actual

| Superficie | Qué hace hoy | Qué promete el goal | Brecha principal |
|---|---|---|---|
| Caja | Voz/texto → parser → draft → confirmar → link/QR/efectivo/fiado | Vender, cobrar y anotar sin IA; draft recuperable | Sin parser no hay primer producto; draft en React; efectivo con cambio no cabe |
| Cobro | Sheet de link/QR, polling solo con sheet abierto | Pendiente ≠ pagado; no doble cobro | Pendiente se congela al cerrar; link/demo sin idempotencia; estados “Por cobrar” ambiguos |
| Fiado | Lista de créditos y abono manual; chip/voz ejecuta abono directo | La IA propone; la persona confirma; saldo vivo | Abono por voz sin confirmación y siempre efectivo; dos saldos; abonos fuera del resumen |
| Corte | Conteo, diferencia, guardar; `UPSERT` por fecha | Cerrar el día con lo registrado y lo faltante | Refresh borra conteo; guardado sobrescribe; no hay cierre ni resumen de pendientes |
| Meta | Foto, progreso, apartar | Apartado declarado, no custodia | No se puede crear meta; error se disfraza de vacío; foto antes que datos a 360 |
| Verificar | ID de transacción → `/api/verify` | Anti-fraude comprensible | La app no muestra el ID; no compara pedido/monto/fecha; demo falso visible en real |
| Shell | 4 tabs, sheets, ayuda | Reconocimiento, lenguaje claro, 200 % | H1/nav/header se parten a 200 %; fallo de red oculta DEMO y muestra datos falsos |
| Actividad | 30 pedidos, hora, sin fecha | Saber qué pasó y qué falta | Mezcla días; no muestra pendiente/verificado; no refresca al pagar fuera del sheet |

---

## 3 · Los diez hallazgos que importan

### 3.1 · La venta sin IA no existe — **crítico**
El botón “Agregar producto” solo aparece cuando ya hay productos (`caja-app.tsx:1751`); el estado vacío no lo tiene (`1770-1781`). El único creador de ítems es `/api/voice/parse`. Si OpenAI falla, no hay venta manual. Incumple la ley “la IA no bloquea lo esencial” y el must-pass de vender sin asistente.

### 3.2 · El efectivo real no cabe — **crítico**
“Efectivo recibido” se compara contra el total; $100 sobre $90 marca sobrepago y deshabilita “Confirmar venta” (`caja-app.tsx:749-756`, `1868-1878`). No hay cambio. El servidor ya recorta el efectivo (`orders.ts:50-54`), así que el arreglo es de UI/estado, no de ledger: aceptar el billete, mostrar cambio y enviar el aplicado.

### 3.3 · El borrador no sobrevive — **crítico**
`draftItems`, efectivo, fiado y cliente viven en estado React. Recargar, cerrar pestaña o que el sistema mate la app lo borra. `README.md` afirma que se guardan localmente; es falso. El must-pass de interrupción no se cumple.

### 3.4 · El fiado tiene dos saldos y una escritura sin confirmación — **crítico**
La libreta muestra `credits.balance_cents`; el detalle del pedido y la actividad muestran `orders.credit_cents` original. Después de un abono parcial, los dos números no coinciden. Peor: “Juan pagó $50” por voz/chip hace `POST` inmediato, con método efectivo fijo, sin confirmación ni idempotencia (`caja-app.tsx:604-632`). La IA tiene autoridad financiera.

### 3.5 · El corte no es un cierre — **alto**
Refresh o cualquier venta/abono dispara `load()` y pisa el conteo (`caja-app.tsx:2542-2576`). Guardar hace `UPSERT` por fecha, sin versión, historial ni `audit_log` (`cash.ts:119-138`). Se puede guardar $1 contra $570 sin motivo y la base para mañana puede superar lo contado. El aviso “guardado” no se limpia al editar.

### 3.6 · “Hoy” significa tres cosas — **alto**
La pantalla suma efectivo + verificado + demo + pendiente (`caja-app.tsx:1102-1109`); la voz suma efectivo + verificado + demo (`564-576`); “Por cobrar” es pendiente digital de hoy; “Fiado” es saldo histórico global. La misma persona no puede explicar cuánto vendió, cobró o le deben.

### 3.7 · El pago demo se ve entregable y el checkout inicial no se declara demo — **alto**
`05-pago-simulado.png`: sin pill DEMO, título negro y CTA verde “Listo para entregar”, igual que un pago real. `checkout-360-fold.png`: “PAGO PROTEGIDO”, “Seguro”, total y métodos, sin aviso DEMO en el primer viewport. La verdad por pedido existe; la jerarquía visual no la sostiene.

### 3.8 · El 200 % rompe el shell — **alto**
`home-360-text200.png`: “C / aj / a”, header al 43 % y campo de venta fuera. `home-1280-text200.png`: “Fiad / o”, “Cort / e”. `help-1280-text200.png`: controles partidos. El gate solo mide clipping/overflow y declara verde; no mide fragmentación ni dominio del header.

### 3.9 · Un fallo de red se convierte en datos falsos — **alto**
Si `/api/dashboard` falla, se muestra el comercio hardcodeado, desaparece DEMO, queda “Cargando…” para siempre, Actividad dice “no hay ventas” y Fiado “sin fiados”. El error se reintenta en bucle porque `showToast` cambia `loadDashboard`. No hay estado `error` ni “Reintentar”.

### 3.10 · Los pendientes no son una bandeja — **alto**
“Por cobrar” solo cuenta pedidos de hoy (`db.ts:612-616`), Actividad trae 30 y muestra solo hora, y el polling existe solo con el sheet abierto. Un cobro de ayer puede desaparecer de la pantalla sin desaparecer de SQLite. No hay cancelar/vencer ni “última comprobación”.

---

## 4 · Lo que sí debe conservarse

- `paymentTruth()` y el resultado por pedido: efectivo, demo, pey, fiado y mixto están bien separados; no inferir demo del flag global.
- Webhook firmado, idempotencia por `transactionId`, validación de monto/referencias y `/api/verify` solo `provider='pey'` (con las salvedades de la auditoría de dinero).
- Targets de 48 px, foco atrapado en sheets, Escape, skip link y tokens de “Mostrador claro”.
- La hoja manual de abono ya tiene confirmación de descarte y método; el patrón correcto existe.
- La verdad por pedido en el `PaidSheet`/`PaymentPanel`; no romperla al simplificar.

---

## 5 · P0 reordenado (máximo 6 cortes)

> **Criterio:** cada corte debe reducir trabajo o errores reales, no añadir un módulo. No se toca el webhook ni la verdad de pey. Cada corte debe tener prueba de aceptación y gate.

| # | Corte | Por qué primero | Esfuerzo | Riesgo |
|---|---|---|---|---|
| **P0-A** | **Venta manual + efectivo con cambio + validación inline** | Desbloquea vender sin IA y el caso cotidiano $100/$90 | M | Medio |
| **P0-B** | **Borrador durable y reanudación** | Cumple el must-pass de interrupción; evita re-dictar | M | Medio |
| **P0-C** | **Abono confirmado + saldo vivo** | Quita la única escritura financiera sin aprobación y los dos saldos | M | Medio |
| **P0-D** | **Corte no destructivo + resumen de cierre** | Evita perder el conteo y cerrar con una foto falsa | M–L | Medio |
| **P0-E** | **Cobros pendientes visibles + fechas/refresh** | Convierte “Por cobrar” en una bandeja mínima, sin crear el módulo completo | M | Medio |
| **P0-F** | **Shell 200 % + estados de error** | La app debe seguir siendo legible y honesta cuando falla | M | Bajo |

### P0-A · Venta manual + efectivo con cambio + validación

**Cambio:** “Agregar producto” visible con draft vacío; validar descripción y precio > 0 por ítem, enfocando el primero inválido; aceptar efectivo entregado mayor al total, calcular cambio y enviar el aplicado; si el parser falla, ofrecer “Escribir productos” sin borrar lo anterior.

**Aceptación:**
- Con `/api/voice/parse` en 500, se crea una venta manual de 2 ítems.
- Total $90, recibido $100 → cambio $10 y orden con `paidCents = 9000`.
- Ítem con precio 0 → error inline antes del POST, foco en el ítem.
- No se toca el webhook ni el contrato de pago.

### P0-B · Borrador durable

**Cambio:** guardar `draft` versionado en `localStorage` (items, efectivo, fiado, cliente, transcript, textInput, actualizadoEn) y `activeOrderId`; al montar, banner “Recuperé tu venta de las HH:MM” con “Continuar”/“Descartar”; limpiar solo con confirmación o al crear la orden; no auto-enviar.

**Aceptación:**
- Dictar 2 ítems, recargar, continuar y confirmar una sola vez.
- Cerrar el sheet de cobro, recargar y reabrir el pendiente sin duplicar.
- Un borrador de ayer se muestra con fecha y exige decisión.

### P0-C · Abono confirmado + saldo vivo

**Cambio:** la voz/chip abre `CreditPaySheet` prellenado; no hace `POST`. Método visible (no solo color), monto aplicado vs entregado, idempotencia; la libreta, el detalle y la actividad leen el saldo vivo y muestran el original como “original”.

**Aceptación:**
- “Juan me pagó 50” no cambia el saldo hasta confirmar.
- Cancelar deja el saldo intacto.
- Abono de $100 sobre $50 muestra “se aplican $50, devuelve $50” o bloquea.
- Dos envíos con la misma llave no duplican.
- Un crédito liquidado dice “Saldado” en todas las superficies.

### P0-D · Corte no destructivo + cierre

**Cambio:** borrador local del conteo; `load()` no pisa si hay cambios; validar número/base; confirmación muestra gastos/retiros; guardar versionado + `audit("cash.close")`; después del cierre, mostrar resumen de efectivo, fiado y pendiente digital; movimientos posteriores no alteran la foto.

**Aceptación:**
- Contar, provocar refresh/venta, volver: el conteo sigue.
- Base 400 con contado 1: se bloquea o advierte.
- Guardar dos veces deja versión/corrección con motivo; no desaparece la primera.
- El aviso usa la diferencia del servidor.

### P0-E · Cobros pendientes visibles + fechas/refresh

**Cambio:** franja compacta “Cobros pendientes” con `confirmed`/`payment_pending`/`partially_paid`, monto y estado (“sin link”/“esperando banco”/“parcial”); refrescar al volver a la pestaña y cada 30–60 s visible; “Última comprobación” y error con reintento; fecha en Actividad/Fiado cuando no sea hoy; no rotular “Efectivo” un pedido con saldo.

**Aceptación:**
- Un pendiente de ayer sigue visible.
- Pagar con el sheet cerrado actualiza la Caja.
- “Sin link” y “esperando banco” se distinguen.
- No se abre el `PaidSheet` automáticamente.

### P0-F · Shell 200 % + estados de error

**Cambio:** quitar `overflow-wrap` global o limitarlo; apilar H1/acción; sidebar fluido; guía a 1–2 columnas; topbar compacto; estado `loading | error | empty` con “Reintentar”; no mostrar comercio/demo hardcodeado si no hay dashboard; `showToast` estable; “Agregar producto” también en vacío (coordinado con P0-A).

**Aceptación:**
- 360/390/1280 a 200 % sin palabras partidas ni header dominante.
- Fallo de `/api/dashboard`: se ve error, no “no hay ventas”; DEMO no desaparece.
- La venta manual sigue disponible si falla la IA.

### Fuera de P0 inmediato

- **Módulo completo “Pendientes”** (tareas con completar/posponer/eliminar): es el P0 nominal del goal, pero F0 muestra que antes hay que arreglar la venta, el fiado y el corte. Se implementa después de A–F o se declara fuera del 7 de noviembre; no se presenta como hecho.
- **Recomendaciones deterministas, preferencias de acompañamiento, exportación**: P1.
- **Chatbot**: fuera.
- **Gamificación, rachas, créditos/publicidad**: fuera.
- **Reconciliación pey dentro del corte**: P1.

---

## 6 · Decisiones que necesitan aprobación humana

1. **¿Efectivo puede seguir siendo `paid`?** Si sí, el invariante debe decir “ningún pago **digital** se verifica sin pey; el efectivo se registra como declarado”. Si no, hay que renombrar el estado. No se puede dejar la frase absoluta y el código actual.
2. **¿“Pendientes” completo entra antes del 7?** F0 recomienda no; A–F ya consumen el tiempo y evitan mentir. Si entra, se recorta otra cosa.
3. **¿El P0 prioriza 200 % o venta manual?** Ambos son críticos; P0-A/B desbloquean la operación, P0-F desbloquea la accesibilidad. Se pueden correr en carriles separados, pero comparten `caja-app.tsx`.
4. **¿Se acepta un “cierre” versionado con migración SQLite** o se limita a borrador + validación + auditoría sin cambiar el esquema? La versión completa es más confiable, pero más riesgo.

---

## 7 · Lo que no se verificó

- Personas (0 de 6–8), SUS, NASA-TLX, tiempos humanos.
- Teléfono físico, TalkBack/VoiceOver/NVDA, teclado de punta a punta.
- Modo real `DEMO_MODE=false`, pago de $0.01, webhook pey real, checkout real.
- Zoom de navegador real; el 200 % es inyección de `font-size`.
- Alto contraste y daltonismo.
- Caída de red real (el bucle es lectura de código).
- Estado sin meta real (la semilla crea una meta siempre).

---

## 8 · Primer corte recomendado

**P0-A + P0-B en un solo carril de Caja**, porque comparten el mismo estado y deben probarse juntos: vender sin IA, aceptar el billete, recuperar el draft. No tocar el webhook. Después, P0-C (fiado) y P0-D (corte) en carriles separados.

**No iniciar “Pendientes” como módulo nuevo hasta que A–F estén verdes.** La bandeja mínima de P0-E ya quita la mayor parte del dolor de “no sé qué me deben” sin abrir otra arquitectura.


---

## 9 · Resultado del primer corte P0 (1 de noviembre de 2026)

**P0-A + P0-B implementados y mergeados** en `master` (`c22e85d`), tras dos rondas de revisión independiente.

- Venta manual desde el estado vacío y “Escribir productos” si falla el parser.
- Validación inline por ítem, con foco en el primer campo inválido.
- Efectivo recibido con cambio: $100/$90 → cambio $10; $100 con $30 de fiado → cambio $40. El servidor recibe solo el aplicado.
- Borrador durable versionado en `localStorage`, banner “Recuperé tu venta…”, “Continuar venta” / “Descartar borrador”.
- Pendiente de cobro durable (`activeOrderId`), “Continuar cobro” reabre el mismo pedido; no se borra al abrir/crear otra orden.
- “Limpiar” con confirmación y foco de retorno.
- 51 ítems sin truncamiento; `aria-invalid` por campo; JSON corrupto se elimina.

**Evidencia:**
- `web/scripts/p0-venta-e2e.py` — **43 PASS · 0 FAIL · 1 KNOWN**.
- `harness/evidence/p0-venta-e2e.json`.
- `npm run verify:fast` 3/3; `verify:static` 4/4; `verify:full` 11/11.
- Reporte de carril: `P0-VENTA-REPORT.md`.

**KNOWN de P0-C/E:** una venta mixta con fiado + saldo digital deja los datos correctos (`confirmed`, `paidCents`, `creditCents`) pero el `PaymentPanel` existente no ofrece cobrar el remanente. No se presenta como experiencia aprobada.

**Siguiente orden:** P0-C (abono confirmado + saldo vivo), P0-E (pendientes de cobro visibles, fechas y refresh) y P0-F (200% + estados de error). El módulo completo de “Pendientes” de negocio sigue después de estos cortes.


---

## 10 · Resultado P0-C · Fiado confirmado y saldo vivo (2 de noviembre de 2026)

**P0-C mergeado** en `master` (`586f1a6`), tras dos rondas de revisión independiente.

- La voz/chip de abono **ya no escribe**: abre la hoja con cliente, saldo vivo y monto interpretado.
- La hoja muestra original, abonado, saldo vivo, aplicado y devuelto; método con check/foco, no solo color.
- `POST /api/credits/:id/pay` tiene idempotencia durable (`request_id` nullable + índice único parcial), transacción `BEGIN IMMEDIATE`, `appliedCents`/`overpayCents`/`balanceCents` y 409 por saldo cambiado/saldado/colisión.
- `orders.creditCents` sigue siendo el monto original; la libreta, el detalle y la actividad leen el saldo vivo y dicen “Saldado”.
- El baseline de “borrador sucio” es el monto inicial de la hoja, no el saldo; cerrar sin editar no molesta.
- Migración compatible con DB vieja (probada manualmente; no automatizada).

**Evidencia:**
- `p0-fiado-e2e.py` — **50 PASS · 0 FAIL · 0 KNOWN** en `:3101` con DB temporal.
- `p0-venta-e2e.py` — **43 PASS · 0 FAIL · 1 KNOWN** en `:3101` sobre este árbol.
- `npm run verify:full` — 11/11; `verify:static` 4/4.
- Reporte: `P0-FIADO-REPORT.md`; artefacto 360: `harness/evidence/p0-fiado-360.png`.

**KNOWN / siguiente:**
- Venta mixta con fiado + saldo digital: los datos son correctos, pero `PaymentPanel` no ofrece cobrar el remanente (P0-E/P0-5).
- Consulta de voz con varias deudas devuelve una; “me transfirió” no preselecciona Digital; un solo slot de pendiente y sin polling inactivo.
- La idempotencia es por intención de hoja; cerrar y reabrir genera otra llave. No hay reintento automático.
- Siguiente: **P0-E** (cobros pendientes visibles/fechas/refresh) y **P0-F** (200 % + estados de error).
