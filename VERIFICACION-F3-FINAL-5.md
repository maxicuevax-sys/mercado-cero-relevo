# Verificación independiente — Mercado Cero F3 (quinta revisión final)

> **Worktree:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-hig`
> **Rama:** `hig-redesign` · **HEAD:** `7aa250b` · **código verificado:** `504e824`
> **Servidor:** `http://localhost:3001` · **DEMO_MODE:** activo
> **Fecha:** 31 de octubre de 2026
>
> **VEREDICTO: LISTO para F4.**
>
> No encontré bloqueantes. **B7 está reparado**: la descripción de la venta en Actividad ya no usa `truncate` y se lee completa a 360, 390, 768 y 1280 al 200%. Repetí desde cero la verdad de pago de los 9 estados, la entrega desde `PaidSheet` y Actividad, el foco de los 5 sheets, la regresión 200% (incluidos Corte con 4 cifras y Fiado con 8 clientes), el contrato y el audit. Quedan observaciones menores, ninguna bloqueante.

No usé `VERIFICACION-INDEPENDIENTE.md` ni sus secciones de reparación como prueba. Leí `HIG-DESIGN.md` y los informes `VERIFICACION-F3-FINAL.md` a `VERIFICACION-F3-FINAL-4.md`, y reproduje API, UI, foco, 200%, audit, build y webhook contra este HEAD. No modifiqué `src`, API, libs, CSS ni scripts.

---

## 1 · Resumen

1. **B7 reparado.** Creé cuatro ventas con descripciones largas —incluida una de varios productos y una sin espacios— y las medí a 360/390/768/1280 al 200%. El `p` de Actividad ya no tiene `.truncate`: `overflow: visible`, `white-space: normal`, `text-overflow: clip`, `break-words`, `scrollWidth = clientWidth` y el texto completo está en el DOM. Un clon de control con la clase antigua `.truncate` y ancho 190 px reproduce el fallo anterior (`190/348`, ellipsis) y mi comprobador lo detecta; el DOM real ya no lo tiene.
2. **B4, B5 y B6 siguen reparados.** 56/56 estados de 200% (14 pantallas/estados × 4 viewports) sin recortes, solapes, line-height roto, viewport expandido, controles colapsados ni targets <44. Corte con `$2,092.00` completo, sin clipping ni scroll horizontal. Fiado con 8 clientes y nombres de hasta 39 caracteres, completos.
3. **Verdad de pago: 36/36.** Los 9 estados (efectivo, efectivo+fiado, fiado puro, demo, webhook firmado, digital+fiado, efectivo+digital demo, efectivo+pey y triple) pasan en API, Actividad, sheet, `/pay/{id}` y `/success`.
4. **Entrega y foco: pasan.** Entrega desde `PaidSheet` y desde un pedido pagado reabierto en Actividad (demo y efectivo); `PATCH` 409/idempotente; el sheet no se cierra durante el pago. Foco: 10/10 secuencias, 300/300 `Tab`/`Shift+Tab` dentro del diálogo, 0 `BODY`, Escape/backdrop y retorno exacto.
5. **Contrato: 30/30.** Tabs/scroll, sidebar 220/240, Fiado con método/nota/descarte, Corte task-first/Falta-Sobra/confirmación/guardado durable, errores inline en español, Verificar con foco y “No entregues el pedido”, checkout 40→80 px, redirect por código, `aria-busy`, subtítulos 15 px, TopBar, foto de Meta y `h1` “Corte de caja”.
6. **Audit oficial: exit 0**, sin hallazgos, en los 4 viewports. Comprobé con DOM sintético que detecta las 8 categorías pedidas. El audit sigue tratando `.truncate` como intencional, así que por sí solo no habría visto B7; por eso B7 se probó con mi suite propia.
7. **Calidad:** `npm run lint`, `npx tsc --noEmit`, `npm run build` y webhook 27/27, todos en verde. `git status` limpio salvo este informe; sin secretos; `:3000` intacto; `:3001` restaurado.

---

## 2 · Método y entorno

### 2.1 Herramientas

- Playwright **1.64.0** / Chromium **156.0.8078.4**, headless, locale `es-MX`.
- Viewports **360×800, 390×844, 768×1024 y 1280×900**.
- Para el 200%: `html { font-size: 200% !important; }`, el mismo método que usa el audit oficial. No es zoom de navegador real; se indica en “no probado”.
- API real del puerto 3001. Para el webhook firmado se leyó `PEY_WEBHOOK_SECRET` de `.env.local` sin imprimirlo.
- Scripts propios en `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-verify-f3-5\`. No se importó ningún resultado de los informes anteriores.

### 2.2 Suites propias

| Suite | Resultado |
|---|---|
| B7: 4 descripciones largas × 4 viewports al 200% + control del fallo antiguo | **16/16** |
| Verdad de pago: 9 estados × (API + Actividad + sheet + `/pay` + `/success`) | **36/36** |
| Entrega: `PaidSheet`, Actividad, efectivo, API 409/idempotente, pago en curso | **5/5** |
| Foco: 5 sheets × 2 viewports × 30 pulsaciones | **10/10 secuencias · 300/300 pulsaciones · 0 BODY** |
| 200% general: 14 estados × 4 viewports | **56/56** |
| B5/B6 dirigidos: Corte 4 cifras y Fiado 8 clientes | **4/4 + 4/4** |
| Contrato: tabs, sidebar, Fiado, Corte, errores, Verificar, checkout, `aria-busy`, tipografía, Meta, `h1` | **30/30** |
| Audit sintético: 8 categorías | **8/8** |
| Autotest de mi medidor: B4 antiguo, solape real, clip, mismos renglones, monto bueno | **7/7** |

### 2.3 Artefactos

`C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-verify-f3-5\`

- `b7-results.json`, `b7-360-200.png`, `b7-390-200.png`, `b7-768-200.png`, `b7-1280-200.png`
- `truth5-results.json`
- `delivery5-results.json`
- `focus5-results.json`
- `general5-results.json`
- `b5b6-results.json`, `b5b-amount-*.png`
- `contract5-results.json`
- `audit-synthetic5.json`
- `detector-selftest.json`
- `smoke-final.json`
- Audit oficial: `demo/hig-after/audit.json` (ignorado por git).

---

## 3 · B7 · La descripción de la venta en Actividad al 200%

### 3.1 Preparación

`POST /api/demo/reset` y cuatro ventas:

1. `CASO Cobro General` ($90).
2. `3 Quesadillas de queso con flor de calabaza · 2 Agua de horchata`.
3. `CASO Cobro General con descripción extremadamente larga para comprobar el reflujo completo al doscientos por ciento`.
4. `CASO_COBRO_GENERAL_DESCRIPCION_SIN_ESPACIOS_1234567890` (sin espacios, para probar `break-words`).

En cada viewport abrí Caja, apliqué el 200% y medí el `p` exacto de cada fila (no el botón, no el texto accesible): `innerText`, clase, `font-size`, `line-height`, `overflow`, `text-overflow`, `white-space`, `clientWidth/scrollWidth`, número de líneas, rectángulo del `p` frente a su contenedor y al `<button>` de la fila, ancestros con recorte y ancho del documento.

### 3.2 Resultado

| Viewport | Ancho del `p` | Líneas caso 1 / 2 / 3 / 4 | `scroll/client` | CSS observado | Documento |
|---|---|---|---|---|---|
| 360 | 190 | 3 / 7 / 12 / 7 | 190/190 | `break-words`; `overflow: visible`; `text-overflow: clip`; `white-space: normal` | 360/360 |
| 390 | 220 | 3 / 6 / 11 / 6 | 220/220 | igual | 390/390 |
| 768 | 330 | 2 / 4 / 9 / 5 | 330/330 | igual | 768/768 |
| 1280 | 559 | 1 / 2 / 4 / 3 | 559/559 | igual | 1280/1280 |

- El texto completo aparece en `innerText` en los 16 casos; no hay `ellipsis`, no hay `nowrap`, no hay ancestro que recorte y el `p` queda dentro del `<button>` de la fila.
- La clase real es `break-words text-sm font-semibold text-ink`; **no** contiene `truncate`.
- El único `.truncate` que queda en `web/src` es el del link de pago (`caja-app.tsx:1827`), que el contrato §4.2 permite para IDs/links secundarios.

### 3.3 Control del fallo antiguo

Para comprobar que la medición no es un sello de goma, inyecté un clon del `p` con la receta anterior (`.truncate`, ancho 190 px, `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`) y 34 px de tipografía:

- `clientWidth=190`, `scrollWidth=348`, `text-overflow: ellipsis`, `white-space: nowrap`.
- Mi comprobador lo detectó (**1 hallazgo**) y el control se eliminó del DOM.
- El `p` real, en el mismo viewport, no presenta ese patrón.

Esto reproduce la firma exacta de B7 del informe anterior y confirma que la reparación eliminó la causa, no solo el síntoma visual.

**B7: pasa en los 4 viewports.**

---

## 4 · Regresión 200% — 56/56 estados

Preparé para cada viewport: 7 clientes largos, 19 ventas de $100 + 1 de $2, un cobro pendiente, un demo pagado, un efectivo pagado, un checkout pendiente y un pedido pendiente para `PaidSheet`. Apliqué el 200% y medí 14 estados:

`caja · demo · guía · verificar · fiado · fiado-sheet · corte · corte-confirmación · meta · cobro-pendiente · panel-efectivo · paid-sheet · checkout · éxito-demo`.

### 4.1 Totales

| Comprobación | 360 | 390 | 768 | 1280 |
|---|---|---|---|---|
| Estados medidos | 14 | 14 | 14 | 14 |
| Recortes no intencionales | 0 | 0 | 0 | 0 |
| Solapes texto-texto | 0 | 0 | 0 | 0 |
| `line-height` roto / colisión | 0 | 0 | 0 | 0 |
| Viewport expandido | 0 | 0 | 0 | 0 |
| Controles colapsados | 0 | 0 | 0 | 0 |
| Targets <44 | 0 | 0 | 0 | 0 |
| Documento = viewport | sí | sí | sí | sí |

- El único `truncate` observado es el link de pago del sheet de Cobro; está permitido por §4.2 y no es información esencial.
- La barra inferior fija se superpone al contenido mientras se hace scroll, como diseño; el contenido tiene padding inferior y es alcanzable. No es un recorte permanente ni un target perdido.
- Verifiqué además que mi medidor **sí** detecta el B4 antiguo (44/24 y 40/24), un solape real de dos párrafos, un `overflow-x` y un target de 30×30; y que **no** marca como error dos fragmentos del mismo renglón ni el monto bueno de 80/84. Autotest 7/7.

### 4.2 B5 · Corte con monto de 4 cifras

`POST /api/demo/reset` + 19 ventas de $100 + 1 de $2: `/api/analytics?period=today` devolvió `salesCents=209200` (**$2,092.00**).

| Viewport | Monto | Líneas | `client/scroll` | Etiqueta “Ventas registradas · Hoy” | Documento |
|---|---|---|---|---|---|
| 360 | 80/84 px | **2** (`$2,092` / `.00`) | 254/254 | 34/48, 3 líneas, 254/254 | 360/360 |
| 390 | 80/84 px | **2** | 284/284 | 34/48, 2 líneas, 284/284 | 390/390 |
| 768 | 80/84 px | 1 | 354/354 | 34/48, 2 líneas, 354/354 | 768/768 |
| 1280 | 80/84 px | 1 | 371/371 | 34/48, 1 línea, 371/371 | 1280/1280 |

- El texto completo `$2,092.00` está en el DOM; `text-overflow: clip`, sin ellipsis, sin clipping y sin scroll horizontal. El monto y la etiqueta quedan dentro de la tarjeta (`x=53..307` a 360; tarjeta `32..328`).
- A 360/390 el monto se parte en dos líneas. La reparación movió el corte **antes de los centavos** (`$2,092` / `.00`), ya no entre `$2,092.` y `00`; los decimales quedan juntos. No hay pérdida de texto. Es una observación de legibilidad, no un fallo del criterio de esta ronda (ver M1).

### 4.3 B6 · Fiado con 8 clientes y nombres largos

Siete nombres largos + Juan. A 200%:

| Viewport | Ancho del nombre | Líneas | `scroll/client` | Resumen “8 clientes” | Documento |
|---|---|---|---|---|---|
| 360 | 230 | 2–3 | 230/230 | 141/141 | 360/360 |
| 390 | 260 | 2–3 | 260/260 | 141/141 | 390/390 |
| 768 | 282 | 2–3 | 282/282 | 141/141 | 768/768 |
| 1280 | 469 | 1–2 | 469/469 | 141/141 | 1280/1280 |

Nombres probados: `María Fernanda de la Cruz Hernández`, `Josefina Guadalupe Martínez`, `Cliente Cuatro A/B/C/D del Mercado de Flores`, `María del Carmen Rodríguez de la Fuente`. Todos completos, sin ellipsis ni ancestro que los recorte.

**B4, B5 y B6: pasan.**

---

## 5 · Verdad de pago — 9/9 en las cuatro superficies

Cada caso se creó por API real y se observó en: estado devuelto por `/api/orders/{id}`, fila de Actividad, sheet de la comerciante, `/pay/{id}` y `/pay/{id}/success`. **36/36 aserciones.**

| Caso | API observada | Actividad · sheet | `/pay` y `/success` |
|---|---|---|---|
| Efectivo puro | `paid`; `paid=9000`; `digital=0`; `credit=0`; `provider=cash` | “Efectivo”; “Efectivo recibido / Cobrado en caja”; “No pasó por pey ni es un pago verificado por el banco” | “Efectivo recibido”; “No pasó por pey”; sin “Pago confirmado” |
| Efectivo + fiado | `fulfilled`; `paid=3000`; `digital=0`; `credit=6000`; `provider=cash` | “Pago mixto”; “Cobro mixto / Quedó anotado”; “Recibiste $30.00 en efectivo”; “Saldo pendiente: $60.00” | “Quedó anotado”; “$30.00 en efectivo”; “Quedó a fiado: $60.00” |
| Fiado puro | `fulfilled`; `paid=0`; `digital=0`; `credit=9000`; sin payment | “Fiado”; “Venta a fiado / Quedó anotado”; “fiado con CASO Fiado Puro” | “Quedó anotado”; “Quedó a fiado: $90.00”; no “Recibiste” |
| Demo puro | `paid`; `paid=9000`; `digital=9000`; `credit=0`; `provider=demo` | **“Demo” en attention**; “Pago simulado · demo”; “simulado en modo demo”; “No se movió dinero real” | “Pago simulado”; “Pago simulado para la demo”; no “Pago confirmado” |
| Webhook firmado | `paid`; `paid=9000`; `digital=9000`; `credit=0`; `provider=pey` | “Pagado”; “Pago verificado / Pedido pagado”; “confirmado por pey” | “Listo para entregar”; “Pago confirmado”; “pey confirmó este pago” |
| Digital + fiado | `fulfilled`; `paid=9000`; `digital=9000`; `credit=3000`; `provider=demo` | “Pago mixto”; “Cobro mixto / Quedó anotado”; “Recibiste $90.00 demo”; saldo $30.00 | “Quedó anotado”; separa demo y fiado |
| Efectivo + digital demo | `paid`; `paid=9000`; `digital=6000`; `credit=0`; `provider=demo` | “Efectivo + demo”; “Pago mixto”; “El efectivo sí es dinero real; el digital es demo.” | “Pago mixto”; “Efectivo + demo”; no “No se movió dinero real” |
| Efectivo + pey | `paid`; `paid=9000`; `digital=6000`; `credit=0`; `provider=pey` | “Efectivo + pey”; “Efectivo + verificado”; “$60.00 verificados por pey” | “Pago mixto”; “Efectivo + verificado”; sin “simulado” |
| Triple (efectivo + demo + fiado) | `fulfilled`; `paid=9000`; `digital=6000`; `credit=3000`; `provider=demo` | “Pago mixto”; “Cobro mixto / Quedó anotado”; “Recibiste $30.00 en efectivo + $60.00 demo.”; saldo $30.00 | “Quedó anotado”; separa las tres fuentes |

Comprobaciones adicionales:

- El **demo** de Actividad usa `rgb(156, 78, 43)` (attention), no el verde `rgb(11, 107, 79)`; en ningún caso demo aparece “Pagado” ni “Pago confirmado”.
- El **webhook** es el único caso con “Pagado / Pago verificado / Pago confirmado”.
- El efectivo puro no dice “pey” en el cuerpo del sheet ni del checkout.
- El fiado puro no aparece con “Recibiste”.
- El webhook firmado de la suite de contrato devolvió `200 processed`; el replay `200 duplicate` y no duplicó pagos (27/27).

---

## 6 · Entrega, foco y pago en curso

### 6.1 Entrega

| Escenario | Resultado |
|---|---|
| `PaidSheet` inmediato (demo) | “Listo para entregar” → `PATCH /api/orders/{id}` → `paid → fulfilled`; un solo diálogo; cierra; foco en la fila de Actividad, no `BODY`; toast “Pedido entregado.” |
| Pedido pagado reabierto desde Actividad (demo) | El `PaymentPanel` ofrece “Listo para entregar”; al pulsar, `paid → fulfilled`; cierra; foco en la fila `CASO Delivery Activity` |
| Pedido en efectivo reabierto | “Efectivo recibido”; ofrece “Listo para entregar”; `paid → fulfilled` |
| API | `PATCH` sobre `confirmed` → **409** “Solo un pedido pagado puede marcarse como entregado.”; sobre `paid` → **200 fulfilled**; repetido → **200 fulfilled** |

### 6.2 Foco

En 360 y 1280, para **Guía, Cobro, Fiado, Verificar y Confirmación de Corte**:

- Foco inicial dentro del diálogo: **10/10**.
- `Tab`: 18 consecutivos; `Shift+Tab`: 12 consecutivos; **300/300** dentro del diálogo, **0 BODY**.
- Escape cierra: **10/10**; backdrop cierra: **10/10**.
- Retorno de foco: **10/10** al disparador exacto (`Abrir guía`, fila de Cobro, `Registrar abono`, `Verificar`, `Guardar corte`).
- El botón X de Verificar cierra y devuelve el foco a “Verificar”.
- El error de red de Verificar enfoca el bloque `role=alert` después de 60 ms y muestra “No se pudo verificar / No pude verificar el comprobante. Revisa tu conexión e intenta de nuevo.”, sin “Failed to fetch”.
- El resultado falso de Verificar enfoca `role=alert` y contiene “No entregues el pedido.”.

### 6.3 Pago en curso

Con latencia real de red de 2.2 s en `/api/demo/pay` (CDP), pulsé “Simular CoDi” y luego Escape y backdrop:

- `open_before=1`.
- `after_escape=1`.
- `after_backdrop=1`.
- Al terminar: **un solo** `PaidSheet`, título “Pago simulado”; la orden queda `paid`.
- No se cierra el sheet durante el pago y no reaparece un segundo modal.

---

## 7 · Contrato — 30/30

| Comprobación | Resultado |
|---|---|
| Tabs conservan estado: Caja `scrollY≈700` → Fiado `≈300` → Caja `≈700` → Fiado `≈300` | **pasa** |
| `aria-current="page"` único y cambia de destino | **pasa** |
| Sidebar 768 = 220 px; 1280 = 240 px | **pasa** |
| Subtítulos de pantalla a 15 px en Caja/Fiado/Corte/Meta | **pasa** |
| Un `h1` visible por destino; “Corte de caja” | **pasa** |
| Fiado: campos monto, método Efectivo/Digital y nota | **pasa** |
| Fiado: cierre sucio pide confirmación; “Seguir editando” conserva; “Descartar abono” no cambia la API | **pasa** |
| Fiado: abono persiste `1000`, `codi`, `nota verificador f3-5`; no crea venta nueva | **pasa** |
| Corte: task-first, “Total contado” y “Guardar corte” visibles | **pasa** |
| Corte: “Falta”/“Sobra” con explicación y monto | **pasa** |
| Corte: confirmación con diferencia | **pasa** |
| Corte: guardado durable y “Último corte guardado” tras recargar | **pasa** |
| Error de venta inline (“Para fiado necesito el nombre del cliente.”) + foco al campo | **pasa** |
| Error de red de Verificar en español + foco al alert | **pasa** |
| Verificar falso: foco al resultado y “No entregues el pedido.” | **pasa** |
| Verificar: X cierra y devuelve el foco | **pasa** |
| Checkout: total 40 px normal → 80 px al 200% | **pasa** |
| Checkout: `aria-busy=true` y “Simulando el pago…” | **pasa** |
| Checkout: `h1` único; éxito demo `h1` único | **pasa** |
| Checkout: redirect real por código a `paymentUrl` (respuesta de API reescrita) | **pasa** |
| `aria-busy` en confirmar venta | **pasa** |
| `aria-busy` en registrar abono | **pasa** |
| TopBar al 200% sin `.truncate` ni overflow | **pasa** |
| Foto de Meta fuera de la tarjeta (`figure` no contiene el `role=progressbar`) | **pasa** |
| Sheet no se cierra durante el pago | **pasa** (ver §6.3) |
| `h1` visible único en Caja/Fiado/Corte/Meta | **pasa** |

Nota: el error de red de Verificar se midió después de 500 ms; el `useEffect` enfoca el alert a los 60 ms. Medido antes de ese plazo, el foco aún está en `BODY`; no es un fallo de la app, es el orden normal del efecto.

---

## 8 · Audit oficial y detectores

### 8.1 Corrida real

`python scripts/hig-after-audit.py` (desde `web/`) — **exit 0**, 146.4 s, `failures=0`:

```text
360x800  scroll=360/360 under12=0 under44=0 axe=0 200=360 focus=True escape=True errors=0
390x844  scroll=390/390 under12=0 under44=0 axe=0 200=390 focus=True escape=True errors=0
768x1024 scroll=768/768 under12=0 under44=0 axe=0 200=768 focus=True escape=True errors=0
1280x800 scroll=1280/1280 under12=0 under44=0 axe=0 200=1280 focus=True escape=True errors=0

PASÓ: sin violaciones serias, recortes, solapes ni overflow.
```

`audit.json` conserva `demoSheetText200`, `verifyText200`, `paymentText200`, `paidText200`, `fiadoSheetText200`, `corteConfirmText200`, `checkoutText200`, `checkoutPaidText200` y `successPageText200` en los 4 viewports, todos con `clippedCount=0`, `overlapCount=0`, `under44Count=0`.

### 8.2 DOM sintético — el audit sí detecta lo que dice detectar

Inyecté un DOM aislado y llamé a `measure()` del script sin editarlo:

| Categoría | Detectada |
|---|---|
| `text-overflow` (texto más ancho que su caja) | **sí** |
| `ancestor-clip` parcial | **sí** |
| `fully-clipped` (contenido totalmente fuera del ancestro) | **sí** |
| `collapsed-control` (7×6) | **sí** |
| `tight-line-height` (40/20) | **sí** |
| target 30×30 `under44` | **sí** |
| solape de dos botones | **sí** |
| viewport expandido (`innerWidth=980`, `visualViewport=180`, scale 2) | **sí** |

**8/8.** El audit no es un sello de goma.

### 8.3 Límite que sigue existiendo

El audit marca `.truncate` como intencional y no mide texto-texto. Por eso **no habría detectado B7** si la clase hubiera quedado. B7 se probó con la suite propia de §3. El audit sirve como una parte del gate, no como la única puerta.

---

## 9 · Calidad

| Comprobación | Resultado |
|---|---|
| `git status` antes de este informe | limpio; HEAD `7aa250b`; código UI en `504e824` |
| `git diff --stat` | vacío; no modifiqué `src`, API, libs, CSS ni scripts |
| `npm run lint` | **pass**, exit 0 |
| `npx tsc --noEmit` | **pass**, exit 0 |
| `npm run build` | **pass**, 20 rutas; servidor 3001 detenido y restaurado |
| `BASE_URL=http://localhost:3001 node scripts/webhook-contract.mjs` | **27/27**, exit 0 |
| `python scripts/hig-after-audit.py` | **exit 0**, sin hallazgos |
| `http://localhost:3001` tras restaurar | 200; `demoMode=true` |
| `http://localhost:3000` | **no se usó**; mismo proceso `next start` de `mercado-cero\web`, PID 49176, antes y después |
| Secretos | `.env.local` no versionado (`.gitignore`); solo `web/.env.example` con placeholders; no se imprimió ningún valor |
| Artefactos accidentales | `web/scripts/__pycache__/` se creó al importar el audit para las pruebas sintéticas y se eliminó |

Build restaurado: `npm run dev -- -p 3001` (PID 26196). Después del build volví a correr B7 completo y pasó 4/4; el smoke final de Actividad a 360/200 también pasó.

---

## 10 · Hallazgos residuales (no bloqueantes)

### M1 · Observación de legibilidad · El monto de 4 cifras de Corte ocupa dos líneas a 360/390

- A 360/390 el `p` de `$2,092.00` se parte en `$2,092` / `.00`; a 768/1280 va en una línea.
- La reparación movió el corte **antes de los centavos**, no entre `$2,092.` y `00`; los decimales quedan juntos.
- No hay recorte, ellipsis, solape ni scroll horizontal; el texto completo está en el DOM y `clientWidth = scrollWidth`.
- Impacto: una cifra de dinero en dos líneas es menos clara que una sola. No es un bloqueante del criterio de esta ronda (no hay pérdida ni solape). Si F4 quiere pulir la lectura, conviene ajustar tamaño/`line-height` en el breakpoint para que quepa en una línea.

### M2 · Menor · Token `attention` no coincide con el contrato

- `web/src/app/globals.css:14` usa `#9c4e2b`; `HIG-DESIGN.md` §4.1 define `#A6532F`.
- El uso es coherente y el contraste es suficiente; no cambia la semántica. El demo se midió en `rgb(156, 78, 43)`, no en el verde de éxito.

### M3 · Menor · Actividad no muestra “Entregado” tras `fulfilled`

- Después de entregar, la fila sigue diciendo “Demo” o “Efectivo”; el sheet sí cambió de estado.
- El contrato no define el badge de `fulfilled`, pero la comerciante no ve el resultado en la lista. Es el mismo detalle ya reportado; no bloquea.

### M4 · Menor · El footer de los sheets no es fijo

- El contrato 5.4 pide header y footer fijos; las acciones siguen dentro del cuerpo scrollable.
- A 200% son alcanzables y no se pierden; no es bloqueante.

### M5 · Menor · Dos acciones verdes en Caja

- El micrófono y “Confirmar venta” usan el color de acento; el contrato 5.1 pide un solo `primary` por vista.
- Es una observación de jerarquía, no funcional.

### M6 · Menor · El título “Verificar comprobante” parte “comprobante” a 360/200

- El `h2` con `break-words` parte la palabra en `comproba` / `nte` cuando no cabe junto al botón X.
- El texto completo está presente, sin recorte ni solape. Es cosmético; se podría reducir el título o ensanchar su columna.

---

## 11 · Lo que no probé

- Pago real de $0.01, `DEMO_MODE=false` en runtime, redirect real a pey y webhook real de pey. El redirect se probó reescribiendo la respuesta de `/api/checkout/{id}`; no se cambió `DEMO_MODE` ni se movió dinero.
- Teléfono físico 360, iOS/Safari, Android, safe area física, VoiceOver/NVDA.
- Micrófono/transcripción reales, QR escaneado, `navigator.share`, offline, conciliación real, CLS/LCP/Lighthouse.
- 200% con zoom de navegador real o zoom de texto del sistema; usé el mismo `html { font-size: 200% }` del audit oficial.
- Confirmación de reset de demo al 200% y solape del toast sobre el header del sheet al 200%: no los volví a medir en esta ronda. El toast es transitorio y cerrable; no afecta el veredicto.
- La app de `:3000` no se usó ni modificó; solo comprobé que su proceso sigue siendo el mismo `next start` de `mercado-cero\web` (PID 49176).

---

## 12 · Conclusión

**LISTO para F4.**

B7 está reparado y verificado con descripciones largas, multi-producto y sin espacios en los 4 viewports al 200%. Los bloqueantes anteriores —verdad de pago de los 9 estados, entrega desde `PaidSheet` y Actividad, foco completo, checkout 80 px, sheets, Fiado con nombres largos, Corte con montos de 4 cifras— se reproducen y pasan. El audit oficial sale 0 y sus detectores responden a las 8 categorías sintéticas. Lint, TypeScript, build y webhook 27/27 están en verde; no hay secretos ni cambios de implementación, y `:3000` sigue intacto.

Quedan observaciones menores (M1–M6) que no bloquean el F4. La más visible es el monto de Corte en dos líneas a 360/390; el valor completo, sin recorte ni solape, está presente.
