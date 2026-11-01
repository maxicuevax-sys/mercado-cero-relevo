# Verificación independiente — Mercado Cero F3 (tercera revisión final)

> **Worktree:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-hig`
> **Rama:** `hig-redesign` · **HEAD:** `0355307` · **código verificado:** `36064d4`
> **Servidor:** `http://localhost:3001` · **DEMO_MODE:** activo
> **Fecha:** 31 de octubre de 2026
>
> **VEREDICTO: NO LISTO para F4.**
>
> No acepté `VERIFICACION-INDEPENDIENTE.md` ni sus secciones de reparación como prueba. Leí `HIG-DESIGN.md`, `VERIFICACION-F3-FINAL.md` y `VERIFICACION-F3-FINAL-2.md`, y reproduje la API, la UI, el foco, el 200% y el audit contra este HEAD. No modifiqué `src`, API, libs, CSS ni scripts.

---

## 1 · Resumen

Los tres bloqueantes del segundo informe **sí están reparados en lo esencial**:

1. **Mixto efectivo + digital:** ya no se muestra como demo puro. Actividad dice “Efectivo + demo”, el sheet dice “Pago mixto”, el cuerpo separa `$30.00 en efectivo` de `$60.00 demo`, y `/pay` y `/success` repiten la separación. No aparece “No se movió dinero real”.
2. **Entrega desde Actividad:** un pedido pagado reabierto desde Actividad ofrece “Listo para entregar”; el `PATCH fulfill` deja `paid → fulfilled`, cierra el sheet y devuelve el foco a la fila.
3. **Fiado con 4+ clientes:** ya no hay scroll horizontal. Con 9 clientes, `document.documentElement.scrollWidth` es 360/360 y 390/390 en 360/390. El resumen y el contador caben.

También siguen reparados los bloqueantes del primer informe: verdad de efectivo/demo, `Shift+Tab`, backdrop, checkout 40→80 px, badge de espera y botón Cerrar de Verificar.

Pero F3 **sigue sin pasar el gate** por problemas de 200% que no estaban cubiertos por las pruebas anteriores:

- **B4 (nuevo):** encabezados que se solapan consigo mismos o con el contenido en Caja, Meta, Corte, el `PaymentPanel` pagado y el `PaidSheet`. La causa es el `line-height: 24px` fijo del `body` frente a tamaños en `rem` que sí crecen al 200%.
- **B5 (nuevo):** el monto de la analítica de Corte se recorta a 360 (y, con datos reales, también a 390). El audit oficial lo detecta a 360: `clipped viewport “$2,092.00”` y `“Ventas registradas · Hoy”`.
- **B6 (residual del bloqueante de Fiado):** con 9 clientes, a 360 los nombres se truncan a `Cliente Cuatr…` y cuatro clientes distintos quedan indistinguibles. A 390 todavía se truncan tres nombres largos. El scroll horizontal se arregló; la pérdida de texto esencial al 200% no.

El audit oficial ahora **sí** detecta recortes por ancestro, contenido totalmente recortado, controles colapsados, viewport expandido y sheets/Demo/éxito al 200%; además sale **exit 1** por el Corte 360. Pero sigue sin detectar solapes de texto por `line-height` y marca la truncación de Fiado como intencional. Por eso no puede ser la única puerta de F4.

---

## 2 · Método

### 2.1 Comandos y entorno

| Comprobación | Resultado |
|---|---|
| `git status` al iniciar | limpio; HEAD `0355307`; código de UI/API en `36064d4` |
| `git diff --stat a13270f..36064d4` | 4 archivos: `caja-app.tsx`, `checkout-client.tsx`, `success-client.tsx`, `hig-after-audit.py` |
| `npm run lint` | **pass** |
| `npx tsc --noEmit` | **pass** |
| `npm run build` | **pass** (20 rutas generadas; servidor 3001 detenido y restaurado) |
| `BASE_URL=http://localhost:3001 node scripts/webhook-contract.mjs` | **27/27**, exit 0 |
| `python scripts/hig-after-audit.py` | **exit 1**, 2 hallazgos (Corte 360 al 200%) |
| `http://localhost:3000` | 200; mismo proceso `next start` PID 49176, misma respuesta (len 38145, hash `D6055C…361C`), no se tocó |
| `http://localhost:3001` | 200; dev server restaurado (PID 38072) |

Durante la verificación apareció una nota de dos líneas en `VERIFICACION-F3-FINAL-2.md` (20:52) que **no escribí** y que no usé como evidencia. El único archivo versionable que añado es este informe.

### 2.2 Pruebas propias

- **Playwright 1.64 / Chromium headless** con viewports 360×800, 390×844, 768×1024 y 1280×900.
- API real del puerto 3001 y lectura puntual de SQLite para comprobar persistencia de abonos.
- Webhook firmado con el secreto de `.env.local` leído sin imprimirlo.
- Para el 200%: `html { font-size: 200% !important; }`, el mismo método que usa el audit oficial.
- Suite de verdad de pago: **162/163** aserciones en verde. La única roja fue una expectativa mía de copy (`$30.00 a fiado` frente a `Quedó a fiado: $30.00`), no un fallo de la app.
- Foco: **130/130**.
- Entrega: **13/13** en la suite dedicada, más `PATCH` 409/idempotente por API.
- Fiado: **15** comprobaciones; el cierre del sheet tarda ~2.5 s con el servidor de desarrollo, pero cierra y persiste el abono.
- Corte normal: **10/10**.
- Contrato básico (tabs, sidebar, subtítulos, TopBar, foto de Meta, h1): **25/25**.
- Resto de contrato (error inline, Verificar, checkout 40/80, aria-busy, redirect): **18** comprobaciones; 17 en verde y el único rojo fue un límite de mi interceptación síncrona de Playwright, no la app. El `aria-busy` de entrega está presente en el código y se observó el de pago y el de abono.
- 200%: **60 estados** medidos en los cuatro viewports; además capturas y medición dirigida de Caja, Meta, Corte, Fiado, `PaidSheet` y `PaymentPanel`.

---

## 3 · Verdad de pago, entrega y foco

### 3.1 Verdad de pago (todo reproducido de nuevo)

La tabla usa la API real después del `POST /api/orders` correspondiente.

| Caso | API observada | UI de la comerciante | `/pay` y `/success` | Resultado |
|---|---|---|---|---|
| Efectivo puro | `paid`; `provider=cash`; `paid=9000`; `digital=0` | “Efectivo”; sheet “Efectivo recibido / Cobrado en caja / sin pasar por pey” | “Efectivo recibido”; “No pasó por pey”; sin “Pago verificado” ni demo | **Pasa** |
| Efectivo + fiado | `fulfilled`; `paid=3000`; `credit=6000`; `provider=cash` | “Pago mixto”; sheet “Cobro mixto / Quedó anotado / $30.00 en efectivo + $60.00 a fiado” | “Cobro mixto / Quedó anotado”; saldo `$60.00`; sin “No se movió” | **Pasa** |
| Fiado puro | `fulfilled`; `paid=0`; `credit=9000`; sin payment | “Fiado”; “Venta a fiado / Quedó anotado” | “Quedó anotado”; “no es dinero recibido” | **Pasa** |
| Demo puro | `paid`; `provider=demo`; `digital=9000` | “Demo” en attention; sheet “Pago simulado / simulado en modo demo” | “Pago simulado”; sin “confirmado por pey” | **Pasa** |
| Webhook firmado | `paid`; `provider=pey`; `digital=9000` | “Pagado” en verde; “Pago verificado”; “confirmado por pey” | “Pago confirmado / Listo para entregar” | **Pasa** |
| Digital + fiado | `fulfilled`; `paid=9000`; `digital=9000`; `credit=3000`; `provider=demo` | “Pago mixto”; “Cobro mixto / Quedó anotado”; `$90.00 demo + $30.00 a fiado` | “Cobro mixto / Quedó anotado”; saldo `$30.00` | **Pasa** |
| **Efectivo + digital** | `paid`; `paid=9000`; `digital=6000`; `credit=0`; `provider=demo` | “Efectivo + demo”; sheet “Pago mixto”; cuerpo: “Recibiste $30.00 en efectivo y $60.00 en un pago simulado. El efectivo sí es dinero real; el digital es demo.” | “Pago mixto”; “Efectivo + CoDi”; mismo cuerpo; **no** “No se movió dinero real” | **Pasa** |
| Efectivo + digital verificado | `paid`; `paid=9000`; `digital=6000`; `provider=pey` | “Efectivo + pey”; sheet “Efectivo + verificado”; “Recibiste $30.00 en efectivo y $60.00 verificados por pey.” | “Pago mixto / Efectivo + verificado”; sin “simulado” | **Pasa** |
| Efectivo + demo + fiado | `fulfilled`; `paid=9000`; `digital=6000`; `credit=3000`; `provider=demo` | “Pago mixto”; “Cobro mixto / Quedó anotado”; `$30.00 en efectivo + $60.00 demo + $30.00 a fiado` | “Cobro mixto / Quedó anotado”; separa las tres fuentes | **Pasa** |

El caso efectivo + digital era el bloqueante B1 del segundo informe: **queda cerrado**. El demo puro sigue usando attention y no verde; el webhook sigue siendo el único “Pago verificado / Pagado” verde.

Evidencia principal: `truth-clean-results.json`, `truth-ui-results.json`, `mixed-cash-digital-sheet.png`, `mixed-cash-digital-pay.png`, `cash-sheet.png`, `demo-sheet.png`.

### 3.2 Entrega

- **Desde el `PaidSheet` inmediato:** “Listo para entregar” → `PATCH /api/orders/{id}` `{action:"fulfill"}`; `paid → fulfilled`; sheet cerrado; foco al row/h1. **Pasa**.
- **Desde un pedido pagado reabierto en Actividad:** el sheet ya tiene “Listo para entregar” (primario) y “Nuevo cobro” (secundario). Al pulsarlo, la orden pasa a `fulfilled`, el sheet se cierra y el foco vuelve a la fila `CASO entrega reabierta`. **Pasa**.
- **Efectivo pagado reabierto:** también ofrece “Listo para entregar”. **Pasa**.
- **API:** `PATCH` sobre `confirmed` devuelve 409 (“Solo un pedido pagado…”); sobre `paid` devuelve 200 y `fulfilled`; repetirlo devuelve 200 y sigue `fulfilled`. **Pasa**.

Queda un detalle menor: tras entregar un demo o un efectivo, la fila de Actividad sigue diciendo “Demo”/“Efectivo” y no “Entregado”. El contrato no define un badge visual explícito para `fulfilled`, pero la comerciante no ve que ya entregó.

### 3.3 Foco y teclado

**130/130** comprobaciones en Guía, Cobro, Fiado, Verificar y Confirmación de Corte, a 360 y 1280:

- foco inicial dentro del diálogo;
- `Tab` desde el título va a “Cerrar” y se queda dentro;
- `Shift+Tab` desde “Cerrar” vuelve al título y se queda dentro;
- `Shift+Tab` desde el título envuelve al último control;
- 18 `Tab` y 10 `Shift+Tab` consecutivos: siempre dentro, nunca `BODY`;
- Escape cierra y devuelve al disparador;
- backdrop cierra y devuelve al disparador (Guía, fila de Cobro, Registrar abono, Verificar, Guardar corte);
- en Cobro, el disparador de respaldo (`h1`) funciona cuando el botón ya no está disponible.

El bloqueante del primer informe (`Shift+Tab`/backdrop) **queda cerrado**.

### 3.4 Pago en curso

Con `/api/demo/pay` retrasado 1.6 s, tanto el click en backdrop como Escape dejan el sheet abierto; al terminar el pago aparece el `PaidSheet` una sola vez. El sheet ya no se cierra durante el pago. **Pasa**.

---

## 4 · Bloqueantes de esta ronda

### B4 · El 200% sigue roto por solapes de texto en Caja, Meta, Corte, Cobro pagado y PaidSheet

No es un problema de overflow horizontal: el documento mide 360/360 o 390/390. Es un problema de **line-height fijo** contra tipografía en `rem`:

```css
/* web/src/app/globals.css:66-67 */
body {
  font-size: 17px;
  line-height: 24px;
}
```

Al poner `html { font-size: 200% }`, los `h2` con `text-[1.375rem]`, `text-[1.5rem]`, `text-[1.625rem]`, `text-[1.75rem]` suben a 44–56 px, pero siguen con `line-height: 24px` porque no llevan `leading-*` y heredan el `body`. Las líneas se pisan.

#### B4.1 · Caja 360/390

Pasos: `POST /api/demo/reset` → abrir Caja a 360×800 → `html { font-size: 200% }` → medir `h2` y capturar.

- `CajaPanel` `h2` “¿Qué vendiste?” (`caja-app.tsx:1162`): `font-size=44px`, `line-height=24px`, altura de caja 48 px para 2 líneas; el texto “¿Qué” y “vendiste?” se solapan.
- `Pedido en curso` (`caja-app.tsx:1312`): mismo 44/24; se solapa con “Todavía no hay productos”.
- `Últimos movimientos` (`caja-app.tsx:2986`): 40/24; el título de dos líneas se solapa.
- A 390 se reproduce igual; la captura completa muestra el mismo patrón.

Evidencia: `f3-3-caja-360-200.png`, `z3-caja-360.png`, `z3-caja-390.png`.

#### B4.2 · Meta 360/390

Pasos: Meta → 200% → ir a la tarjeta de la meta.

- `h2` “Una meta a la vez” (`caja-app.tsx:2729`): `font-size=48px`, `line-height=24px`, altura 96 px para cuatro líneas; las palabras “Una”, “meta”, “a”, “vez” se montan entre sí.
- El título de la meta `Mi primera sombrilla` (`caja-app.tsx:2739`): 40/24 y también se solapa.
- A 390 se reproduce; la captura muestra “Mi camino / Una meta a la vez / Mi primera sombrilla” ilegible.

Evidencia: `f3-3-meta-360-200.png`, `z3-meta-360.png`, `z3-meta-390.png`.

#### B4.3 · Corte 360/390/768

Pasos: Corte → 200% → tarjeta “Cuenta el efectivo de hoy”.

- `CashCloseCard` `h2` “Cuenta el efectivo de hoy” (`caja-app.tsx:2326`): 44/24. A 360 ocupa 96 px de alto (cuatro líneas) y las líneas se solapan; a 768 se ve igual de mal porque el ancho de la tarjeta no permite una sola línea.
- `BusinessOverview` `h2` “Así va la caja” (`caja-app.tsx:1992`): 44/24.
- `ReconcileCard` `h2` “¿Cuadra con pey?” (`caja-app.tsx:2858`): 44/24; a 360 se parte en dos líneas y se solapa.
- Esto es independiente del monto y ocurre también con los datos de seed.

Evidencia: `f3-3-corte-360-200.png`, `z3-corte-360.png`, `z3-corte-390.png`, `z3-corte-768.png`.

#### B4.4 · PaidSheet y PaymentPanel pagado, 360/390

Pasos: pedido demo pendiente → “Simular CoDi” → `PaidSheet` → 200%; y pedido en efectivo pagado → abrir su fila en Actividad → 200%.

- `PaidSheet` `h2` (`caja-app.tsx:4080`): `font-size=56px`, `line-height=24px`, altura 48 px para dos líneas. El subtítulo “Pago simulado · demo” (34/48) se parte en dos líneas y el `h2` lo pisa; el monto `$120.00` (68/68) queda pegado.
- `PaymentPanel` pagado `h2` “Efectivo recibido” (`caja-app.tsx:1638`): `font-size=52px`, `line-height=24px`; se solapa con “Cobrado en caja” y el monto `$70.00`.
- A 360 y 390 se reproduce. A 768/1280 el `h2` ya no parte en dos líneas, pero sigue con line-height 24; la captura de 768 muestra el monto pegado. A 1280 el caso aislado se ve aceptable, pero el defecto de base sigue.

Evidencia: `f3-3-paid-sheet-360-200.png`, `z3-paid-sheet-360.png`, `z3-paid-sheet-390.png`, `z3-paid-sheet-768.png` y `f3-3-paid-paymentpanel-360-200.png`.

**Por qué es bloqueante:** el 200% es un criterio explícito del gate. Aquí no hay overflow horizontal: hay texto encimado y títulos de estado ilegibles. No es un detalle estético; en `PaidSheet`/`PaymentPanel` el usuario no puede leer con claridad si el pago fue simulado, verificado o en efectivo.

### B5 · Corte 200%: el monto de la analítica se recorta

Pasos:

1. Ejecutar el audit oficial o crear un día normal con ~20 ventas.
2. Ir a Corte.
3. Aplicar `html { font-size: 200% }`.
4. Medir el `p` de “Ventas registradas · Hoy” dentro de `BusinessOverview`.

Resultados:

- **360×800, audit oficial:** `$2,092.00` tiene `left=53`, `right=385` con viewport 360; `Ventas registradas · Hoy` tiene el mismo `right=385`. El gate sale 1 con esos dos hallazgos.
- **390×844, mi medición con 23 ventas:** `$1,810.00` y “Ventas registradas · Hoy” desbordan la tarjeta `relative overflow-hidden`; se recorta el último carácter del monto. Con `$1,990.00` pasa lo mismo.
- Con el seed de `$190.00` no se recorta; por eso el fallo es dependiente del monto y la prueba de seed sola no lo ve. Un día normal de 20+ ventas lo dispara.
- El audit oficial **sí** detecta 360; no detecta el mismo recorte a 390 en esta corrida.

Evidencia: `f3-3-corte-analytics-360-200.png`, `z3-corte-360.png`, `z3-corte-390.png`, `demo/hig-after/audit.json` (fallo 360).

**Por qué es bloqueante:** es un monto de dinero de la pantalla de Corte, recortado al 200%. El contrato 6.5/9 exige el total esperado sin pérdida y el audit oficial ya lo marca como fallo.

### B6 · Fiado 4+ al 200%: se arregló el overflow, pero los nombres se truncan

Pasos: crear 9 fiados (Juan + 4 clientes de prueba + los mixtos) → Fiado → 360/390 → 200%.

- **Overflow horizontal: arreglado.** `document.documentElement.scrollWidth` = 360/360 y 390/390; el contador “9 clientes” ya cabe.
- **Nombres: no.** A 360 cada nombre `p.truncate` (`caja-app.tsx:3152`) tiene `scrollWidth` 239–312 contra `clientWidth=230`. “Cliente Cuatro D”, “Cliente Cuatro C”, “Cliente Cuatro B” y “Cliente Cuatro A” se ven como “Cliente Cuatr…” y quedan indistinguibles. A 390 se truncan tres nombres largos (266–312 contra 260).
- En Actividad, las descripciones de producto usan `truncate` (`caja-app.tsx:3053`): 29 filas truncadas a 360/390, 21 a 768 y 1 a 1280. La lista de Actividad es secundaria, pero el contrato 4.2 solo permite `truncate` para IDs/links secundarios.

Evidencia: `f3-3-fiado-4clients-360-200.png`, `f3-3-fiado-4clients-390-200.png`, `z3-fiado-360.png`, `z3-fiado-390.png`, `fiado-200-clean.json`.

**Por qué es bloqueante:** el bloqueante original de Fiado era el desborde horizontal; esa parte está reparada. Pero al 200% el nombre del cliente es información esencial y se pierde. Cuatro clientes distintos se leen igual; el arreglo no está completo.

---

## 5 · Audit oficial

### 5.1 Lo que sí detecta

Ejecuté `python scripts/hig-after-audit.py` sin editar el script. Resultado real:

```text
360x800 corteText200: clipped viewport “$2,092.00”
360x800 corteText200: clipped viewport “Ventas registradas · Hoy”
FALLÓ: 2 hallazgos
EXIT=1
```

Además, con DOM sintético inyectado y llamando a `measure()`:

| Categoría sintética | Detectada |
|---|---|
| `text-overflow` (texto más ancho que su caja con `overflow:hidden`) | **sí** (`overflow-x`, scroll 269 / client 120) |
| `ancestor-clip` parcial | **sí** (`ancestor-clip`) |
| `fully-clipped` (botón completamente fuera de un `overflow:hidden`) | **sí** (`fully-clipped`) |
| control colapsado 8×6 | **sí** (`collapsed-control`) |
| target <44 (30×30) | **sí** (`under44`) |
| solape de dos botones | **sí** (`overlap`, 62%) |
| viewport expandido (`innerWidth=360` > `visualViewport=180` con `pageScaleFactor=2`) | **sí** (el gate compara `innerWidth` con `visualViewportWidth`) |

También confirmé que el audit ahora genera medidas al 200% para `demoSheetText200`, `verifyText200`, `paymentText200`, `paidText200`, `fiadoSheetText200`, `corteConfirmText200`, `checkoutText200`, `checkoutPaidText200`, `successPageText200`; y corre `full_flow` a 768. Son mejoras reales respecto del informe anterior.

### 5.2 Lo que no detecta

- **No mide solapes texto-texto ni `line-height` menor que el `font-size`.** Caja, Meta, `PaidSheet` y `PaymentPanel` pagado pasan el audit con texto encimado. El audit mide rectángulos y `scrollWidth`, no la tinta de las líneas.
- **Marca `.truncate` como intencional.** El Fiado con nombres “Cliente Cuatr…” no falla el gate porque el detector ignora `intentional: true`; eso no cumple el contrato 4.2.
- **El recorte de 390 en Corte no se detectó** en esta corrida, aunque mi medición independiente sí lo midió dentro de la tarjeta `overflow-hidden`.
- No prueba el 200% de todos los estados de pago (por ejemplo, `PaymentPanel` pagado reabierto; mide el `PaidSheet` inmediato, no el panel de un pedido pagado reabierto).
- No prueba CLS, rendimiento, teclado móvil real, VoiceOver/NVDA, safe area física.

**Consecuencia:** el audit sirve como una parte del gate, y de hecho atrapó B5 a 360. No puede ser la única prueba de F4: da falsos negativos en B4 y B6.

---

## 6 · Mayores

### M1 · La truncación de nombres y productos al 200% no se considera fallo

Además de B6, en Caja las descripciones de Actividad se truncan en 29 filas a 360/390, 21 a 768 y 1 a 1280. A 360, casi toda la lista queda “1 CASO…” sin poder distinguir la venta. El sheet muestra el detalle, pero la lista es el punto de entrada y la información esencial no debería depender de abrir cada fila. El contrato 4.2 dice `truncate` solo para IDs/links secundarios.

### M2 · El audit no es suficiente como puerta única de F4

No detecta B4 ni B6; su `measure` no ve la tinta que se sale de la caja de línea. Aun así, detecta B5 y las categorías sintéticas de §5.1. Para F4 debe añadirse una comprobación de `line-height`/solape de texto y una regla que no trate como intencional el nombre del cliente ni la descripción de producto.

### M3 · El recorte de Corte es dependiente del monto

El seed de `$190.00` pasa; un día de ~20 ventas produce `$1,810–$2,092` y falla. El test de regresión debe usar un monto de cuatro cifras y comprobar el `p` de la analítica a 360 y 390. No basta con el seed.

---

## 7 · Menores

- **Token de color `attention`:** `web/src/app/globals.css:14` define `#9c4e2b`; `HIG-DESIGN.md` §4.1 define `#A6532F`. El uso es coherente consigo mismo y no cambia la semántica, pero no coincide con el token del contrato. El valor observado en Actividad demo fue `rgb(156, 78, 43)` (`#9c4e2b`), no `#A6532F`.
- **Estado entregado en la lista:** después de `paid → fulfilled`, Actividad muestra “Demo” o “Efectivo”, no “Entregado”. El sheet sí cambia el título; el contrato no define el badge, pero la comerciante no ve el resultado en la lista.
- **Footer del sheet:** el contrato 5.4 pide header y footer fijos; el componente solo fija el header y deja las acciones dentro del cuerpo scrollable. A 200% las acciones son alcanzables, por lo que no las cuento como bloqueante.
- **Dos acciones verdes en Caja:** el micrófono y “Confirmar venta” usan el color de acento; el contrato 5.1 pide un solo `primary` por vista. Es una observación de jerarquía, no un fallo funcional.

---

## 8 · Lo que sí pasa (reproducido por mí)

- Verdad de los 9 estados de pago de §3.1, incluyendo el mixto efectivo + digital y el efectivo + pey.
- Entrega desde `PaidSheet` y desde un pedido pagado reabierto en Actividad; API `PATCH` 409/idempotente.
- Foco: 130/130 en los 5 sheets, `Tab`, `Shift+Tab`, 18/10 ciclos, Escape y backdrop; nunca `BODY`.
- Pago en curso: backdrop/Escape no cierran el sheet; el `PaidSheet` aparece al terminar.
- **200% que sí pasa:** checkout (total 40→80 px), éxito demo y mixto, Demo, Guía, Verificar, Cobro pendiente, Fiado sheet, Corte confirmación; sin overflow horizontal, sin controles colapsados y sin targets <44 en esos estados.
- **Fiado:** el resumen de 9 clientes ya no desborda a 360/390; el sheet de abono tiene monto, método y nota; pide confirmación al descartar; “Seguir editando” conserva; “Descartar” cierra; al guardar persiste `amount_cents=1000`, `method=codi`, `note="nota verificador f3-3"` y no crea una venta nueva.
- **Corte normal:** task-first; “Falta” y “Sobra” con explicación; confirmación; guardado durable con `role=status`; API `/api/cash` con el corte; denominaciones y disclosure.
- **Contrato:** tabs conservan estado y scroll; sidebar 220 a 768 y 240 a 1280; subtítulos de 15 px; TopBar sin `.truncate` y sin overflow a 200%; foto de Meta fuera de la tarjeta; `aria-busy` en pago, abono y entrega; `h1` “Corte de caja”; errores inline de venta y verificación; “No entregues el pedido”.
- **Checkout:** total 40 px normal y 80 px al 200%; `h1`; `aria-busy`; éxito con `h1` enfocado y `role=status`; redirect real a `order.paymentUrl` con respuesta de API interceptada; no se ejecutó un pago real.
- **Calidad:** lint, `tsc`, build; webhook 27/27; axe serious/critical 0 en las pantallas y sheets normales; `:3000` intacto.

---

## 9 · Lo que no pude probar

- Pago real de $0.01, `DEMO_MODE=false`, redirect real a pey en runtime y webhook real de pey. El redirect se probó con la respuesta de `/api/checkout/{id}` interceptada; no se cambió `DEMO_MODE` ni se movió dinero.
- Teléfono físico 360, iOS/Safari, Android, safe area física, VoiceOver/NVDA.
- Micrófono/transcripción reales, QR escaneado, `navigator.share`, offline, conciliación real, CLS/LCP/Lighthouse.
- 200% con zoom de navegador real o zoom de texto del sistema; usé el mismo `html { font-size: 200% }` del audit oficial.
- Algunos estados de 200% no cubiertos por mi suite: confirmación de reset de demo al 200% (el sheet normal sí), todos los estados de `PaymentPanel` pagado a 390/768/1280 (el de 360 ya falla), y el detalle de todos los sheets a 768/1280 (sí medí los principales).
- La app de `:3000` no se usó ni modificó; solo se comprobó que sigue respondiendo con el mismo proceso.

---

## 10 · Artefactos

Resultados y capturas en:

`C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-verify-f3-3\`

- `truth-clean-results.json`, `truth-ui-results.json`, `delivery-results.json`, `focus-results.json`, `zoom3-measurements.json`, `fiado-200-clean.json`, `contract-basic.json`, `contract-rest.json`, `fiado-results.json`, `corte-results.json`, `audit-synthetic.json`.
- Capturas clave:
  - `f3-3-caja-360-200.png`, `z3-caja-390.png`
  - `f3-3-meta-360-200.png`, `z3-meta-390.png`
  - `f3-3-corte-360-200.png`, `f3-3-corte-analytics-360-200.png`, `z3-corte-390.png`, `z3-corte-768.png`
  - `f3-3-paid-sheet-360-200.png`, `z3-paid-sheet-390.png`, `f3-3-paid-paymentpanel-360-200.png`
  - `f3-3-fiado-4clients-360-200.png`, `f3-3-fiado-4clients-390-200.png`
  - `z3-cobro-360.png`, `z3-verificar-360.png`, `z3-success-demo-360.png`, `z3-success-mixed-360.png`
- Audit oficial: `demo/hig-after/audit.json` (exit 1; 2 fallos de Corte 360).
- El único archivo versionable que añado es este informe; no se tocó `src`, API, libs, CSS ni scripts.

**Conclusión: NO LISTO para F4.** Los tres bloqueantes del segundo informe están reparados en lo esencial, pero el 200% sigue fallando en Caja, Meta, Corte, Cobro pagado y PaidSheet (B4), el monto de la analítica de Corte se recorta (B5) y los nombres de Fiado se truncan (B6). Hay que corregir la relación `font-size`/`line-height` del texto que crece en `rem`, evitar `.truncate` en nombres y descripciones esenciales, y hacer que la analítica resista montos de cuatro cifras a 360/390. Después hay que repetir esta verificación completa; el veredicto no se hereda.
