# Verificación independiente — Mercado Cero F3 (segunda revisión final)

> **Worktree:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-hig`
> **Rama:** `hig-redesign` · **HEAD verificado:** `a13270f` (incluye `e2ebdf1`)
> **Servidor:** `http://localhost:3001` · **DEMO_MODE:** activo
> **Fecha:** 31 de octubre de 2026
>
> **Nota de alcance posterior:** al terminar esta verificación, el worktree avanzó a `0355307` (`36064d4` + `0355307`), que incluyen supuestos fixes y una “Tercera ronda” en `VERIFICACION-INDEPENDIENTE.md`. No verifiqué esos commits ni acepto esa evidencia como prueba. **Este veredicto aplica a `a13270f`.** Un HEAD nuevo exige una verificación independiente nueva; no se hereda este resultado ni se declara LISTO por los commits posteriores.
>
> **VEREDICTO: NO LISTO para F4.**
>
> No se aceptó como prueba `VERIFICACION-INDEPENDIENTE.md` ni la sección “Segunda ronda”. Todas las afirmaciones de este informe se midieron de nuevo contra la API, la base SQLite, el navegador y el script de auditoría de este HEAD. No se modificó `src`, API, libs, CSS ni scripts.

---

## 1 · Resumen

El commit repara de forma real los bloqueantes B1 y B2 que motivaron el NO LISTO anterior:

- **B1 del informe anterior:** una venta solo efectivo ya no dice “Pago verificado” ni “confirmado por pey”; el demo ya no aparece como “Pagado” con verde en Actividad ni en el encabezado del sheet.
- **B2 del informe anterior:** `Shift+Tab` ya no escapa de Guía, Cobro, Fiado, Verificar ni Confirmación de Corte; el backdrop ya no deja el foco en `BODY`.
- **M2/M3 del informe anterior:** el checkout mixto digital+fiado muestra el saldo, y Fiado pide confirmación antes de descartar monto/nota.

Pero F3 sigue sin cumplir el gate por **tres bloqueantes**:

1. **Verdad del pago en el estado mixto efectivo+digital.** Una venta de $90 con $30 en efectivo y $60 demo se muestra como **“Pago simulado” por $90** y con el texto **“No se movió dinero real”**, ocultando los $30 en efectivo. Actividad la etiqueta solo **“Demo”**.
2. **Entrega de un pedido pagado reabierto desde Actividad.** El sheet de un pedido ya pagado solo ofrece **“Cerrar”** y **“Nuevo cobro”**; no tiene **“Listo para entregar”**. Si la comerciante cierra el sheet o recarga, el pedido queda en `paid` sin ninguna acción de UI para pasarlo a `fulfilled`.
3. **200% en Fiado a 360/390.** Con 4 clientes, el resumen “Saldo pendiente / $230.00 / 4 clientes” desborda horizontalmente: `documentScrollWidth=392` contra un viewport de 360 (y 392 contra 390). El propio audit oficial ahora sale **1** por este fallo.

Además quedan dos mayores: el audit sigue sin cubrir Demo/Éxito al 200% y no detecta contenido totalmente recortado; y el backdrop cierra el sheet **durante un pago demo en curso**, tras lo cual el `PaidSheet` reaparece solo y roba el foco.

---

## 2 · Método

### 2.1 Suites propias (Playwright 1.64 / Python)

Todos los scripts viven en `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-verify-f3-2\`. Se usó Chromium headless, viewports 360×800, 390×844, 768×1024 y 1280×900, `html { font-size: 200% !important; }` para el reflujo, y la API real del puerto 3001.

| Suite | Resultado | Nota |
|---|---|---|
| Verdad de pago (los 6 casos pedidos) | **78/78** | Efectivo, efectivo+fiado, fiado puro, demo, webhook firmado y digital+fiado; Actividad, sheet, `/pay/{id}` y `/success`. |
| Foco en 5 sheets × 2 viewports | **100/100** | Foco inicial, Tab, Shift+Tab desde “Cerrar”, Shift+Tab desde el título, 16 Tab, Escape, backdrop y retorno. |
| PaidSheet (foco/backdrop/fallback) | **4/4** | Incluye retorno al `h1` de respaldo cuando “Confirmar venta” queda deshabilitado. |
| 200% (4 viewports, pantallas y 6 sheets) | **334/340** | Los 6 FAIL son el mismo defecto de Fiado a 360/390, detallado en B3. |
| 200% de tarjetas de resultado (`/pay` y `/success` de 6 estados) | **28/28** | 360 y 390; efectivo, mixto, fiado, digital+fiado, demo, webhook y pendiente. |
| Fiado: persistencia y M3 | **22/22** | Monto, método `codi` y nota persistidos en `credit_payments`; descarte con confirmación. |
| Corte | **18/19** | El único FAIL fue una aserción mía obsoleta; la UI y la API mostraban “Sobra” y persistían el corte. |
| Errores inline, Verificar, demo reset, axe 100% | **26/27** | El único FAIL fue un selector mío equivocado para el campo de texto de voz; el error `role=alert` sí apareció y `#sale-text` está siempre visible. |
| Resto de contrato (PATCH, `/success`, redirect, `aria-busy`) | **9/9** | Incluye redirect real a `order.paymentUrl` con respuesta de API interceptada (sin tocar el servidor). |
| Medición sintética del audit | **7/8** | Detecta text-overflow, ancestor-clip parcial, controles colapsados, under44, solape y viewport expandido; no detecta contenido **totalmente** recortado. |

### 2.2 Comandos de calidad

| Comprobación | Resultado |
|---|---|
| `git status` al iniciar y al cerrar | limpio; HEAD `a13270f`; solo se añade este informe |
| `git diff --name-only efb8145..a13270f` | 9 archivos: docs, audit, checkout route, CSS, checkout-client, success-client, caja-app, db. Sin `.env`. |
| `git grep` de claves/tokens en tracked | 0 coincidencias; `web/.env.local` no está versionado (`.gitignore`) |
| `npm run lint` | **pass** |
| `npx tsc --noEmit` | **pass** |
| `npm run build` | **pass** (se detuvo el dev server, se compiló y se restauró `next dev -p 3001`) |
| `BASE_URL=http://localhost:3001 node scripts/webhook-contract.mjs` | **27/27**, exit 0 |
| `python scripts/hig-after-audit.py` | **exit 1**, 2 fallos (ver B3) |
| `http://localhost:3000` | sigue respondiendo 200; proceso `mercado-cero\web` `next start`, PID 49176, sin cambios |
| `http://localhost:3001` | restaurado y respondiendo 200; dashboard `demoMode=true` |

El único artefacto generado en el worktree fue `web/scripts/__pycache__/`, creado al importar el audit para las pruebas sintéticas; se eliminó. `demo/hig-after/` es ignorado por git.

---

## 3 · Bloqueantes

### B1 · Verdad del pago: el estado mixto efectivo+digital se muestra como demo puro

Los seis casos del mínimo **sí pasan** (ver §6). El fallo aparece en un estado que la app sí permite crear: efectivo parcial + resto digital, sin fiado.

**Pasos exactos:**

```http
POST /api/demo/reset
POST /api/orders
{"items":[{"description":"CASO mixto efectivo digital","quantity":1,"unitPriceCents":9000}],
 "cashCents":3000}
POST /api/orders/{id}/pay   {"mode":"link"}
POST /api/demo/pay          {"orderId":"{id}","method":"codi"}
```

**API observada:** `status=paid`, `totalCents=9000`, `paidCents=9000`, `digitalPaidCents=6000`, `creditCents=0`, `lastPaymentProvider=demo`.

**UI observada (1280):**

- Actividad, fila del pedido: `1 CASO mixto efectivo digital · Demo · $90.00`. La etiqueta es **Demo**, no “Pago mixto” ni “Efectivo + digital”.
- Sheet de la fila (`[role=dialog]`):
  ```text
  Pago simulado
  Pago simulado · demo
  Pago simulado
  $90.00
  Pedido B805 · simulado en modo demo
  En producción, este estado solo se actualiza con la confirmación firmada de pey. No se movió dinero real.
  Cerrar
  Nuevo cobro
  ```
  El texto **“No se movió dinero real”** es falso: $30 sí se recibieron en efectivo. El monto de $90 también se presenta como simulado.
- `/pay/{id}`: `Pago simulado`, `$60.00`, método CoDi; no menciona los $30 en efectivo.
- `/pay/{id}/success`: `Pago simulado`, `$60.00`; no menciona los $30 en efectivo.

**Por qué es bloqueante:** es la misma regla central que el anterior B1: un estado no puede mostrarse con el tratamiento de otro. El contrato 5.6/6.2/7 reserva `demo` para lo simulado y exige texto + monto coherentes; aquí un pedido con dinero real en efectivo se anuncia como demo total. La causa está en `paymentTruth()` (`caja-app.tsx:3540-3554`): conoce `cashPaidCents` y `digitalPaidCents`, pero `PaymentPanel` (`1544-1655`) y `PaidSheet` (`3921-4019`) solo usan la fuente mixta si `creditCents > 0`. Un mixto efectivo+demo, o efectivo+pey, colapsa a la rama demo/pey y oculta el efectivo. La consulta de `lastPaymentProvider` en `db.ts` prioriza explícitamente el pago no-cash (`CASE WHEN method != 'cash' THEN 0 ...`), lo que garantiza que este caso caiga en demo/pey.

**Evidencia:** `mixed-cash-digital-sheet.png`, `mixed-cash-digital-pay.png`.

---

### B2 · Un pedido pagado reabierto desde Actividad no se puede entregar

**Pasos exactos:**

1. Pagar un pedido en demo desde el checkout público (o crearlo por API y ejecutar `/api/demo/pay`).
2. Ir a Caja → Actividad → abrir la fila del pedido pagado.
3. Observar el sheet.

**Resultado observado (1280 y 390):** el sheet es el `PaymentPanel` de pedido pagado, con estos botones:

```json
["", "Cerrar", "Nuevo cobro"]
```

No existe **“Listo para entregar”**. Al cerrar el sheet y recargar, la orden sigue en `paid` y no hay ningún control de UI para pasarla a `fulfilled`. El API `PATCH /api/orders/{id}` con `{action:"fulfill"}` sí funciona, pero la comerciante no tiene forma de invocarlo.

**Contraste con el contrato:** 6.2 exige, para un pedido pagado, **“Listo para entregar” (primario)** y **“Cerrar” (quiet)**; aquí “Cerrar” es el botón verde primario y “Nuevo cobro” el secundario. La entrega solo funciona en el `PaidSheet` inmediato que aparece tras pagar en la misma sesión (`onDeliver`, `caja-app.tsx:4010-4019`). En cuanto se cierra ese sheet o se recarga, el estado `paidOverlay` se pierde y la orden queda atascada.

**Por qué es bloqueante:** la entrega `paid → fulfilled` es una tarea central del contrato y el usuario la marca como bloqueante. La transición inmediata sí pasa, pero el flujo real se rompe en el caso normal de “pagué, cerré el sheet y luego vuelvo a la actividad”.

**Evidencia:** `activity-paid-no-deliver.png`; API comprobada de nuevo: `status=paid` después de abrir/cerrar el sheet.

---

### B3 · 200% en Fiado: desborde horizontal con varios clientes

**Pasos exactos (reproducidos también por el audit oficial):**

1. `POST /api/demo/reset` (seed: Juan, $50).
2. Crear tres fiados más con el flujo normal/API: efectivo+fiado $60, fiado puro $90, digital+fiado $30. Total: **4 clientes, $230**.
3. Viewport 360×800 (y 390×844), pestaña **Fiado**, aplicar `html { font-size: 200% !important; }`.

**Medición observada:**

| Viewport | `documentElement.scrollWidth` | Viewport | Elemento |
|---|---|---|---|
| 360×800 | **392** | 360 | `p.text-sm.text-ink-2` “4 clientes”, `right=392` |
| 390×844 | **392** | 390 | “4 clientes”, `right=392` |

- El texto “4 clientes” queda cortado por el borde derecho; el documento gana 32 px (360) / 2 px (390) de scroll horizontal.
- Con el seed de **1 cliente** la misma pantalla mide `right=348`, sin desborde. El fallo es dependiente de los datos, pero 4 clientes es un estado normal del negocio.
- El desborde se hereda al abrir el sheet de Fiado: el audit lo reporta como `fiadoSheetText200` con el mismo `392>360`.

**Salida del audit oficial en este HEAD:**

```text
FALLÓ: 2 hallazgos
  - 360x800 fiadoText200: layout viewport expanded 392>360
  - 360x800 fiadoSheetText200: layout viewport expanded 392>360
EXIT=1
```

**Causa visible:** el resumen de `CreditList` (`caja-app.tsx:3020-3037`) usa `flex items-end justify-between gap-3` sin `flex-wrap`, `min-w-0` ni un ancho mínimo para el contador. A 200%, el monto tabular de 56 px y el contador de 30 px no caben en los 296 px útiles del contenedor. No hay `overflow-x` que lo esconda: hay scroll horizontal real.

**Por qué es bloqueante:** el usuario indica que cualquier fallo de 200% es bloqueante, y el contrato 9/10 exige 200% sin pérdida ni scroll horizontal. No es estético: “clientes” queda fuera de la pantalla a 360.

**Evidencia:** `z2-fiado-360.png`, `z2-fiado-390.png`, `fiado-2clients-200.png`, `zoom2-measurements.json`.

---

## 4 · Mayores

### M1 · El audit mejoró, pero sigue teniendo puntos ciegos y cobertura incompleta

Lo que **sí** hace ahora, comprobado con DOM sintético y con la app real:

- Detecta **text-overflow** interno: `p` de 120 px con texto de 376 px → `reason=text-overflow`.
- Detecta **ancestor-clip parcial**: `div[overflow:hidden]` de 120 px con `p` de 320 px → `reason=ancestor-clip`.
- Detecta **controles colapsados**: input de 0×0 → `collapsed-control`.
- Detecta **targets <44**, **solapes** y **viewport expandido** (de hecho, el fallo real de Fiado lo hizo salir 1).
- El gate sale 1 ante fallos reales; no es el falso negativo de la ronda anterior.

Lo que **no** hace:

- **Contenido totalmente recortado:** en un DOM sintético con `div[overflow:hidden]` de 100 px y un botón con `margin-left:300px`, `measure()` devolvió `clippedCount=0`, `under44Count=0`, `overlapCount=0`. `visible()` (`hig-after-audit.py:81-85`) descarta el elemento antes de que el detector de `ancestor-clip` lo vea. Un botón completamente fuera de un contenedor oculto —una acción perdida— no se reporta.
- **Demo al 200%:** el audit mide `demoSheet` normal, pero nunca `demoText200`. La hoja “Modo demo” no se prueba al 200% en ningún viewport.
- **Éxito `/success`:** el audit navega a `/pay/{id}` y mide el estado pagado del checkout, pero nunca a `/pay/{id}/success` (no hay clave `success` en `audit.json`).
- **768 en full_flow:** `full_flow=w in (360, 390, 1280)` (`hig-after-audit.py:475`). A 768 no se abren los sheets de Cobro, Paid, Fiado ni Corte al 200%; el JSON de 768 solo tiene `homeText200`, `helpText200`, `verifyText200`, `checkoutText200` y `checkoutPaidText200`.
- **Solape texto-texto:** solo compara rectángulos de elementos interactivos; una etiqueta que se monte sobre un valor no interactivo no se detecta.

**Por qué es mayor:** el audit es el gate de F4. Ahora encuentra un fallo real, pero su cobertura no respalda la afirmación “sheets 200% en 360/390/768/1280” ni “éxito al 200%”. Debe endurecerse antes de usarlo como puerta única.

### M2 · El backdrop cierra el sheet durante un pago en curso y luego lo reabre

**Pasos exactos:**

1. Pedido pendiente con link → Actividad → fila → sheet “Cobro pendiente”.
2. Interceptar/demorar `/api/demo/pay` 1.5 s (solo en el navegador de prueba).
3. Pulsar **“Simular CoDi”** y, 150 ms después, hacer clic en el backdrop en `(4,4)`.

**Resultado observado:**

- A los 300 ms: `[role=dialog] count = 0` (el sheet se cerró mientras el pago estaba en curso).
- A los 2.2 s: `[role=dialog] count = 1` con “Pago simulado”; el `PaidSheet` reaparece solo y el foco pasa a su `h2`.

**Contrato 6.2:** “backdrop solo si no hay pago en curso”; “Escape igual”. `PaymentPanel` recibe `onClose={() => setActiveOrder(null)}` sin comprobar `paymentLoading` (`caja-app.tsx:957,968`), y `Sheet` cierra en `onMouseDown` sin condición (`3863-3868`). El demo pay sigue en segundo plano y abre `paidOverlay` (`586-603`). Es un mayor: el usuario cierra y la app le vuelve a abrir un modal encima; además se pierde el contexto del cobro.

**Evidencia:** `backdrop-during-pay.png`.

---

## 5 · Menores

- **Nombres de clientes y productos con `.truncate`.** En Fiado 100% y 200%, “Cliente Mixto Digital / Cliente Fiado Puro / Cliente Mixto Efectivo” se cortan (`scrollWidth` 266–317 vs `clientWidth` 230). En Actividad, “1 CASO w…” y “1 CASO p…” también. El contrato 4.2 permite `truncate` solo para IDs/links secundarios; el nombre del cliente es información esencial. El sheet muestra el nombre completo, así que no es bloqueante.
- **El estado `fulfilled` no se ve en efectivo/demo.** Tras entregar una venta en efectivo, Actividad sigue diciendo “Efectivo” y el sheet “Efectivo recibido”; tras entregar un demo, sigue “Demo”. Solo los pedidos pey muestran “Entregado” (`statusLabel`). El contrato 5.6/7 no define un tratamiento visual explícito para `fulfilled`, pero la comerciante no puede ver que ya entregó.
- **Caja/Meta al 200% son funcionales pero muy estrechos.** En Caja 360/200, la columna del micrófono (`w-20` = 160 px) deja ~104 px para el texto de instrucción; la página mide ~3,939 px de alto. En Meta, “Una meta a la vez” se parte en 4 líneas junto al icono de 96 px. No hay clipping ni controles colapsados (mi medición los descarta), pero la legibilidad es pobre. No lo cuento como bloqueante porque cumple el criterio medido de reflujo.
- **El sheet no tiene footer fijo.** El contrato 5.4 pide “header y footer fijos”; el componente solo fija el header y deja las acciones dentro del cuerpo scrollable. A 200% las acciones son alcanzables, así que no se pierden.
- **Dos acciones verdes en Caja.** El micrófono y “Confirmar venta” son ambos botones de acento; el contrato 5.1 pide un solo `primary` por vista. Es una observación de jerarquía, no un fallo funcional.

---

## 6 · Lo que sí pasa (reproducido por mí)

- **Efectivo solo:** API `paid`/`provider=cash`; Actividad “Efectivo” con icono neutro; sheet “Efectivo recibido / Cobrado en caja / recibido en efectivo, sin pasar por pey”; `/pay` y `/success` “Efectivo recibido”, sin “Pago verificado”, “confirmado por pey” ni “Pago simulado”.
- **Efectivo+fiado:** `fulfilled`, `paid=3000`, `credit=6000`; Actividad “Pago mixto”; sheet “Cobro mixto / Quedó anotado / $30.00 en efectivo + $60.00 a fiado”; saldo visible; `/pay` y `/success` “Quedó anotado” con el saldo; sin verde de éxito.
- **Fiado puro:** Actividad “Fiado” attention; sheet “Pedido a fiado”; `/pay` “Quedó anotado”; no “Pago simulado/verificado”; no método vacío.
- **Demo puro:** Actividad “Demo” attention; sheet “Pago simulado”; `/pay`/`/success` “Pago simulado”; verde solo en el pago pey.
- **Webhook firmado en demo:** `provider=pey`, `paid`; Actividad “Pagado” verde; sheet “Pago verificado”; `/pay`/`/success` “Pago confirmado / Listo para entregar / pey confirmó”; no “simulado”.
- **Digital+fiado:** `fulfilled`, `credit=3000`, `digital=6000`; Actividad “Pago mixto”; sheet “Pago mixto / Quedó anotado / $60.00 demo + $30.00 a fiado”; `/pay` y `/success` igual; no “Pago simulado” como título.
- **Foco:** 100/100 en Guía, Cobro, Fiado, Verificar y Confirmación de Corte, a 360 y 1280. Foco inicial en el título; `Tab` al botón Cerrar; `Shift+Tab` desde Cerrar vuelve al título (no escapa); `Shift+Tab` desde el título envuelve al último control; 16 `Tab` seguidos siempre dentro; `Escape` cierra; backdrop cierra sin `BODY` y devuelve al disparador o al `h1` de respaldo. PaidSheet: foco inicial, `Shift+Tab` dentro, entrega y backdrop devuelven al `h1` cuando “Confirmar venta” está deshabilitado.
- **200% (resto):** Caja, Fiado (con 1 cliente), Corte, Meta, checkout pendiente, éxito demo y los sheets Guía, Demo, Cobro, Verificar, Fiado y Corte sin overflow/clipping/colapsados en 360/390/768/1280. Las tarjetas de resultado de efectivo, mixto efectivo+fiado, fiado, digital+fiado, demo, webhook y pendiente pasan 28/28 a 360/390 al 200%.
- **Checkout:** total 40 px normal y 80 px al 200%; `h1` presente; `aria-busy=true` y “Simulando el pago…” durante el pago; éxito con `h1` enfocado y `role=status` + `aria-live=polite`; redirect real a `order.paymentUrl` comprobado interceptando la respuesta de API (sin tocar el servidor); copy de demo y “No guardamos datos de tu tarjeta”.
- **Entrega inmediata:** “Listo para entregar” llama `PATCH /api/orders/{id}` `{action:"fulfill"}`; `paid → fulfilled`; el sheet cierra; el foco vuelve a la fila o al `h1`. `PATCH` rechaza `confirmed` con 409 y es idempotente en `fulfilled`.
- **Tabs:** Meta conserva “123”; Caja conserva `scrollY=900`; cada destino conserva su scroll. `aria-current` correcto.
- **Sidebar:** 767 oculta sidebar y muestra tab bar; 768 muestra sidebar de 220 y oculta tab bar; 1280 sidebar de 240.
- **Fiado:** sheet real con monto, método efectivo/digital y nota; el abono no crea venta; persiste `amount_cents=1000`, `method=codi`, `note="nota verificador f3-2"` en `credit_payments`; el saldo baja a $40.
- **M3:** Escape y backdrop con monto/nota piden “Tienes un abono sin guardar… Seguir editando / Descartar abono”; “Seguir editando” conserva; “Descartar” cierra y al reabrir vuelve al saldo/monto inicial.
- **Corte:** h1 “Corte de caja”; el total contado está en el primer viewport y el desglose debajo; “Falta”/“Sobra” con su explicación; confirmación con diferencia; aviso durable `role=status` “Queda registrado en el corte de hoy”; persistencia en `/api/cash/close`; disclosure `aria-expanded/aria-controls`; denominaciones de 44; refresh con `aria-label`.
- **Errores inline:** venta fiado sin nombre (`role=alert`, foco al campo, `aria-invalid=true`, `aria-describedby`, no toast); voz denegada (`role=alert` “No pude acceder al micrófono…” y campo de texto); verificación falsa con “No verificado / No entregues el pedido.”, foco al resultado `role=alert`.
- **Demo reset:** pide confirmación “Se borran ventas, fiado, corte y meta…” con “Sí, reiniciar / Cancelar”; cancelar no resetea.
- **Tipografía/estructura:** body 17/24; subtítulos de pantalla 15 px; TopBar “Coyoacán, CDMX” con `break-words` (sin `.truncate`); foto de Meta en `figure` fuera de la tarjeta de progreso; `aria-busy` en pagar, entregar, apartar y registrar abono; h1 “Corte de caja”.
- **Normal:** sin overflow horizontal ni targets <44 en Caja, Fiado, Corte, Meta, Guía y Verificar; axe serious/critical 0 en esas pantallas a 360.

---

## 7 · Lo que no pude probar

- **Pago real de $0.01, `DEMO_MODE=false`, redirect real a pey y webhook real de pey.** El redirect se probó con la respuesta de `/api/checkout/{id}` interceptada en el navegador; no se cambió `DEMO_MODE` ni se movió dinero.
- **Teléfono físico 360, iOS/Safari, Android, safe area física, VoiceOver/NVDA.** No se probaron; todo el 200% es emulación Chromium.
- **Micrófono/transcripción reales, QR escaneado, `navigator.share`, offline, conciliación real, CLS/LCP/Lighthouse.** Solo se probó el error de permiso denegado.
- **PaidSheet al 200%** (no está en la lista mínima de sheets) y **confirmación de reset de demo al 200%**; el sheet de Demo normal sí se probó al 200%.
- **La app de :3000** no se usó ni modificó; solo se comprobó que sigue en 200 con su proceso `next start` en `mercado-cero\web`.
- **El audit con datos de seed de 1 cliente:** con 1 cliente el resumen no desborda (`right=348`); el fallo se reproduce con 4 clientes. No se ejecutó el audit completo otra vez tras el reset para no alargar la sesión; la relación datos→fallo está medida directamente.

---

## 8 · Artefactos

Resultados propios en `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-verify-f3-2\`:

- `truth-results.json`, `focus-results.json`, `zoom2-measurements.json`, `zoom2-results.json`, `result-200-results.json`, `fiado-results.json`, `corte-results.json`, `delivery-results.json`, `remaining-results.json`, `errors-axe-results.json`, `audit-measure-results.json`.
- Capturas clave: `z2-fiado-360.png`, `z2-fiado-390.png`, `fiado-2clients-200.png`, `mixed-cash-digital-sheet.png`, `mixed-cash-digital-pay.png`, `activity-paid-no-deliver.png`, `backdrop-during-pay.png`, `z2-checkout-360.png`, `z2-exito-360.png`, `z2-sheet-cobro-360.png`, `truth-sheet-*.png`, `truth-pay-*.png`, `truth-success-*.png`, `corte-saved-360.png`.
- Audit oficial regenerado: `demo/hig-after/audit.json` (exit 1; dos fallos de Fiado 200%).

No se modificó ningún archivo de implementación. El único archivo versionable añadido por esta verificación es este informe.

**Conclusión: NO LISTO para F4.** Se puede volver a verificar cuando se corrijan B1 (mixto efectivo+digital), B2 (entrega desde Actividad) y B3 (resumen de Fiado al 200%), y se cierren M1 (cobertura del audit), M2 (backdrop durante pago) y los menores acordados.
