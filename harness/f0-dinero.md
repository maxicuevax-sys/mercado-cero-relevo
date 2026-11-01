# F0 · Auditoría de carga cognitiva — fiado, corte y cierre

> **Alcance:** recorte de dinero de la fase F0 de `GOAL-ACOMPANAMIENTO.md`. No es la auditoría completa de venta, meta y verificación; es el tramo fiado → abono → saldo → corte → cierre.
> **Commit auditado:** `26d06ce` (`docs(harness): tie evidence to the verified code commit`), árbol limpio. El commit no cambia código de producto; las referencias apuntan al código servido en ese árbol.
> **Método:** lectura de código, capturas de `demo/`, lecturas **GET** a `http://localhost:3000` y consultas **read-only** a `web/data/mercado-cero.db`. No reinicié el servidor, no muté la demo, no corrí Playwright ni `verify:*`.
> **Límite:** el proceso en `:3000` no se reinició; no puedo garantizar que sea exactamente el build de `26d06ce`. Las lecturas read-only son del estado demo del momento de la auditoría. Ver §7.

---

## 0 · Veredicto en una página

La interfaz se ve cuidada. La contabilidad de fiado y corte **no cierra**.

1. **Hay dos libros para el mismo dinero.** Las ventas y los pagos viven en `orders`/`payments`; los abonos de fiado viven en `credits`/`credit_payments`. El corte suma ambos; el resumen “Hoy” y “Cobrado” solo uno de los dos. El mismo abono aparece en una pantalla y desaparece de otra.
2. **El mismo fiado tiene dos saldos.** La libreta muestra `credits.balance_cents` (vivo); el detalle del pedido y la actividad muestran `orders.credit_cents` (original). Después de un abono parcial, los dos números no coinciden y el pedido sigue diciendo “Fiado”.
3. **“Hoy”, “Por cobrar” y “Fiado” significan tres cosas distintas.** “Hoy” incluye dinero que aún no llega y excluye la parte fiada; “Por cobrar” es pendiente de cobro digital, no fiado; “Fiado” es el saldo histórico completo, no el del día.
4. **El corte no es un cierre.** Es una calculadora que guarda una fila por fecha con `UPSERT`, sin versión, sin historial, sin auditoría y sin estado “cerrado”. Se puede reemplazar el corte del día entero desde la misma pantalla.
5. **El abono más peligroso no pasa por una hoja de confirmación.** Decir o tocar “Juan me pagó 50” ejecuta el `POST` inmediatamente, con método efectivo fijo y sin idempotencia. Es la única escritura financiera del flujo que ocurre sin que la persona revise monto, cliente y método.
6. **Un fiado nace “Entregado”.** Si el pedido queda cubierto con efectivo + fiado, `createOrder` lo marca `fulfilled` antes de que nadie confirme la entrega; analítica lo cuenta como pedido pagado y el detalle puede titular “Pedido entregado” con deuda abierta.

**Lo que sí funciona:** la aritmética del efectivo es determinista y el servidor la recalcula; la diferencia se muestra, no se esconde; el servidor recorta el abono al saldo (no deja saldo negativo); la hoja de abono protege un borrador sucio al cerrarla; la separación demo/pey por pedido está cuidada, aunque los agregados la pierden. Nada de eso compensa los seis puntos anteriores.

**La frase que hoy no se puede sostener:** “Cerré mi día con menos pendientes en la cabeza y sé qué pasó con mi dinero.” El corte guarda efectivo, pero no cierra el día; el fiado no se puede explicar; el abono no deja recibo.

---

## 1 · Mapa del flujo actual

### 1.1 Fiado · crear deuda

La deuda no se crea desde la libreta. Se crea dentro de una venta, en Caja.

| # | Paso | Dónde / código | Campo o decisión | Qué queda |
|---|---|---|---|---|
| 1 | Entrar a Caja | `caja-app.tsx:1095-1170` | — | Es la pestaña inicial. |
| 2 | Hablar o escribir la venta | `caja-app.tsx:581-664`; `voice.ts:62-101` | Frase; el parser devuelve items, efectivo, fiado, cliente | Borrador en memoria; nada persistido. |
| 3 | Revisar/editar productos y precios | `caja-app.tsx:1669-1768` | `items`, `quantity`, `unitPriceCents` | `draftItems` en memoria. |
| 4 | Escribir “Efectivo recibido” | `caja-app.tsx:1787-1805` | `cashCents` | Decisión: cuánto dinero entra ahora. |
| 5 | Escribir “A fiado” | `caja-app.tsx:1807-1825` | `creditCents` | Decisión: cuánto queda a deber. |
| 6 | Escribir el nombre | `caja-app.tsx:1828-1842` | `customerName`, texto libre obligatorio si hay fiado | Sin selector, sin clientes recientes, sin deduplicación visible. |
| 7 | Confirmar venta | `caja-app.tsx:1868-1878`; `764-841` | `POST /api/orders` | Se crea pedido, items, pago en efectivo (si hay) y crédito (si hay). |
| 8 | Ver el resultado | `caja-app.tsx:809-823` | Toast de 3 s | Si es fiado, **no** hay hoja de resultado ni recibo persistente. |
| 9 | Ir a Fiado a ver la deuda | `caja-app.tsx:1192-1223` | — | La deuda aparece, sin vínculo visible al pedido. |

**Conteo de interacción:** 8–9 pasos mínimos, 4 campos (items, efectivo, fiado, nombre), 4 decisiones (cuánto efectivo, cuánto fiado, quién debe, confirmar). Si la venta se dicta, se agregan los pasos de interpretar y corregir.

**Lo que hace el servidor** (`orders.ts:25-119`):

- Recorta `cashCents` al total y `creditCents` a `total - cash` (`orders.ts:49-54`). Si el cliente manda de más, no falla: lo ajusta en silencio.
- Inserta el pedido en `confirmed`; inserta un pago `paid` si hubo efectivo; crea/reutiliza cliente por nombre case-insensitive y crea el crédito `open` con `original_cents = balance_cents = creditCents` (`orders.ts:86-108`).
- Si no queda saldo digital (`digitalDue <= 0`), cambia el estado a **`fulfilled`** cuando hay fiado, o a `paid` cuando no (`orders.ts:110-115`). Un fiado puro o efectivo+fiado nace “Entregado”.
- No hay transacción que envuelva pedido + items + pago + crédito. Si algo falla a mitad, puede quedar un pedido sin items o sin crédito, o un pago que no cuadra (`orders.ts:59-108`).

**Hallazgo de flujo:** la pestaña Fiado solo permite **cobrar**, no **anotar**. Si la persona quiere registrar una deuda que no nace de una venta (o corregir una venta anterior), no hay acción; tiene que ir a Caja y fabricar una venta.

---

### 1.2 Fiado · abonar

| # | Paso | Dónde / código | Campo o decisión | Qué queda |
|---|---|---|---|---|
| 1 | Abrir Fiado | `caja-app.tsx:1192-1203` | — | Lista de créditos no liquidados. |
| 2 | Elegir la deuda | `caja-app.tsx:3483-3514` | — | No hay detalle previo: solo nombre, estado, hora y saldo. |
| 3 | Tocar “Registrar abono” | `caja-app.tsx:1196-1202` | — | Hoja con el saldo completo precargado. |
| 4 | Editar el monto | `caja-app.tsx:3614-3629` | `creditPayAmount` | Decisión: abono total o parcial. |
| 5 | Elegir método | `caja-app.tsx:3631-3666` | `creditPayMethod` (`cash` por defecto, `codi` como “Digital”) | Decisión: efectivo o digital. |
| 6 | Nota opcional | `caja-app.tsx:3668-3678` | `creditPayNote` (280 caracteres) | Único lugar donde cabe el contexto. |
| 7 | Confirmar | `caja-app.tsx:3686-3695`; `965-1002` | `POST /api/credits/:id/pay` | Se inserta `credit_payments` y se actualiza `credits.balance_cents/status`. |
| 8 | Ver el resultado | `caja-app.tsx:986-994` | Toast de 3 s: “Abono registrado. Juan debe $X.” | La hoja se cierra; no hay recibo ni historial visible. |

**Conteo de interacción manual:** 6–8 pasos, 3 campos, 4 decisiones (monto, método, nota, confirmar).

**La ruta por voz o por muestra no tiene pasos 2–7.** El chip “Juan pagó $50” llama a `interpretText` (`caja-app.tsx:103-113`, `1151-1155`); si el parser devuelve `credit_payment`, el código hace el `POST` directamente (`caja-app.tsx:604-632`). No hay hoja, no hay confirmación, no hay selector de método: **siempre `cash`**, aunque la persona haya dicho “me transfirió”. Además busca el cliente por `lower.includes(customerName)` sobre la transcripción (`caja-app.tsx:604-611`), no por el `customerName` que devolvió el parser. “Mariana me pagó” puede aplicar el abono a “Ana” si “Ana” aparece antes en la lista. Si hay tres deudas de Juan, aplica a la primera no liquidada. La prueba móvil incluso **exige** este comportamiento: `mobile-audit.py:196-199` hace clic en el chip y espera “Abono de” y “Saldo: $0.00”.

**Lo que hace el servidor** (`orders.ts:235-266`):

- `amount = min(max(0, round(amountCents)), credit.balanceCents)` (`orders.ts:245`). Un sobrepago se recorta sin avisar; un monto que llega cuando el crédito ya está liquidado se convierte en 0 y el endpoint responde 200 con el crédito intacto.
- Inserta el abono, resta el saldo y cambia el estado a `settled` si queda en 0 (`orders.ts:248-257`). **No toca `orders`**: ni `paid_cents`, ni `credit_cents`, ni `status`.
- No hay transacción entre el `INSERT` y el `UPDATE`; no hay llave de idempotencia; no hay versión del crédito. Dos pestañas o un reintento después de una respuesta perdida pueden insertar dos abonos parciales.
- El abono queda en `credit_payments` y en `audit_log` (`audit("credit.payment", ...)`), pero **no hay ruta ni pantalla que los lea**. El dato existe; la persona no lo puede ver.

---

### 1.3 Fiado · saldo

El saldo no tiene una sola definición. Esta tabla es la raíz del problema:

| Lugar | Fuente | Qué muestra | Qué no muestra |
|---|---|---|---|
| Encabezado de Fiado | suma de `balanceCents` de créditos no liquidados (`caja-app.tsx:3453-3466`) | Saldo pendiente total y “N clientes” | “N clientes” cuenta **créditos**, no personas: dos deudas de Juan dicen “2 clientes”. |
| Tarjeta de cada deuda | `credit.balanceCents`, `credit.status`, `formatTime(credit.createdAt)` (`caja-app.tsx:3493-3503`) | Saldo vivo y “Pendiente”/“Abono parcial” | Fecha (solo hora), monto original, cuánto se ha abonado, qué se vendió, a qué pedido corresponde. |
| Detalle del pedido | `order.creditCents` (`caja-app.tsx:2003-2008`) | “Saldo pendiente: $X” | Que X es el **monto original**, no el saldo vivo. |
| Hoja de pago | `order.creditCents` (`caja-app.tsx:4455-4460`) | “Saldo pendiente: $X” | Lo mismo: original, no vivo. |
| Actividad | `paymentTruth.hasCredit` (`caja-app.tsx:3344-3415`) | “Fiado” o “Pago mixto” | El saldo; y sigue diciendo “Fiado” aunque el crédito esté liquidado, porque `order.creditCents` nunca cambia. |
| Encabezado de Caja | `dashboard.summary.creditCents` (`caja-app.tsx:1107-1109`) | Fiado histórico total | “Fiado de hoy”; no está filtrado por fecha. |
| Resumen “Mi negocio” | `analytics.creditCents` (`analytics.ts:162-166`) | Fiado histórico total | Fiado del periodo; la tarjeta está junto a métricas del periodo y se lee como si fuera del periodo. |

**Ejemplo concreto de los dos saldos:** un pedido de $100 a fiado, abono de $50. La libreta y el segmento “Fiado” del encabezado de Caja dicen $50 (leen el saldo vivo), pero el detalle del pedido sigue diciendo “Saldo pendiente: $100.00” y la actividad sigue diciendo “Fiado”. La persona no puede saber cuál de los dos números es el bueno sin abrir otra pantalla.

**Hallazgo de diseño:** `orders.credit_cents` **no es** un saldo vivo; es el monto original del fiado y se usa para `coveredCents` en `recordPayment` (`orders.ts:210-218`). Actualizarlo al abonar rompería la verdad del pago y perdería el original. La solución no es un `UPDATE` a ciegas: es leer el crédito vivo y mostrar el original por separado.

---

### 1.4 Corte · contar

| # | Paso | Dónde / código | Campo o decisión | Qué queda |
|---|---|---|---|---|
| 1 | Abrir Corte | `caja-app.tsx:1225-1241` | — | La tarjeta se monta aunque la pestaña esté oculta (`hidden`), así que ya cargó `/api/cash`. |
| 2 | Ver “Total contado” | `caja-app.tsx:2695-2711` | `counted` | Vacío si no hay corte guardado; precargado con el último guardado si existe. |
| 3 | Opción A: escribir el total | `caja-app.tsx:2699-2709` | `counted` | Entrada de texto, no numérica: acepta letras, comas y puntos. |
| 4 | Opción B: contar por billetes/monedas | `caja-app.tsx:2770-2805` | 11 denominaciones (`DENOMINATIONS`, `2515`) | Reemplaza el total manual; no se guarda el desglose. |
| 5 | Leer “De dónde sale el esperado” | `caja-app.tsx:2807-2855` | `opening`, `cashSales`, `cashCredit`, `expenses`, `withdrawals` | La explicación está **debajo** del total contado; en 360 px parte del desglose queda tapada por la nav inferior. |
| 6 | Escribir gastos y retiros | `caja-app.tsx:2821-2848` | `expenses`, `withdrawals` | Sumas globales, sin movimiento, fecha, categoría ni comprobante. |
| 7 | Escribir “Base para mañana” | `caja-app.tsx:2857-2868` | `baseNext` (default 400.00 si no hay corte) | Decisión: cuánto cambio se queda; no se valida contra lo contado. |
| 8 | Guardar | `caja-app.tsx:2890-2899` | `requestSave` | Si la diferencia es 0, guarda directo; si no, abre confirmación. |

**La fórmula es correcta** (`cash.ts:84-94`, `caja-app.tsx:2583-2590`):

```text
esperado = base inicial + ventas en efectivo + abonos de fiado en efectivo
           - gastos de caja - retiros
diferencia = contado - esperado
adicional a retirar = max(0, contado - base para mañana)
```

**Conteo de interacción:** 8–10 pasos, 4 campos principales (contado, gastos, retiros, base) y 11 denominaciones opcionales, 4 decisiones (contar de una vez o por billetes, gastos, retiros, base). No incluye el trabajo mental de recordar los gastos/retiros del día.

**Lo que no se guarda:** el desglose por denominaciones, el detalle de gastos/retiros, quién contó, una nota de por qué falta o sobra, ni la lista de movimientos que componen las ventas/abonos. El corte guarda los totales y el esperado calculado (`CashClose`, `types.ts:188-202`).

---

### 1.5 Corte · diferencia y guardar

1. La diferencia se calcula en vivo con `counted - expected`. Se etiqueta “Cuadra”, “Sobra” o “Falta” (`caja-app.tsx:2592-2594`).
2. Si `counted` está vacío, bloquea con “Escribe el total contado antes de guardar el corte” (`caja-app.tsx:2646-2651`). Pero `hasCounted` solo comprueba que el texto no esté vacío (`2582`): “abc” pasa y se interpreta como $0.00.
3. Si la diferencia es 0, `requestSave` llama a `saveClose` directamente; no hay confirmación. Si no es 0, abre la hoja “Confirmar corte” (`caja-app.tsx:2906-2968`).
4. La hoja muestra **solo** total contado, “Debería haber”, base para mañana y diferencia. **No muestra gastos ni retiros**, no muestra el desglose, no pide motivo y no distingue una diferencia de $1 de una de $569. La captura `corte-confirm-360.png` muestra $1.00 contado contra $570.00 esperado con el botón “Guardar corte” habilitado.
5. El `POST /api/cash/close` recalcula el esperado en el servidor con las ventas y abonos **del momento** (`cash.ts:105-115`), pero el aviso y el toast usan la diferencia calculada en el cliente antes del `POST` (`caja-app.tsx:2631-2638`). Si entró una venta entre la carga y el guardado, lo guardado y lo anunciado pueden no coincidir.
6. El servidor hace `INSERT ... ON CONFLICT(date) DO UPDATE` (`cash.ts:119-138`): una sola fila por fecha, todos los campos de contenido reemplazados, incluido `created_at`. No hay versión, historial ni `audit()`; el corte no deja rastro en `audit_log`.
7. La `openingCents` que se guarda viene del cliente (`caja-app.tsx:2615`, `cash.ts:108`), no se deriva del servidor en el momento de guardar. La UI no la expone, pero una pestaña vieja o un cliente distinto puede mandar otra base.

---

### 1.6 Corte · cierre

**No existe un cierre como estado.** Existe un guardado que se puede repetir.

- El corte guardado es solo de **efectivo**. Guarda la base y el retiro, pero no incluye el fiado nuevo ni el saldo de fiado, el pendiente de cobro digital ni un resumen de pendientes para mañana. La tarjeta “¿Cuadra con pey?” es otra consulta de solo lectura (`caja-app.tsx:3159-3301`) y no forma parte del registro del corte.
- La pantalla dice: “Último corte guardado: contado $X · diferencia $Y. **Puedes volver a contar y guardar de nuevo**” (`caja-app.tsx:2877-2882`). Es honesta sobre el reemplazo, pero lo presenta como operación normal, no como corrección con trazabilidad.
- Después de guardar se puede seguir vendiendo. `getCashStatus` recalcula `cashSalesCents` y `cashCreditCents` con los pagos actuales (`cash.ts:62-77`), así que el “esperado” en vivo cambia; la fila guardada conserva el esperado viejo. La persona ve dos diferencias: la viva y la guardada.
- La base para mañana se convierte en la base inicial del día siguiente (`cash.ts:51-60`). Si la base guardada es mayor que lo contado —la captura muestra contado $1.00 y base $400.00—, el día siguiente arranca con $400 “esperados” que no existen en la caja. No hay validación ni advertencia.
- No hay historial de cortes en la UI. `getCashClose(date)` existe (`cash.ts:39-44`), pero no hay ruta que liste días anteriores; el único acceso es el de hoy.
- No hay recordatorio de “no cerraste ayer” ni de “tu corte quedó con una diferencia sin explicar”. La base del día siguiente simplemente toma el último `base_next` anterior.
- **“Cerré mi día” no tiene un estado que lo represente.** El sistema no sabe si el día terminó; solo sabe que hay una fila de efectivo con fecha.

---

## 2 · Carga cognitiva

### 2.1 Lo que la persona debe recordar

- **El nombre exacto del cliente y su ortografía.** No hay selector ni sugerencias; `findOrCreateCustomer` solo compara `lower(name)` (`db.ts:512-530`), así que “José” y “Jose” crean dos clientes. La voz busca por subcadena en la transcripción (`caja-app.tsx:604-611`).
- **Cuál de las deudas es.** Una persona puede tener varios créditos; la libreta los muestra como tarjetas separadas con el mismo nombre y solo la hora (`formatTime`, `format.ts:17-22`). Sin fecha ni pedido, una deuda de la semana pasada se ve igual que la de hoy.
- **Cuánto debía originalmente y cuánto ha pagado.** La tarjeta solo muestra el saldo vivo; `originalCents` existe pero no se muestra, y no hay historial de abonos. Después de un abono parcial, “Abono parcial” es toda la explicación.
- **Qué se vendió y a qué precio.** La libreta no muestra items ni pedido. Para saberlo hay que ir a Caja → Actividad y buscar una fila que también muestra solo la hora y los items; no hay enlace de la deuda al pedido.
- **Todos los gastos y retiros del día.** El corte los pide como dos sumas globales; no hay módulo de movimientos de caja. Si la persona pagó hielo, gas o un proveedor en efectivo, debe recordarlo hasta el corte y decidir en qué campo va.
- **Qué abonos fueron en efectivo y cuáles digitales.** El método se elige en la hoja y no se vuelve a mostrar en la libreta, la actividad ni el detalle. El corte solo suma los `cash`; un abono digital mal clasificado cambia el esperado sin dejar rastro visible.
- **Cuánto cambio dejar para mañana.** La base se propone en $400.00 si no hay corte guardado; no hay cálculo de “lo que necesitas para cambio”, no toma la base inicial de hoy como punto de partida y no se valida contra lo contado.
- **Qué significa “Hoy”.** El número del encabezado de Caja incluye pendiente de cobro digital y excluye la parte fiada; no es “lo que vendí” ni “lo que tengo”. La persona tiene que aprender la fórmula o preguntar.
- **Si el corte ya quedó o se puede volver a tocar.** El aviso “Corte guardado” no se borra al editar los campos; puede seguir visible mientras la persona cambia el conteo.
- **Si un pago fue demo o efectivo real.** En modo demo, un pago demo con método efectivo se cuenta como efectivo en los totales y se etiqueta “Demo” en Actividad. El mismo dinero tiene dos nombres.

### 2.2 Lo que está en otra pantalla

| Para saber… | Hay que ir a… | Lo que se encuentra | Lo que falta |
|---|---|---|---|
| De qué fue la deuda | Caja → Actividad → detalle del pedido | Items y hora | No hay enlace desde Fiado; la deuda no muestra el pedido. |
| Cuánto se ha abonado | Ninguna pantalla | — | `credit_payments` y `audit_log` existen, pero no hay ruta/pantalla que los lea. |
| Gastos y retiros del día | Corte | Dos campos globales | No hay movimientos, hora, categoría ni comprobante. |
| Fiado de hoy vs histórico | Caja (encabezado) y Fiado | Ambos muestran el total histórico | No hay “fiado de hoy” ni “fiado del periodo”; el encabezado de Caja no sirve para separarlos. |
| Si el corte está cerrado | Ninguna pantalla | — | No hay estado de cierre. |
| Si el abono fue efectivo o digital | La hoja, en el momento | Selección | No se muestra después; no hay historial por método. |

### 2.3 Señales que se confunden

| Señal | Dónde | Qué suma realmente | Qué no es |
|---|---|---|---|
| **“Hoy”** | Encabezado de Caja (`caja-app.tsx:1102-1109`) | `cash + verified + demo + pending` | No es “vendido” (excluye la parte fiada) ni “cobrado” (incluye pendiente de cobro digital). |
| **“Por cobrar”** | Encabezado de Caja y tarjeta de “Mi negocio” | Pendiente bancario: `total - paid - credit` de pedidos del periodo | No es fiado. El fiado tiene su propia tarjeta. |
| **“Fiado”** | Encabezado de Caja; tarjeta de “Mi negocio” | `SUM(balance_cents)` de créditos no liquidados, **sin filtro de fecha** (`db.ts:618-620`, `analytics.ts:162-166`) | No es el fiado de hoy; puede incluir deudas de hace semanas. |
| **“Saldo pendiente”** | Encabezado/tarjeta de Fiado | `credits.balance_cents` vivo | — |
| **“Saldo pendiente”** | Detalle del pedido y hoja de pago (`2003-2008`, `4455-4460`) | `orders.credit_cents` original | No es el saldo vivo; no se actualiza con abonos. |
| **“Cobrado”** | Tarjeta de “Mi negocio” (`analytics.ts:197-200`) | Pagos de ventas de pedidos creados en el periodo | No incluye `credit_payments`; un abono de hoy a una deuda vieja no aparece. Incluye demo. |
| **“Ventas registradas”** | Tarjeta de “Mi negocio” (`analytics.ts:120`) | `SUM(total_cents)` de pedidos del periodo | Incluye fiado y pendiente; no es dinero cobrado. |
| **“Efectivo” vs “Demo”** | Actividad vs resumen/corte | Un pago demo con `method = cash` se suma a `cashCents` (`db.ts:594-600`) y a “Ventas en efectivo” (`cash.ts:62-69`), pero Actividad lo etiqueta “Demo” (`caja-app.tsx:3344-3415`) | El mismo pago tiene dos etiquetas; “Demo” no es un método de pago, es un proveedor. |
| **“Digital”** | “Cómo te pagaron” (`caja-app.tsx:2426-2453`) | Todos los pagos no-cash, sin separar demo de pey (`analytics.ts:152-160`) | No separa verificado por pey de simulado; la barra no dice cuál es cuál. |
| **“Pago mixto”** | Actividad | Efectivo + fiado (`hasCredit && received > 0`) | En el detalle del pedido, “Pago mixto” también puede significar efectivo + digital (`sourceMixed`). Dos combinaciones, la misma frase. |
| **“Entregado”** | Estado del pedido | `fulfilled`, que se asigna al crear un fiado cubierto (o al completar el pago de un mixto), sin confirmación de entrega (`orders.ts:110-115`) | No significa cobrado; el crédito sigue abierto. |
| **“1 cliente”** | Encabezado de Fiado | Cuenta de créditos, no de personas (`caja-app.tsx:3464-3466`) | Dos deudas de Juan dicen “2 clientes”. |
| **“Un abono no cuenta como dinero cobrado hoy”** | Hoja de abono (`caja-app.tsx:3696-3698`) | — | El corte **sí** suma los abonos en efectivo (`cash.ts:71-77`); el resumen no. La frase es cierta en una pantalla y falsa en otra. |

**El patrón:** la app calcula la aritmética, pero no decide el **significado**. “Hoy”, “Por cobrar”, “Fiado”, “Cobrado” y “Saldo” se usan como si fueran obvios; cada uno tiene una fórmula distinta y una fecha distinta. La persona tiene que reconciliar los nombres, no solo los números.

### 2.4 Decisiones que la app no toma por la persona

- ¿Este abono es total o parcial? La app precarga el total; no sugiere “mitad” ni “todo”.
- ¿Fue efectivo o digital? La app pone efectivo por defecto y la selección se distingue solo por color.
- ¿Este gasto es “gasto de caja” o “retiro”? Los dos restan igual; la diferencia es semántica y no se explica.
- ¿La base para mañana es posible? La app no compara base contra contado.
- ¿El conteo está completo? La app solo compara contra lo registrado; no sabe si faltó una venta o un gasto.
- ¿El corte ya se cerró? La app no tiene estado; el botón siempre dice “Guardar corte”.
- ¿Este “Hoy” es venta, cobro o efectivo? La app no lo dice en el encabezado.

---

## 3 · Interrupciones y recuperación

| Escenario | Qué pasa | Recuperación | Veredicto |
|---|---|---|---|
| **Refresh o recarga (o pestaña descartada) durante el conteo** | `load()` vuelve a pedir `/api/cash` y reemplaza `counted`, `expenses`, `withdrawals`, `baseNext` (`caja-app.tsx:2542-2564`). No hay borrador persistido. | Ninguna; se vuelve a contar. | **Pérdida silenciosa.** |
| **Cualquier venta o abono mientras se cuenta** | `loadDashboard` dispara `mercado:refresh` (`caja-app.tsx:225-237`); `CashCloseCard` escucha y llama `load()` (`2572-2576`). La tarjeta está montada aunque la pestaña esté oculta. | Se pierde el conteo; si había un corte guardado, se recarga el valor viejo. | **El escenario más probable en una jornada real.** |
| **Tocar el icono “Actualizar corte”** | Mismo `load()`; no pregunta si hay cambios. | Ninguna. | **El botón de refrescar es destructivo.** |
| **Cerrar la hoja de abono con cambios** | `requestClose` detecta `dirty` y muestra “Tienes un abono sin guardar” con “Seguir editando” / “Descartar abono” (`caja-app.tsx:3554-3601`). | Buena: el borrador sobrevive al cierre de la hoja. | **Bien resuelto a nivel hoja.** |
| **Refresh o cierre de pestaña con la hoja abierta** | El estado vive en el componente; no hay draft. | Ninguna. | **Se pierde el abono.** |
| **El crédito desaparece mientras la hoja está abierta** | `credit` se busca en `pendingCredits`; si otro proceso lo liquida, `credit` pasa a `null` y la hoja se cierra (`caja-app.tsx:1204-1205`). | Ninguna; no hay aviso de “alguien más lo cobró”. | **Cierre silencioso.** |
| **Abono parcial** | El servidor aplica `min(monto, saldo)` y responde con el saldo nuevo. La UI solo muestra “debe $X”; no muestra “se aplicaron $Y”. | Se puede volver a abonar, pero no hay historial. | **Aceptable si el monto ≤ saldo; opaco si no.** |
| **Sobrepago** | Se recorta al saldo (`orders.ts:245`). Si el cliente entregó más efectivo y el extra se queda en la caja, no queda registrado en ningún lado. | El corte mostrará “Sobra” por el efectivo físico; la persona puede pensar que contó mal. | **Riesgo de verdad, no solo de copy.** |
| **Doble envío / doble clic** | `creditPaying` deshabilita el botón mientras la petición está en vuelo, pero no hay llave de idempotencia. Dos pestañas, un reintento tras timeout o una respuesta perdida pueden insertar dos abonos parciales. | Ninguna; no hay reversa. | **Duplicación posible.** |
| **Crédito ya liquidado en otra pestaña** | El servidor convierte el monto en 0 y responde 200; la UI muestra “Abono registrado. Juan debe $0.00.” | Ninguna; no se registró nada. | **Falso éxito.** |
| **Error de red en el abono** | `friendlyError` agrega “Revisa tu conexión” (`caja-app.tsx:136-144`); la hoja conserva monto/nota. | Si la petición no llegó, reintentar es seguro; si llegó y se perdió la respuesta, reintentar duplica. | **No hay forma de saberlo desde la UI.** |
| **Error de red al crear la venta** | El pedido puede existir en el servidor, pero la UI muestra error y conserva el borrador. Al reintentar se crea otro pedido y otro crédito. | Ninguna; no hay llave de idempotencia. | **Deuda duplicada.** |
| **Error de red al guardar el corte** | La tarjeta conserva los valores; reintentar vuelve a hacer `UPSERT` sobre la misma fecha. | Si el primero llegó, el segundo reemplaza la misma fila; si cambió el esperado, el segundo guarda otro número. | **Reintento no idempotente en significado.** |
| **Medianoche con la app abierta** | `today` se calcula una vez al montar (`caja-app.tsx:239-264`); el corte guarda con la fecha que calcula el servidor en ese momento. Si se guarda después de medianoche, `closeCash` usa la fecha nueva y las ventas del día nuevo (`cash.ts:104-115`), aunque la persona esté contando el día anterior. | Ninguna advertencia. | **Corte en el día equivocado.** |
| **Dos pestañas guardando el corte** | `ON CONFLICT(date) DO UPDATE`; la última gana, sin versión ni conflicto. | Ninguna. | **Sobrescritura silenciosa.** |
| **Caída entre el `INSERT` y el `UPDATE` del abono** | No hay transacción (`orders.ts:248-257`). Puede quedar un `credit_payment` sin descontar del saldo. | Solo edición manual de la base. | **Inconsistencia durable.** |
| **Recargar tras contar por denominaciones** | `load()` no limpia `counts`; los campos de billetes conservan las cantidades viejas, pero `counted` se reemplaza por el valor guardado o vacío. | Si se edita una denominación, el total se recalcula con los conteos viejos. | **Estado inconsistente y fácil de no ver.** |
| **Modo demo → Reiniciar demo** | `resetDemoData()` borra cortes, créditos, pagos y auditoría (`db.ts:635-653`), pero solo si `isDemoMode()` (`api/demo/reset/route.ts:4-9`). | Es explícito y está protegido; en producción no existe. | **Aceptable en demo; no usar como prueba de persistencia.** |

---

## 4 · Riesgos de verdad

### 4.1 Tabla priorizada

| # | Riesgo | Qué se rompe | Severidad | Evidencia |
|---|---|---|---|---|
| R1 | **La voz o la muestra ejecutan un abono sin confirmación** | Se escribe dinero sin que la persona revise cliente, monto y método; el método se fuerza a efectivo; no hay idempotencia. | **Crítica** | E1 |
| R2 | **El abono no actualiza la orden y la UI muestra el original como si fuera vivo** | Dos saldos para la misma deuda; la actividad dice “Fiado” para siempre; el detalle contradice la libreta. | **Alta** | E2, E3 |
| R3 | **Los abonos quedan fuera del resumen y “Hoy” mezcla conceptos** | El abono en efectivo entra al corte pero no a “Hoy”/“Cobrado”/Actividad; el digital no entra a ningún resumen; “Hoy” incluye pendiente y excluye fiado. | **Alta** | E4, E5 |
| R4 | **El corte se sobrescribe sin historial ni auditoría** | Se pierde el corte anterior, su hora y su diferencia; no hay versión ni razón; dos pestañas se pisan. | **Alta** | E6, E7 |
| R5 | **El fiado nace “Entregado” y cuenta como pedido pagado** | `fulfilled` al crear; la analítica lo cuenta como pagado; el detalle puede titular “Pedido entregado” con deuda abierta. | **Alta** | E8 |
| R6 | **La base para mañana puede superar lo contado** | El día siguiente arranca con efectivo que no existe; puede arrastrar una “falta” permanente. | **Alta** | E8, E19, S7 |
| R7 | **El sobrepago se recorta en silencio** | El efectivo físico y el registro no cuadran; no hay cambio ni nota; el corte muestra “Sobra” sin explicación. | **Alta** | E2, E10 |
| R8 | **El método del abono se distingue solo por color y “Digital” es ambiguo** | Un toque equivocado cambia el efectivo esperado; no se puede corregir desde la UI ni ver después en la libreta. | **Media-Alta** | E11, S4 |
| R9 | **Los números del corte aceptan texto y separadores ambiguos** | “1,234” se interpreta como $1.23; “abc” como $0.00; se puede guardar un conteo absurdo. | **Media-Alta** | E12 |
| R10 | **La confirmación del corte no muestra gastos/retiros y el aviso usa un cálculo local** | Puede confirmarse un esperado que no es el que el servidor guarda; el aviso puede decir una diferencia distinta de la registrada. | **Media** | E13 |
| R11 | **Varias deudas del mismo cliente no se distinguen de forma fiable** | Se abona a la deuda equivocada; el encabezado cuenta créditos como clientes; la voz devuelve la primera. | **Media** | E14 |
| R12 | **Crear pedido y abonar no son transacciones** | Una caída deja pagos/créditos a medias; el reintento duplica. | **Media** | E15 |
| R13 | **No existe un cierre del día** | El corte es solo efectivo; no incluye fiado, pendiente de cobro digital, conciliación ni un estado “cerrado”. | **Alta** | E6, E16 |
| R14 | **El efectivo demo y el efectivo real comparten etiqueta** | Un pago demo con método efectivo se suma como efectivo y se etiqueta “Demo” en otra pantalla. | **Media** | E17, S1 |

### 4.2 Los cinco riesgos que el brief nombra, sin suavizar

**a) Abono que no actualiza la orden.** El servidor no toca `orders` al abonar (`orders.ts:235-266`). Eso, por sí solo, no es el bug: `orders.credit_cents` es el monto original y se usa para la verdad del pago (`orders.ts:210-218`). El bug es que la UI lo presenta como “Saldo pendiente” (`caja-app.tsx:2003-2008`, `4455-4460`) y que la actividad decide “Fiado” con `order.creditCents > 0` (`3976-3996`). El resultado es un pedido que sigue pareciendo deudor después de liquidado. **No lo arregles con un `UPDATE` a `orders.credit_cents`; arregla la lectura y muestra el original por separado.**

**b) Abonos fuera del resumen.** `getDailySummary` y `analytics` leen solo `payments` (`db.ts:581-600`, `analytics.ts:139-160`); el corte lee `payments` **y** `credit_payments` (`cash.ts:62-77`). Un abono en efectivo de $50:
- suma $50 al esperado del corte;
- **no** suma $50 a “Hoy”;
- **no** suma $50 a “Cobrado”;
- **no** aparece en Actividad;
- reduce “Fiado” en $50.
Un abono digital no aparece en ningún total de dinero recibido; solo reduce “Fiado”. La persona no puede reconciliar el dinero que acaba de recibir con ningún resumen.

El mismo problema aparece con un pago digital de un pedido creado ayer y confirmado hoy: `getDailySummary` y `analytics` filtran por `orders.created_at`, no por `payments.created_at` (`db.ts:581-587`, `analytics.ts:139-150`). Ese dinero no entra en el “Hoy” de hoy y, si se consulta ayer, se atribuye a ayer. El corte de efectivo no lo ve porque es digital. La fecha del movimiento no es la fecha del pedido.

**c) Método color-only.** En la hoja de abono, el radio real está `sr-only`; cada opción conserva su icono y su texto, y la única diferencia entre seleccionada y no seleccionada es borde/fondo/color verde (`caja-app.tsx:3631-3666`). No hay palomita, no hay texto “Elegido”, no hay `aria-pressed` visible. Un usuario con baja visión o daltonismo puede no saber cuál está seleccionado. El método decide si el abono entra al efectivo esperado; un error de selección no se puede detectar después porque la libreta no muestra el método.

**d) Corte sobrescrito.** `ON CONFLICT(date) DO UPDATE` reemplaza todos los campos de contenido, incluido `created_at` (`cash.ts:119-138`). No hay `audit("cash.close")`, no hay versión, no hay nota de corrección. La pantalla invita a “volver a contar y guardar de nuevo”. Dos guardados del mismo día dejan una sola fila; el primero desaparece. La ley “todo evento se conserva” (`GOAL.md:53-54`) no se cumple para el corte.

**e) Estado “entregado” prematuro.** `createOrder` pone `fulfilled` cuando `digitalDue <= 0` y hay fiado (`orders.ts:110-115`). `fulfillOrder` solo permite entregar pedidos `paid`/`demo_paid` (`orders.ts:268-282`), así que el fiado nunca pasa por una confirmación de entrega: ya está “entregado”. `analytics.paidOrderCount` cuenta `fulfilled` como pagado (`analytics.ts:123-128`); `getDailySummary.paidOrderCount` también (`db.ts:606-610`). `paymentSheetTitle` devuelve “Pedido entregado” antes de mirar el crédito (`caja-app.tsx:3998-4011`). La persona ve “entregado” y “saldo pendiente” en la misma hoja.

### 4.3 Contradicciones con los documentos

| Documento dice | El código/artefacto muestra | Evidencia |
|---|---|---|
| “Estados que no dependen solo del color” (`GOAL-ACOMPANAMIENTO.md:224`) | La selección de método del abono se distingue por borde/fondo/color; no hay marca textual ni palomita. | E11, S4 |
| “El corte cuadra contra pey… si no cuadra, se muestra la diferencia; no se esconde” (`GOAL.md:59-60`) | El corte guardado es solo efectivo; la conciliación con pey es una tarjeta aparte que no se guarda; el corte se puede sobrescribir sin auditoría. | E6, E16 |
| “Una sola fuente de verdad… un pago pendiente no es ingreso” (`GOAL.md:65-66`) | “Hoy” suma `pendingCents` (dinero que no llegó) y excluye la parte fiada; el abono vive en dos libros. | E4, E18 |
| “Todo evento se conserva” (`GOAL.md:53-54`) | El corte del día se reemplaza con `ON CONFLICT(date) DO UPDATE`; no hay versión ni `audit_log`. | E6 |
| “Un cobro no se reintenta ni se duplica sin que la persona lo sepa” (`GOAL-ACOMPANAMIENTO.md:81`) | El abono no tiene idempotencia; un reintento tras una respuesta perdida puede insertar otro abono. | E2, E15 |
| “Continuidad… recuperar una operación interrumpida… corregir con trazabilidad” (`GOAL-ACOMPANAMIENTO.md:177-179`) | El conteo se borra con el refresh; el abono no tiene reversa; el corte se corrige sobrescribiendo. | E7, E20 |
| “El resumen de cierre usa solo movimientos registrados y marca lo que falta” (`GOAL-ACOMPANAMIENTO.md:301`) | No hay resumen de cierre; el corte no marca fiado, pendiente de cobro digital ni movimientos faltantes. | E16, S7 |
| “Corte de caja… probado; el corte cuadra” (`GOAL.md:120`) | El caso feliz cuadra; también se puede guardar $1.00 contra $570.00 sin motivo y reemplazar el día. | S7, S9 |

Estas no son diferencias de redacción: son funciones que el documento da por resueltas y el flujo no resuelve. El estado “probado” del corte debe leerse como “el caso feliz del ensayo se ve bien”, no como “el corte es confiable”.

---

## 5 · Candidatos P0 (máximo 5)

**Escala de esfuerzo:** S ≤ 4 h · M ≤ 1 día · L > 1 día (un dev que ya conoce el código).
**Escala de riesgo:** Bajo = cambio localizado con prueba; Medio = toca UI/estado y puede romper un gate; Alto = cambia definiciones de dinero o requiere migración.

| # | Candidato | Tipo | Impacto | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| 1 | **Confirmar el abono antes de escribirlo** | copy/estado + persistencia | Crítico: elimina la única escritura financiera sin revisión y el método forzado | M | Medio |
| 2 | **Una sola cuenta de fiado, viva y explicable** | copy/estado + nuevo módulo pequeño (detalle) | Alto: elimina los dos saldos y permite elegir/cobrar la deuda correcta | M | Medio |
| 3 | **El abono entra al resumen; “Hoy” se parte en vendido/cobrado** | persistencia | Alto: el dinero recibido deja de ser invisible y los totales se pueden reconciliar | L | Alto |
| 4 | **Corte no destructivo y cierre versionado** | persistencia | Alto: no se pierde el conteo, no se sobrescribe el día, la base no crea efectivo fantasma | M–L | Medio |
| 5 | **Estado del pedido separado del cobro** | persistencia + copy/estado | Alto: “entregado” deja de significar “pagado” y la analítica no cuenta fiado como cobrado | M | Medio |

### P0-1 · Confirmar el abono antes de escribirlo

**Qué cambia:** `interpretText` deja de hacer `POST` para `credit_payment`. En su lugar abre la misma hoja de abono con:
- cliente (si hay ambigüedad, elegir entre las deudas abiertas);
- saldo vivo;
- monto interpretado y monto que se aplicará;
- si el monto supera el saldo, “el cliente dio $X; se aplican $Y; devuelve $Z” o bloqueo explícito;
- método **sin default silencioso**: efectivo / transferencia-CoDi / tarjeta, con una marca visible que no dependa del color;
- nota opcional.

El chip de muestra puede seguir prellenando la hoja, pero **no ejecuta**. El `POST` solo ocurre tras “Registrar abono”. Añadir una llave de idempotencia (`requestId`) y devolver `appliedCents`, `balanceCents` y `overpayCents`; si el saldo cambió, responder 409 y pedir revisión.

**Por qué primero:** es la única mutación financiera que hoy ocurre sin que la persona revise el monto, el cliente y el método. Un parser puede equivocarse; la app no debe convertir una frase en una deuda cobrada. También resuelve el sobrepago, el método forzado y el doble envío en el mismo punto.

**Esfuerzo/riesgo:** M / Medio. Reutiliza `CreditPaySheet` y la ruta existente; el mayor riesgo es que la demo y `mobile-audit.py:196-199` dependen del abono de un toque. Hay que actualizar el guion y la prueba, no eliminar la voz.

**Aceptación:**
- Decir “Juan me pagó 50” no cambia `credit.balance_cents` hasta confirmar.
- Cancelar deja el saldo intacto.
- Confirmar registra exactamente un abono, con el método elegido y visible.
- Un sobrepago no se recorta en silencio.
- Un reintento con la misma llave no duplica.
- La hoja muestra el saldo vivo, no el original.

### P0-2 · Una sola cuenta de fiado, viva y explicable

**Qué cambia:**
- La libreta muestra, por deuda: original, abonado, saldo vivo, fecha (no solo hora), pedido/items si existe, y un detalle con los abonos (`credit_payments` ya existe).
- Agrupa por cliente o al menos muestra un identificador estable; el encabezado cuenta **personas**, no créditos.
- El detalle del pedido y la actividad leen el crédito vivo (`credits.balance_cents/status`) y muestran “Saldado” cuando corresponde; nunca “Saldo pendiente” con el original.
- La voz consulta todas las deudas abiertas del cliente y suma; si hay ambigüedad, pregunta.
- `orders.credit_cents` se conserva como **monto original** (o se renombra en la lectura) y no se muta al abonar.

**Por qué:** hoy la misma deuda tiene dos números y la persona no puede explicar el saldo ni elegir la deuda correcta. Es la carga cognitiva más repetida: “¿cuánto me debe Juan?” no tiene una respuesta única en la app.

**Esfuerzo/riesgo:** M / Medio. No requiere tabla nueva; requiere una ruta de detalle o incluir los abonos en `/api/credits`, y cambiar varias lecturas de UI. El riesgo es romper la estética de la libreta y el rendimiento con muchas deudas; se puede resolver con un detalle expandible.

**Aceptación:**
- Un pedido de $100 con abono de $50 muestra $50 en Fiado, en el detalle y en Actividad; el original sigue visible como “original $100”.
- Un crédito liquidado dice “Saldado” y no aparece como deuda pendiente, pero su historial sigue consultable.
- Dos deudas de Juan se distinguen por fecha/pedido; el encabezado dice “1 cliente”.
- La voz “¿cuánto me debe Juan?” suma las dos deudas, no devuelve la primera.

### P0-3 · El abono entra al resumen; “Hoy” se parte en vendido/cobrado

**Qué cambia:** una definición escrita y una sola fuente para el dinero:

| Concepto | Fórmula | Dónde se muestra |
|---|---|---|
| **Vendido** | `SUM(orders.total_cents)` del periodo, excluyendo cancelados | Caja/BusinessOverview, con la nota “incluye fiado y pendiente”. |
| **Cobrado** | `payments` + `credit_payments` por **fecha de movimiento**, no por fecha del pedido | Caja/BusinessOverview, con línea “Abonos de fiado”. |
| **Por cobrar digital** | `total - paid - credit` de pedidos del periodo | Tarjeta separada; nunca junto a “Fiado”. |
| **Fiado** | `SUM(credits.balance_cents)` histórico, con sublínea “de hoy” | Tarjeta separada; etiqueta “histórico”. |
| **En caja** | Efectivo recibido − gastos/retiros, o el esperado del corte | Corte; no mezclarlo con “Cobrado”. |

**Por qué:** hoy “Hoy” = cobrado + pendiente de cobro digital, excluye la parte fiada; “Cobrado” excluye abonos; “Fiado” es histórico. El comerciante no puede responder “¿cuánto vendí, cuánto cobré y cuánto me deben?” sin hacer su propia reconciliación.

**Esfuerzo/riesgo:** L / Alto. Toca `getDailySummary`, `analytics`, `cash` y varias tarjetas; cambia números que la demo y las capturas ya muestran. No se debe hacer sin una matriz de pruebas de fiado/corte. Se puede escalonar: primero una línea “Abonos de fiado” visible, después la redefinición de “Hoy”.

**Aceptación:**
- Un abono en efectivo de $50 aumenta “Cobrado” y el esperado del corte en $50, y aparece en Actividad.
- Un abono digital aumenta “Cobrado digital” pero no el efectivo esperado.
- “Vendido” incluye el fiado; “Cobrado” no.
- “Hoy” tiene una etiqueta que dice qué es; no hay dos “Hoy” con fórmulas distintas en la misma pestaña.
- La suma de las tarjetas no se puede leer como si todas fueran del mismo periodo.

### P0-4 · Corte no destructivo y cierre versionado

**Qué cambia:**
1. **Borrador:** `counted`, `expenses`, `withdrawals`, `baseNext` y el desglose se guardan en un draft local por fecha; `load()` no los pisa si están sucios. El icono de refrescar y `mercado:refresh` piden confirmación o preservan el draft. Los `counts` se limpian junto con el total para no quedar desincronizados.
2. **Validación:** `counted` debe ser numérico y parsear de forma inequívoca (rechazar o interpretar “1,234” correctamente); `baseNext <= counted`; diferencia distinta de cero pide una nota o motivo; una diferencia grande muestra una advertencia explícita, no solo “Falta”.
3. **Cierre versionado:** guardar crea una versión inmutable (o una fila con `status` y `version`); “corregir” crea otra versión con motivo; nunca se reemplaza `created_at`; cada guardado deja `audit("cash.close")`.
4. **Cierre real:** después de guardar, el día muestra “Cerrado” y un resumen de una pantalla: efectivo contado/esperado/diferencia, base que se queda, adicional a retirar, fiado histórico y de hoy, pendiente de cobro digital. Si hay movimientos posteriores, se muestran como “posteriores al cierre” y no cambian la foto guardada.
5. **Confirmación honesta:** la hoja muestra gastos, retiros, base y desglose; el aviso usa la respuesta del servidor (`data.close.differenceCents`), no el cálculo local.

**Por qué:** hoy un refresh borra el conteo, el botón de refrescar lo borra, el guardado reemplaza el día y la base puede crear efectivo fantasma. Sin esto, “corte” no es una operación confiable; es una calculadora con memoria frágil.

**Esfuerzo/riesgo:** M–L / Medio. El borrador y las validaciones son S–M; la versión/auditoría y el resumen de cierre son M. Hay migración de datos y que actualizar la demo/HIG. Se puede partir en 4a (borrador + validación + base) y 4b (versión + cierre).

**Aceptación:**
- Contar, provocar una venta/refresh, volver: el conteo sigue.
- Base 400 con contado 1: se bloquea o se advierte; no se guarda una base imposible.
- Guardar dos veces: hay dos versiones o la segunda exige “Corregir” con motivo; la primera no desaparece.
- Después del cierre, una venta nueva no altera el esperado guardado; se muestra como posterior.
- El aviso “Corte guardado: falta $X” coincide con la fila guardada.
- `audit_log` tiene un evento de corte.

### P0-5 · Estado del pedido separado del cobro

**Qué cambia:**
- Un pedido con fiado **no** nace `fulfilled`. Nace `confirmed` (o un estado nuevo `credit_open`) y permanece “Fiado · pendiente de entrega”.
- La entrega es una acción explícita e independiente del pago: “Entregar” registra `delivered_at`/evento; no se infiere de que el pedido esté cubierto.
- `fulfillOrder` deja de ser el único camino; un pedido con crédito puede entregarse sin estar `paid`, y uno pagado puede esperar entrega.
- `analytics.paidOrderCount` y `getDailySummary.paidOrderCount` cuentan pagos, no `fulfilled`; el fiado no entra como “pedido pagado”.
- `paymentSheetTitle` no dice “Pedido entregado” si hay crédito abierto; muestra “Fiado” y el estado de entrega por separado.
- Los pedidos históricos con `fulfilled` + crédito se migran con un criterio explícito (probablemente “entregado” solo si hay evidencia; si no, “pendiente de entrega”) y se documenta.

**Por qué:** hoy “entregado” y “cobrado” son el mismo campo. Un fiado nace entregado y cuenta como pagado; la persona no puede saber si el cliente se llevó la mercancía ni si pagó.

**Esfuerzo/riesgo:** M / Medio. Toca la máquina de estados, la analítica y los textos; el contrato de pago del webhook y el checkout no debería cambiar, pero hay que revisar `recordPayment` en pedidos mixtos y probar los estados efectivo + fiado + digital. La migración de filas viejas es el punto delicado.

**Aceptación:**
- Un fiado puro muestra “Fiado · pendiente de entrega”, no “Entregado”.
- “Entregar” y “Cobrar” son acciones/estados distintos; cada una deja su evento.
- La analítica no cuenta el fiado como pedido pagado.
- Un pedido pagado y no entregado no se muestra como entregado.
- Los pedidos viejos tienen un estado migrado explicable.

### Lo que no entra en estos 5

- **Movimientos de caja en el momento** (gastos/retiros con hora y categoría): es el mayor alivio de memoria, pero es un módulo nuevo y no cabe en P0. Candidato P1; mientras tanto, el corte debe decir “solo se registran al guardar” y pedir una nota.
- **Historial/exportación de cortes:** P1; la tabla ya tiene fechas, falta la ruta y la pantalla.
- **Reversa/corrección de un abono con trazabilidad:** debe diseñarse junto con P0-1/P0-2; no como borrado.
- **Recordatorios de fiado a terceros:** fuera de alcance sin consentimiento (`GOAL-ACOMPANAMIENTO.md:77`).
- **Reconciliación de pey dentro del corte guardado:** P1; hoy es una tarjeta aparte que no queda en el cierre.

---

## 6 · Evidencia

### 6.1 Código

| ID | Archivo:línea | Qué prueba |
|---|---|---|
| E1 | `web/src/components/caja-app.tsx:103-113`, `1151-1155`, `604-632`; `web/src/lib/voice.ts:21-38`, `70-101`, `161-175`; `web/scripts/mobile-audit.py:196-199` | La muestra/voz de abono ejecuta `POST` directo, con `method: "cash"`, sin hoja ni confirmación; el gate móvil lo exige. |
| E2 | `web/src/lib/orders.ts:235-266` | El abono recorta al saldo, inserta `credit_payments`, actualiza `credits`, **no toca `orders`**, no usa transacción ni idempotencia. |
| E3 | `web/src/components/caja-app.tsx:3976-3996`, `2003-2008`, `4455-4460`, `3998-4011` | `hasCredit` se deriva de `order.creditCents` original; el detalle y la hoja muestran el original; el título “Pedido entregado” gana sobre el crédito. |
| E4 | `web/src/components/caja-app.tsx:1102-1109`; `web/src/lib/db.ts:577-633`; `web/src/lib/analytics.ts:110-219` | “Hoy” = cash + verified + demo + pending, sin credit; “Cobrado” = solo `payments`; “Fiado” = histórico sin fecha. |
| E5 | `web/src/lib/orders.ts:110-115`; `web/src/lib/analytics.ts:123-128`; `web/src/lib/db.ts:606-610` | Un fiado nace `fulfilled` y se cuenta en `paidOrderCount`. |
| E6 | `web/src/lib/cash.ts:97-156`; `web/src/components/caja-app.tsx:2606-2644` | `ON CONFLICT(date) DO UPDATE` reemplaza los campos de contenido, incluido `created_at`; no hay `audit()`; el aviso usa la diferencia local. |
| E7 | `web/src/components/caja-app.tsx:2542-2576`, `225-237` | `load()` reemplaza el conteo; `mercado:refresh` se dispara tras ventas/abonos y la tarjeta está montada aunque la pestaña esté oculta. |
| E8 | `web/src/components/caja-app.tsx:2578-2594`, `2857-2875`, `2906-2968` | Cálculo de esperado/base; `withdrawalNext = max(0, contado - base)`; la hoja de confirmación no muestra gastos/retiros ni pide motivo. |
| E9 | `web/src/components/caja-app.tsx:2695-2711`, `130-134` | “Total contado” es texto; `parseMoney` interpreta mal comas y acepta letras. |
| E10 | `web/src/lib/orders.ts:245`; `web/src/components/caja-app.tsx:986-994` | El sobrepago se recorta; la UI solo reporta el saldo nuevo, no el monto aplicado. |
| E11 | `web/src/components/caja-app.tsx:3631-3666`, `3686-3698` | La selección de método es color/borde con radio `sr-only`; “Digital” es una sola opción; el copy dice que no cuenta como cobrado hoy. |
| E12 | `web/src/components/caja-app.tsx:3453-3466`, `3493-3503`; `web/src/lib/format.ts:17-22` | El encabezado cuenta créditos; la tarjeta muestra solo hora y saldo; no muestra original ni historial. |
| E13 | `web/src/components/caja-app.tsx:2631-2638`; `web/src/lib/cash.ts:113-115` | El servidor recalcula el esperado; el aviso/toast usan la diferencia local anterior al `POST`. |
| E14 | `web/src/components/caja-app.tsx:549-557`, `604-611`; `web/src/lib/db.ts:512-530` | La voz y las consultas toman la primera coincidencia por subcadena; el alta de cliente solo deduplica por `lower(name)`. |
| E15 | `web/src/lib/orders.ts:59-108`, `248-257` | Pedido/items/pago/crédito y abono insert/update no están envueltos en transacción. |
| E16 | `web/src/components/caja-app.tsx:2877-2882`, `1225-1241`; `web/src/lib/cash.ts:39-60` | No hay estado de cierre; solo una fila por fecha y un texto que invita a volver a guardar; no hay ruta de historial. |
| E17 | `web/src/components/caja-app.tsx:3976-3996`; `web/src/lib/db.ts:594-600`; `web/src/lib/cash.ts:62-69`; `web/src/components/caja-app.tsx:3344-3415` | Un pago demo con método efectivo se suma como efectivo en los totales y se etiqueta “Demo” en Actividad. |
| E18 | `web/src/lib/analytics.ts:197-200`; `web/src/lib/db.ts:581-600` | “Cobrado” suma `payments` de pedidos del periodo; no incluye `credit_payments`; un abono o un pago digital de hoy a un pedido viejo no aparece en el periodo del movimiento. |
| E19 | `web/src/lib/cash.ts:51-60`, `108`, `113-116` | La base inicial se toma del último `base_next` o de la fila guardada; el servidor acepta `openingCents` del cliente; no valida `baseNext <= counted`. |
| E20 | `web/scripts/rehearse-demo.py:99-112`; `harness/EVALS.md:16-20` | El ensayo cuenta por denominaciones y guarda; no prueba refresh, sobrepago, doble envío, abono parcial ni sobrescritura. |
| E21 | `GOAL.md:53-54`, `59-60`, `65-66`, `84`, `120`; `GOAL-ACOMPANAMIENTO.md:81`, `177-179`, `224`, `301` | Los invariantes y el estado “probado” del corte no coinciden con lo que hace el flujo; ver §4.3. |

### 6.2 Capturas

| ID | Archivo | Qué se ve |
|---|---|---|
| S1 | `demo/mobile-360-full.png` | Caja: “Hoy $190.00 · Por cobrar $120.00 · Fiado $50.00”; Actividad muestra “Esperando al banco” y “Demo”/“Efectivo”. “Hoy” incluye $120 que no se ha cobrado. |
| S2 | `demo/hig-after/fiado-1280.png` | Una deuda de Juan, “Pendiente · desde 02:01 p.m.”, “1 cliente”, solo saldo. No hay fecha, original ni historial. |
| S3 | `demo/hig-after/fiado-360.png` | Lo mismo a 360 px; el texto largo de la libreta empuja el contenido y la deuda sigue sin fecha. |
| S4 | `demo/hig-after/fiado-sheet-360.png` | Monto precargado al saldo completo; efectivo seleccionado; “Digital” como alternativa; copy “no cuenta como dinero cobrado hoy”. |
| S5 | `demo/hig-after/corte-1280.png` | “Total contado” vacío; base $500 + ventas $70 = $570; “Contar por billetes” y el desglose debajo. |
| S6 | `demo/mobile-360-corte.png` | El esperado incluye “Abonos de fiado en efectivo $50.00”; el desglose queda debajo del pliegue y la nav inferior tapa parte del contenido. |
| S7 | `demo/hig-after/corte-confirm-1280.png` | $1.00 contado contra $570.00 esperado, “Falta $569.00”, botón “Guardar corte” habilitado; no se ven gastos/retiros ni un motivo. |
| S8 | `demo/hig-after/corte-confirm-360.png` | La misma confirmación en 360 px; el desglose del esperado queda detrás de la hoja, invisible. |
| S9 | `demo/demo-step-4-corte.png` | $570.00 contado, “Cuadra”, esperado $570.00; el caso feliz del ensayo. |

### 6.3 Lecturas read-only del servidor y la base

| Consulta | Resultado | Qué confirma |
|---|---|---|
| `GET /api/dashboard` | `demoMode: true`; `cashCents: 7000`; `pendingCents: 12000`; `creditCents: 5000`; `orderCount: 2`; `paidOrderCount: 1`; crédito de Juan $50 con `orderId: null`. | “Hoy” sería 19000 centavos ($190.00); “Cobrado” 7000 ($70.00); el hueco es pendiente de cobro digital, no fiado. |
| `GET /api/cash` | `openingCents: 50000`; `cashSalesCents: 7000`; `cashCreditCents: 0`; `expectedCents: 57000`; `saved: null`. | El corte de hoy no está guardado; el esperado coincide con base + ventas. |
| `GET /api/analytics?period=today` | `salesCents: 19000`; `collectedCents: 7000`; `pendingCents: 12000`; `creditCents: 5000`; `orderCount: 2`; `paidOrderCount: 1`. | “Ventas registradas” incluye 12000 centavos ($120.00) pendientes; “Cobrado” no; “Fiado” es histórico. |
| SQLite read-only | `cash_closes` solo tiene `2026-10-31` (seed, contado 50000, base 50000); `credit_payments` tiene 0 filas. | No había un abono real en esta base al auditar; el efecto del abono se prueba por código y capturas de corridas previas. |

**Nota:** las capturas son artefactos de corridas anteriores; las cadenas visibles coinciden con el código actual, pero no prueban por sí solas el estado de la base en este momento. Las lecturas read-only son del proceso vivo, no de un build reiniciado.

---

## 7 · Lo que no pude verificar

- **No hay navegador de escritorio conectado** en esta sesión. No pude recorrer la app a mano, provocar el refresh, abrir dos pestañas ni simular una respuesta perdida; esas conclusiones son lectura de código.
- **No corrí Playwright, `verify:*` ni ningún gate**, por instrucción. No ejecuté `mobile-audit.py`, `rehearse-demo.py` ni `hig-after-audit.py`; solo leí sus aserciones y miré las capturas.
- **No muté la demo.** No registré un abono real, no guardé un corte, no creé un pedido a fiado. Por eso el estado exacto “después de un abono parcial” se deriva del código, no de una observación en esta base. `credit_payments` estaba vacío.
- **No verifiqué el proceso `:3000` contra el commit `26d06ce`.** No lo reinicié. Las lecturas read-only son del proceso que ya estaba vivo; el árbol de trabajo está limpio y las referencias son del código actual.
- **No probé teléfono físico, TalkBack/VoiceOver, 200% interactivo ni alto contraste con personas.** Las capturas de `hig-after` muestran el layout, no la experiencia con lector de pantalla.
- **No probé concurrencia real, caída entre `INSERT`/`UPDATE`, cambio de medianoche ni corrupción de SQLite.** Son inferencias del código y del esquema.
- **No medí carga con NASA-TLX ni con comerciantes.** No afirmo porcentajes de reducción de estrés, tiempo o errores; este documento describe pasos, campos, decisiones y riesgos observables.
- **No revisé a fondo venta, meta, verificación ni checkout**, salvo las interfaces que tocan fiado/corte. La auditoría completa de F0 queda fuera de este recorte.
- **No verifiqué si las capturas fueron generadas exactamente en `26d06ce`.** Coinciden con los textos y estados del código; se usan como apoyo, no como prueba de la base actual.
- **No verifiqué la conciliación real con pey**; en demo no hay transacciones reales y el bloqueo de BBVA/CoDi sigue abierto (`harness/STATE.md:56-58`).

---

## 8 · Orden de ataque

1. **Antes de tocar P0, escribir una prueba de verdad de fiado/corte** que hoy no existe: crear fiado, abonar parcial, verificar el mismo saldo en libreta/detalle/actividad/resumen/corte; guardar corte dos veces; refrescar durante el conteo. Los gates actuales prueban que la pantalla se puede tocar, no que el dinero cuadre.
2. **P0-1** (confirmación del abono). Es el riesgo irreversible y el más barato de cerrar.
3. **P0-2** (saldo vivo). Sin esto, cualquier arreglo de resumen sigue mostrando dos verdades.
4. **P0-4a** (borrador + validación de base). Es la interrupción más probable y no requiere cambiar la definición de los totales.
5. **P0-3** (resumen) con una definición escrita y una matriz de pruebas; es el cambio de mayor riesgo y el que más puede romper la demo.
6. **P0-5** (estado entregado) al final, con migración de pedidos históricos.

Si solo hay tiempo para una cosa: **P0-1**. Si hay tiempo para dos: **P0-1 + P0-2**. No se puede declarar “corte probado” mientras el refresh borre el conteo, el guardado sobrescriba el día y la base pueda superar lo contado.
