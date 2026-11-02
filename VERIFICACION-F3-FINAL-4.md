# Verificación independiente — Mercado Cero F3 (cuarta revisión final)

> **Worktree:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-hig`
> **Rama:** `hig-redesign` · **HEAD:** `803df67` · **código verificado:** `ea43436`
> **Servidor:** `http://localhost:3001` · **DEMO_MODE:** activo
> **Fecha:** 31 de octubre de 2026
>
> **VEREDICTO: NO LISTO para F4.**
>
> B4, B5 y B6 están reparados en lo esencial y todos los bloqueantes anteriores que se me pidió reproducir pasan. Sin embargo, el criterio de 200% sigue incumplido en Caja: la descripción de cada venta en Actividad usa `truncate` y se corta con puntos suspensivos a 360, 390 y 768. Es un recorte de información esencial al 200%, el mismo defecto que el informe anterior llamó M1; ahora queda como único bloqueante de esta ronda.

No acepté `VERIFICACION-INDEPENDIENTE.md` ni sus secciones de reparación como prueba. Leí `HIG-DESIGN.md` y los tres informes anteriores, y reproduje API, UI, foco, 200%, audit, build y webhook contra este HEAD. No modifiqué `src`, API, libs, CSS ni scripts.

---

## 1 · Resumen

### Lo que sí quedó reparado

1. **B4 — solapes por `line-height`:** el `body` pasó de `line-height: 24px` a `1.45`. Medí Caja, Meta, Corte, `PaidSheet` y `PaymentPanel` pagado a 360, 390, 768 y 1280 al 200%: ya no hay líneas montadas, títulos pisados ni montos pegados a subtítulos. Los títulos de 44–56 px tienen line-height de 63.8–81.2 px y las líneas conservan 2–9 px de separación.
2. **B5 — analítica de Corte:** con `$2,092.00` reales, el monto y “Ventas registradas · Hoy” ya no se recortan ni provocan scroll horizontal a 360/390. El monto completo está en el DOM y dentro de la tarjeta. **Queda una objeción de legibilidad:** a 360/390 el monto se parte en dos líneas (`$2,092.` / `00`), sin pérdida de texto.
3. **B6 — nombres de Fiado:** con 7 clientes y nombres de hasta 35 caracteres, los nombres se leen completos a 360/390/768/1280 al 200%, envuelven en 2–3 líneas y no hay `ellipsis` ni ancestro que los recorte.
4. **Bloqueantes anteriores:** verdad efectivo/demo/mixto, entrega desde Actividad y `PaidSheet`, foco, checkout 80 px, badge/tiles, “Cerrar” de Verificar, Corte normal y Fiado: **reproducidos y aprobados**.
5. **Audit oficial:** `python scripts/hig-after-audit.py` sale **exit 0**. Además comprobé con DOM sintético que detecta tight-line-height, text-overflow, ancestor-clip, fully-clipped, controles colapsados, targets <44 y viewport expandido; y que mide Demo, Verificar, pago, `PaidSheet`, Fiado, confirmación de Corte, checkout, checkout pagado y éxito al 200% en los 4 viewports.

### Lo que impide el LISTO

**B7 · Actividad al 200% sigue truncando la descripción de la venta.** No es el nombre de Fiado (B6, reparado): es la fila de “Últimos movimientos” en Caja. A 360 el texto `1 CASO Cobro General` tiene `clientWidth=190`, `scrollWidth=348`, `text-overflow: ellipsis` y se ve `1 CASO C…`; a 390 (`220` vs `348`) y 768 (`330` vs `348`) también. El contrato §4.2 solo permite `truncate` para IDs/links secundarios y §9 exige 200% sin texto recortado.

---

## 2 · Método y entorno

### 2.1 Comandos y comprobaciones de calidad

| Comprobación | Resultado |
|---|---|
| `git status` al iniciar | limpio · HEAD `803df67` · código de UI/API en `ea43436` |
| `git diff --stat 0355307..HEAD` | 3 archivos de código (`globals.css`, `caja-app.tsx`, `hig-after-audit.py`) + informes previos |
| `npm run lint` | **pass** |
| `npx tsc --noEmit` | **pass** |
| `npm run build` | **pass** (20 rutas; servidor 3001 detenido y restaurado con `npm run dev -- -p 3001`) |
| `BASE_URL=http://localhost:3001 node scripts/webhook-contract.mjs` | **27 aserciones de esa fase**, exit 0 |
| `python scripts/hig-after-audit.py` | **exit 0**, sin hallazgos |
| `http://localhost:3000` | 200; mismo proceso `next start` y mismo hash `D6055C…361C` antes y después; no se tocó |
| `http://localhost:3001` | 200 tras restaurar el dev server; `demoMode=true` |
| Secretos | `.env.local` no está versionado; solo `web/.env.example` con placeholders vacíos. No se imprimió ningún valor |
| `git status` final antes de este informe | limpio; solo se añade este archivo |

### 2.2 Pruebas propias

- **Playwright 1.64 / Chromium headless**, viewports 360×800, 390×844, 768×1024 y 1280×900, locale `es-MX`.
- Para 200%: `html { font-size: 200% !important; }`, el mismo método que usa el audit oficial. No es zoom de navegador real; se indica en “no probado”.
- API real del puerto 3001, SQLite de `web/data/mercado-cero.db` para confirmar persistencia de abonos y cortes.
- Webhook firmado con `PEY_WEBHOOK_SECRET` leído sin imprimirlo.
- Suite de verdad de pago: **9/9 casos**, API + Actividad + sheet + `/pay/{id}` + `/success`.
- Foco: **10/10 secuencias** (5 sheets × 2 viewports), **300/300** pulsaciones `Tab`/`Shift+Tab` dentro del diálogo, 0 `BODY`.
- Entrega: `PaidSheet` inmediato y pedido reabierto desde Actividad; API `PATCH` 409/idempotente.
- 200%: 4 viewports × 12 pantallas/estados = **48 estados** medidos, además de las mediciones dirigidas de B4/B5/B6.
- Contrato/calidad: **41/41** comprobaciones.

### 2.3 Artefactos

`C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-verify-f3-4\`

- `b4-results.json`, `b5-results.json`, `b6-results.json`
- `truth-results.json`, `focus-delivery-results.json`, `contract-results.json`
- `general-200-results.json`, `audit-synthetic-results.json`
- Capturas: `b4-caja-*`, `b4-meta-*`, `b4-corte-*`, `b4-paid-sheet-*`, `b4-payment-panel-360-200-clean.png`, `b5-card-360-200.png`, `b6-fiado-360-200.png`, `m1-activity-360-200.png`, `general-*-200.png`.
- Audit: `demo/hig-after/audit.json`.

---

## 3 · B4 · 200% en Caja, Meta, Corte, PaidSheet y PaymentPanel pagado

Pasos por viewport: `POST /api/demo/reset` → venta pendiente para `PaidSheet` y venta en efectivo para `PaymentPanel` → abrir cada pantalla → `html { font-size: 200% }` → medir `font-size`, `line-height`, cajas de línea reales (`Range.getClientRects`) y separación entre líneas/elementos.

### 3.1 Caja

| Elemento | 360 | 390 | 768 | 1280 | Resultado |
|---|---|---|---|---|---|
| `h2` “¿Qué vendiste?” | 44 px / 63.8 px (1.45), 2 líneas, gap 5.8 | 2 líneas, gap 5.8 | 1 línea | 1 línea | sin solape |
| `h2` “Pedido en curso” | 44 / 63.8, 2 líneas, gap 5.8 | 2 líneas | 1 línea | 1 línea | sin solape |
| `h2` “Últimos movimientos” | 40 / 58, 2 líneas, gap 5 | 2 líneas | 1 línea | 1 línea | sin solape |
| Subtítulo “Habla o escribe…” | 34 / 55.25 | 2 líneas | 2 líneas | 1 línea | sin solape |

No hay `scrollWidth > clientWidth` en los títulos y `documentScrollWidth` es igual al viewport en los cuatro anchos. Capturas: `b4-caja-360-200.png`, `b4-caja-pedido-360-200.png`.

### 3.2 Meta

- `h2` “Una meta a la vez”: **48 / 69.6** (1.45). A 360 ocupa 4 líneas con gaps de **5.59 px**; a 390 3 líneas; a 768 2; a 1280 1.
- “Mi primera sombrilla”: **40 / 58**, 3 líneas a 360, gaps de 5 px.
- “$300.00 de $1,800.00”: **34 / 48**, 3 líneas a 360, gaps de 2 px.
- Pares medidos: kicker→h2 gap 4 px, h2→título 32 px, título→monto 0 px (sin solape de tinta).

Captura: `b4-meta-360-200.png`.

### 3.3 Corte

- `h2` “Cuenta el efectivo de hoy”: **44 / 63.8**, 4 líneas a 360, gaps **5.79–5.8**; 4 líneas a 390; 3 a 768; 1 a 1280.
- `h2` “Así va la caja”: **44 / 63.8**, 1 línea en todos.
- `h2` “¿Cuadra con pey?”: **44 / 63.8**, 2 líneas a 360/390, 1 a 768/1280.
- `h1` “Corte de caja”: 56 / 70 (`leading-tight`, ratio 1.25); 2 líneas a 360 (Range nominal −4 px, sin colisión visible), 1 desde 390.
- Pares: h2→“Total contado” gap 33 px; “Así va la caja”→etiqueta de ventas gap 285–549 px.

No hay scroll horizontal ni recorte en la tarjeta de Corte por estos títulos. Capturas: `b4-corte-360-200.png`, `b4-corte-top-360-200.png`.

### 3.4 PaidSheet

Con `$120.00` demo pagado:

| Elemento | Medición |
|---|---|
| `h2` “Pago simulado” | 56 / 81.2, 2 líneas a 360/390, gap 7.19; 1 línea desde 768 |
| etiqueta “Pago simulado · demo” | 34 / 48, 2 líneas a 360, gap 2 |
| monto `$120.00` | 68 / 68, 1 línea |
| “Pedido … · simulado en modo demo” | 34 / 48, 3 líneas a 360/390, gaps 2 |
| nota “En producción…” | 34 / 55.25, 7 líneas a 360, gaps 9.25 |

Pares medidos: etiqueta→h2 **8 px**, h2→monto **24 px**, monto→subtítulo **16 px**, subtítulo→nota **32 px**. Sin solapes. Captura: `b4-paid-sheet-360-200.png`.

### 3.5 PaymentPanel pagado (efectivo)

Pedido en efectivo de `$70.00` reabierto desde Actividad:

| Elemento | Medición |
|---|---|
| `h2` “Efectivo recibido” | 52 / 75.4, 2 líneas a 360/390, gap 6.39; 1 línea desde 768 |
| etiqueta “Cobrado en caja” | 34 / 48, 2 líneas a 360, gap 2 |
| monto `$70.00` | 68 / 68, 1 línea |
| “Pedido … · recibido en efectivo…” | 34 / 48, 4 líneas a 360 |
| nota “Recibiste el efectivo…” | 34 / 55.25, 9 líneas a 360, gaps 9.25 |

Pares: etiqueta→h2 **8**, h2→monto **24**, monto→subtítulo **16**, subtítulo→nota **24**. Sin solapes. Captura limpia (sin toast): `b4-payment-panel-360-200-clean.png`.

**B4: pasa en los 4 viewports y los 5 estados.** Medí 27 elementos y 16 pares por viewport; no hubo pares con solape de tinta ni anchos de scroll mayores al cliente.

---

## 4 · B5 · Analítica de Corte con monto de 4 cifras al 200%

### 4.1 Preparación

`POST /api/demo/reset` deja hoy `$190.00` (incluye el pendiente de `$120.00`). Creé 19 ventas en efectivo de `$100.00` y una de `$2.00`: **$1,902.00 nuevos + $190.00 = $2,092.00**. `/api/analytics?period=today` devolvió `salesCents=209200`.

### 4.2 Resultado

| Viewport | Monto | Etiqueta | Tarjeta | Scroll documento |
|---|---|---|---|---|
| 360 | 80 / 84 px (1.05), **2 líneas** `$2,092.` / `00`; x 53–307; 254/254 | 34 / 48, 3 líneas `Ventas / registradas · / Hoy`; 254/254 | x 32–328; client=scroll 294 | 360/360 |
| 390 | 80 / 84, **2 líneas**; x 53–337; 284/284 | 34 / 48, 2 líneas; 284/284 | x 32–358; client=scroll 324 | 390/390 |
| 768 | 80 / 84, **1 línea**; 354 px | 34 / 48, 2 líneas | client=scroll 450 | 768/768 |
| 1280 | 80 / 84, **1 línea**; 371 px | 34 / 48, 1 línea | client=scroll 910 | 1280/1280 |

- **No hay clipping:** el monto y la etiqueta están completos dentro de la tarjeta `relative overflow-hidden`; ningún ancestro los recorta; `scrollWidth = clientWidth`.
- **No hay scroll horizontal:** documento = viewport en los cuatro anchos.
- **No hay viewport expandido:** `innerWidth = visualViewport.width`.
- Las tarjetas de métricas (`Cobrado $1,972.00`, `Por cobrar $120.00`, `Ticket promedio $95.09`, `Fiado $50.00`) también están completas.
- **Objeción de legibilidad (M1):** a 360/390 el monto se parte en `$2,092.` y `00`. No es una pérdida de texto, pero rompe la lectura de una cifra de dinero. Recomiendo que el monto de 4 cifras no se parta (ajustar tamaño/line-height en el breakpoint) o que el corte se haga en un separador legible, no entre decimales.

Capturas: `b5-card-360-200.png`, `b5-amount-360-200.png`.

**B5: pasa el criterio de “sin clipping ni scroll horizontal”.** El corte de línea del monto queda como defecto mayor de legibilidad, no como bloqueante.

---

## 5 · B6 · Fiado con 4+ clientes y nombres largos al 200%

Preparé **7 clientes**: Juan (seed) + 6 nombres largos, incluidos `María Fernanda de la Cruz Hernández`, `Cliente Cuatro A del Mercado` … `D` y `Josefina Guadalupe Martínez`.

| Viewport | Nombre medido | Líneas | `scrollWidth/clientWidth` | Recorte |
|---|---|---|---|---|
| 360 | todos | 2–3 | **230/230** | no |
| 390 | todos | 2–3 | **260/260** | no |
| 768 | todos | 2–3 | **282/282** | no |
| 1280 | todos | 1–2 | **452/452** | no |

- `font-size` 32 px, `line-height` 46.4 px (1.45); gaps de 2 px entre líneas.
- Resumen “7 clientes”: 34 px, `scrollWidth=clientWidth=141` en 360; no desborda.
- `documentScrollWidth` = 360/360, 390/390, 768/768, 1280/1280.
- Ningún nombre tiene ancestro con `overflow:hidden` que lo corte; el texto completo está visible.
- Capturas: `b6-fiado-360-200.png`, `b6-fiado-390-200.png`.

**B6: pasa.**

---

## 6 · Verdad de pago, entrega y foco

### 6.1 Verdad de pago — 9/9

| Caso | API observada | Comerciante / sheet | `/pay` y `/success` | Resultado |
|---|---|---|---|---|
| Efectivo puro | `paid`, `paid=9000`, `digital=0`, `provider=cash` | “Efectivo”; “Cobrado en caja”; “No pasó por pey ni es un pago verificado por el banco” | “Efectivo recibido”; sin “Pago confirmado” | **Pasa** |
| Efectivo + fiado | `fulfilled`, `paid=3000`, `credit=6000`, `provider=cash` | “Pago mixto”; “Cobro mixto / Quedó anotado”; “Recibiste $30.00 en efectivo.”; “Saldo pendiente: $60.00” | “Quedó anotado”; “Quedó a fiado: $60.00” | **Pasa** |
| Fiado puro | `fulfilled`, `paid=0`, `credit=9000`, sin payment | “Fiado”; “Venta a fiado / Quedó anotado”; “fiado con CASO Fiado Puro” | “Quedó anotado”; “Quedó a fiado: $90.00”; no “Recibiste” | **Pasa** |
| Demo puro | `paid`, `provider=demo`, `digital=9000` | “Demo”; “Pago simulado · demo”; “No se movió dinero real” | “Pago simulado”; “Pago simulado para la demo” | **Pasa** |
| Webhook firmado | `paid`, `provider=pey`, `digital=9000` | “Pagado”; “Pago verificado / Pedido pagado”; “confirmado por pey” | “Listo para entregar”; “Pago confirmado”; “pey confirmó este pago” | **Pasa** |
| Digital + fiado | `fulfilled`, `paid=9000`, `digital=9000`, `credit=3000`, `provider=demo` | “Pago mixto”; “Cobro mixto”; “Recibiste $90.00 demo.”; “+ $30.00 a fiado” | “Quedó anotado”; separa demo y fiado | **Pasa** |
| Efectivo + digital demo | `paid`, `paid=9000`, `digital=6000`, `credit=0`, `provider=demo` | “Efectivo + demo”; “Pago mixto”; “El efectivo sí es dinero real; el digital es demo.” | “Pago mixto”; “Efectivo + demo”; mismo cuerpo; **no** “No se movió dinero real” | **Pasa** |
| Efectivo + pey | `paid`, `paid=9000`, `digital=6000`, `credit=0`, `provider=pey` | “Efectivo + pey”; “Efectivo + verificado”; “$60.00 verificados por pey” | “Pago mixto / Efectivo + verificado”; sin “simulado” | **Pasa** |
| Efectivo + demo + fiado | `fulfilled`, `paid=9000`, `digital=6000`, `credit=3000`, `provider=demo` | “Pago mixto”; “Cobro mixto”; “Recibiste $30.00 en efectivo + $60.00 demo.”; saldo $30.00 | “Quedó anotado”; separa las tres fuentes | **Pasa** |

El webhook firmado devolvió `200 processed`; el replay del contrato devolvió `200 duplicate` y no duplicó pagos (suite 27 aserciones de esa fase). Ningún caso demo usa verde de “Pagado” ni el copy de pago verificado.

### 6.2 Entrega

- **`PaidSheet` inmediato:** “Listo para entregar” → `PATCH /api/orders/{id}` `{action:"fulfill"}` → `paid → fulfilled`; sheet cerrado; foco en la fila de Actividad, no `BODY`.
- **Pedido pagado reabierto desde Actividad:** el sheet ofrece “Listo para entregar”; al pulsarlo la orden pasa a `fulfilled`, cierra el sheet y el foco vuelve a la fila `CASO Delivery Activity`.
- **Efectivo pagado reabierto:** también ofrece “Listo para entregar”; el sheet muestra “Cobrado en caja” y el aviso de que no pasó por pey.
- **API:** `PATCH` sobre `confirmed` → **409** “Solo un pedido pagado puede marcarse como entregado.”; sobre `paid` → **200 fulfilled**; repetido → **200 fulfilled**.
- Detalle menor ya reportado: tras entregar, la fila de Actividad sigue diciendo “Demo”/“Efectivo”, no “Entregado”.

### 6.3 Foco y teclado — 10/10 secuencias

En 360 y 1280, para Guía, Cobro, Fiado, Verificar y Confirmación de Corte:

| Comprobación | Resultado |
|---|---|
| Foco inicial dentro del diálogo | 10/10 |
| 18 `Tab` consecutivos | 180/180 dentro, nunca `BODY` |
| 12 `Shift+Tab` consecutivos | 120/120 dentro, nunca `BODY` |
| Escape cierra | 10/10 |
| Backdrop cierra | 10/10 |
| Retorno de foco | 10/10 al disparador exacto: “Abrir guía”, fila de Cobro, “Registrar abono”, “Verificar”, “Guardar corte” |
| “Cerrar” (X) de Verificar | cierra y vuelve al botón “Verificar” |

Además, el resultado falso de Verificar enfoca el bloque `role=alert` dentro del sheet y contiene **“No entregues el pedido.”**.

### 6.4 Pago en curso

Con `fetch('/api/demo/pay')` retrasado 1.8 s, pulsé Escape y luego backdrop: el sheet siguió abierto (`open_after_escape=true`, `open_after_backdrop=true`), apareció **un solo** `PaidSheet` al terminar y la orden quedó `paid`.

---

## 7 · 200% general — 48 estados

Pasos: misma data (7 fiados, ventas hasta cuatro cifras —incluye el caso B5 de $2,092.00—, checkout pendiente, éxito demo, cobro pendiente), abrir cada pantalla y aplicar `html { font-size: 200% }`.

| Pantalla / estado | 360 | 390 | 768 | 1280 |
|---|---|---|---|---|
| Caja | pasa* | pasa* | pasa* | pasa |
| Demo | pasa* | pasa* | pasa* | pasa |
| Guía | pasa* | pasa* | pasa* | pasa |
| Verificar (resultado falso) | pasa* | pasa* | pasa* | pasa |
| Fiado | pasa | pasa | pasa | pasa |
| Fiado sheet | pasa | pasa | pasa | pasa |
| Corte | pasa | pasa | pasa | pasa |
| Corte confirmación | pasa | pasa | pasa | pasa |
| Meta | pasa | pasa | pasa | pasa |
| Cobro pendiente | pasa* | pasa* | pasa* | pasa |
| Checkout | pasa | pasa | pasa | pasa |
| Éxito demo | pasa | pasa | pasa | pasa |

`*` La pantalla subyacente contiene la fila de Actividad truncada (B7); el sheet o la pantalla medida no tiene otro recorte.

Totales medidos: **0** recortes no intencionales, **0** controles colapsados, **0** targets <44, **0** solapes de controles, **0** line-height <1, **0** scroll horizontal, **0** viewport expandido. El único recorte es el `truncate` de Actividad (B7); el checker lo clasificó como truncamiento intencional y por eso lo separé de `clipped`.

Capturas: `general-caja-360-200.png`, `general-demo-360-200.png`, `general-fiado-360-200.png`, `general-corte-360-200.png`, `general-corte-confirm-360-200.png`, `general-meta-360-200.png`, `general-cobro-360-200.png`, `general-checkout-360-200.png`, `general-success-360-200.png`.

---

## 8 · Audit oficial

### 8.1 Corrida real

```text
360x800  scroll=360/360 under12=0 under44=0 axe=0 200=360 focus=True escape=True errors=0
390x844  scroll=390/390 under12=0 under44=0 axe=0 200=390 focus=True escape=True errors=0
768x1024 scroll=768/768 under12=0 under44=0 axe=0 200=768 focus=True escape=True errors=0
1280x800 scroll=1280/1280 under12=0 under44=0 axe=0 200=1280 focus=True escape=True errors=0

PASÓ: sin violaciones serias, recortes, solapes ni overflow.
```

`audit.json` conserva mediciones `demoSheetText200`, `verifyText200`, `paymentText200`, `paidText200`, `fiadoSheetText200`, `corteConfirmText200`, `checkoutText200`, `checkoutPaidText200` y `successPageText200` en los cuatro viewports.

### 8.2 DOM sintético — el audit sí detecta lo que dice detectar

| Categoría inyectada | Detectada |
|---|---|
| `text-overflow` | **sí** (1) |
| `ancestor-clip` | **sí** (1) |
| `fully-clipped` | **sí** (1) |
| `collapsed-control` 8×6 | **sí** (1) |
| target 30×30 `under44` | **sí** (1) |
| solape de dos botones | **sí** (1) |
| `tight-line-height` 40/20 | **sí** (1, nuevo) |
| viewport expandido (`innerWidth=360`, `visualViewport=180`, scale 2) | **sí**; el gate fallaría |

### 8.3 Lo que el audit todavía no ve

- Marca `.truncate` como intencional. Por eso **no detecta B7**: la fila de Actividad puede decir `1 CASO C…` y el audit sigue en verde.
- No mide tinta entre líneas más allá de la nueva regla `line-height/font-size < 1`; B4 se arregló, pero el audit no es suficiente como puerta única.
- El recorte de `$2,092.00` a 360 ya lo habría detectado en su corrida; ahora no aparece porque el monto envuelve.

---

## 9 · Contrato y calidad — 41/41

| Comprobación | Resultado |
|---|---|
| Tabs conservan estado/scroll; `aria-current` único y cambia | **pass** (Caja 700 → Fiado/Corte → Caja 700) |
| Sidebar 220 px a 768 / 240 px a 1280 | **pass** |
| Fiado: método Efectivo/Digital, nota, descarte, “Seguir editando” conserva, “Descartar” cierra | **pass** |
| Fiado: abono persiste `1000`, `codi`, `nota verificador f3-4`; no crea venta | **pass** |
| Corte task-first; “Falta”/“Sobra”; confirmación; guardado durable | **pass** (`counted=100`, diferencia `-56900`) |
| Errores inline de venta y Verificar; foco al campo/resultado | **pass** (el error de red de Verificar muestra “Failed to fetch”, ver M2) |
| Verificar: foco al resultado y “No entregues el pedido.” | **pass** |
| Checkout: total 40 → 80 px al 200% | **pass** |
| Checkout: redirect real por código a `paymentUrl` | **pass** (respuesta de `/api/checkout` interceptada; URL final `…/__redirect-sentinel`) |
| `aria-busy` al confirmar venta, abonar, pagar checkout | **pass** (observado `true` en los tres) |
| Subtítulos 15 px | **pass** |
| TopBar 200% sin `.truncate` ni overflow | **pass** |
| Foto de Meta fuera de la tarjeta, con alt | **pass** (fuente: `caja-app.tsx:2710-2723`, tarjeta en `2725`) |
| `h1` visible único en Caja/Fiado/Corte/Meta; “Corte de caja” | **pass** |
| Sheet no cierra durante el pago | **pass** |
| Un `h1` en checkout/éxito | **pass** |

---

## 10 · Hallazgos

### B7 · Bloqueante · Actividad trunca la descripción de la venta al 200%

**Pasos**

1. `POST /api/demo/reset`.
2. Crear una venta con descripción `CASO Cobro General` por `$90.00` (o usar una venta real de varios productos, p. ej. `3 Quesadillas · 2 Agua de horchata`).
3. Abrir Caja a 360×800, 390×844 y 768×1024.
4. Aplicar `html { font-size: 200% !important; }`.
5. Medir el `p.truncate` de la fila en “Últimos movimientos”.

**Selector:** `web/src/components/caja-app.tsx:3053`, `p.truncate.text-sm.font-semibold.text-ink` dentro de `ActivityList`.

**Resultado observado**

| Viewport | Texto | `clientWidth` | `scrollWidth` | CSS | Visual |
|---|---|---|---|---|---|
| 360 | `1 CASO Cobro General` | 190 | 348 | `text-overflow:ellipsis; white-space:nowrap; overflow:hidden` | `1 CASO C…` |
| 390 | igual | 220 | 348 | igual | `1 CASO C…` |
| 768 | igual | 330 | 348 | igual | `1 CASO C…` |
| 1280 | igual | — | — | no trunca | completo |

- `font-size` 34 px; el texto completo solo se ve al abrir el sheet de la fila.
- El `<button>` de la fila conserva el nombre accesible completo, pero la información visual esencial se pierde para quien usa 200%.
- El defecto aparece en Caja y en la pantalla de fondo de Demo/Guía/Verificar/Cobro; en las capturas `general-caja-360-200.png` y `m1-activity-360-200.png` se ve `1 CASO C…`.

**Por qué es bloqueante:** el criterio 6 de esta ronda exige 200% sin clipping en Caja; `HIG-DESIGN.md` §4.2 dice que `truncate` solo se usa para IDs/links secundarios y §9 exige 200% sin texto recortado. La descripción de la venta es información esencial, no un ID.

**Reparación esperada:** quitar `.truncate` de esa fila y usar `break-words`/envoltura como en los nombres de Fiado, permitiendo que la fila crezca. Repetir B4/B5/B6, el 200% general y el audit; el audit seguirá sin verlo si la clase `.truncate` permanece.

### M1 · Mayor (nuevo) · La analítica de Corte parte el monto de 4 cifras entre líneas

- 360: `$2,092.` / `00`; 390 igual; 768/1280 en una línea.
- No hay clipping ni scroll; el valor completo está presente.
- Impacto: una cifra de dinero partida entre decimales es fácil de leer mal. No la cuento como bloqueante porque no se pierde texto, pero debe corregirse antes de F4 si se quiere cumplir “claridad” y no solo “sin recorte”.
- Evidencia: `b5-card-360-200.png`, `b5-amount-360-200.png`.

> Nota de numeración: el “M1” del informe anterior era la truncación de Actividad; en esta ronda pasa a ser **B7** por incumplir el criterio de 200%. El M1 de este informe es el corte de línea del monto de Corte.

### M2 · Menor · Error de red de Verificar en inglés

- Al abortar `/api/verify`, el sheet muestra “No se pudo verificar” y debajo **“Failed to fetch”**.
- El contrato pide qué pasó + qué hacer, en español. Es un camino de error, no el flujo feliz.
- Evidencia: `contract-results.json`, comprobación “Verificar: error inline”.

### M3 · Menor · El toast puede tapar el encabezado del sheet al 200%

- Tras “Listo para entregar”, el toast “Pedido entregado.” (z-80, ancho máximo) queda encima del sheet (z-60) durante ~3 s. A 360 al 200% cubre el título y el botón X del header; el toast tiene su propio “Cerrar aviso”, y Escape/backdrop siguen funcionando.
- Captura: `b4-payment-panel-360-200.png` (antes de que desapareciera el toast).
- No es bloqueante; el toast es transitorio y cerrable, pero incumple la idea de “no cubre un CTA”.

### M4 · Menor · Token `attention` no coincide con el contrato

- `web/src/app/globals.css:14` usa `#9c4e2b`; `HIG-DESIGN.md` §4.1 define `#A6532F`.
- Uso coherente y contraste suficiente; no cambia la semántica. Ya venía del informe anterior.

### M5 · Menor · Actividad no muestra “Entregado” después de `fulfilled`

- Tras entregar un demo o efectivo, la fila sigue diciendo “Demo”/“Efectivo”; el sheet sí cambió de estado.
- El contrato no define el badge de `fulfilled`, pero la comerciante no ve el resultado en la lista.

### M6 · Menor · El footer de los sheets no es fijo

- El contrato 5.4 pide header y footer fijos; el componente deja las acciones dentro del cuerpo scrollable. A 200% son alcanzables, por eso no es bloqueante.

### M7 · Menor · Dos acciones verdes en Caja

- El micrófono y “Confirmar venta” usan el color de acento; el contrato 5.1 pide un solo `primary` por vista. Es una observación de jerarquía.

---

## 11 · Lo que sí pasa (reproducido por mí)

- Verdad de los 9 estados de pago, incluido efectivo + demo, efectivo + pey y triple.
- Entrega desde `PaidSheet` y desde Actividad; `PATCH` 409/idempotente.
- Foco: 10/10 secuencias, 300/300 Tab/Shift+Tab, Escape/backdrop y retorno exacto al disparador; nunca `BODY`.
- Pago en curso: Escape/backdrop no cierran; un solo `PaidSheet`.
- B4 en Caja, Meta, Corte, `PaidSheet` y `PaymentPanel` pagado, a 4 viewports.
- B5 sin clipping ni scroll horizontal, con $2,092.00 y 4 cifras.
- B6 con 7 clientes y nombres largos completos.
- 200% general en 12 pantallas/estados × 4 viewports: 0 overflow, 0 viewport expandido, 0 controles colapsados, 0 targets <44, 0 solapes, 0 line-height <1.
- Fiado: método, nota, descarte, persistencia y “no crea venta”.
- Corte: task-first, Falta/Sobra, confirmación y guardado durable.
- Checkout 40→80 px, `aria-busy`, error inline, redirect por código.
- Tabs/scroll, sidebar, subtítulos 15, TopBar, foto de Meta, `h1`, `aria-busy`.
- Lint, TypeScript, build, webhook 27 aserciones de esa fase; `:3000` intacto; 3001 restaurado.

---

## 12 · Lo que no pude probar

- Pago real de $0.01, `DEMO_MODE=false` en runtime, redirect real a pey y webhook real de pey. El redirect se probó interceptando la respuesta de `/api/checkout/{id}`; no se cambió `DEMO_MODE` ni se movió dinero.
- Teléfono físico 360, iOS/Safari, Android, safe area física, VoiceOver/NVDA.
- Micrófono/transcripción reales, QR escaneado, `navigator.share`, offline, conciliación real, CLS/LCP/Lighthouse.
- 200% con zoom de navegador real o zoom de texto del sistema; usé el mismo `html { font-size: 200% }` del audit oficial.
- Algunos estados de 200% no cubiertos por mi suite: confirmación de reset de demo al 200% (el sheet normal sí), todos los estados de `PaymentPanel` pagado a 768/1280 (360/390 medidos), y detalle de todos los sheets a 768/1280.
- La app de `:3000` no se usó ni modificó; solo comprobé que sigue respondiendo con el mismo proceso y hash.

---

## 13 · Conclusión

**NO LISTO para F4.**

B4, B5 y B6 están reparados y los bloqueantes anteriores que se me pidió reproducir pasan. El gate sigue abierto por **B7**: la fila de Actividad de Caja trunca la descripción de la venta con `ellipsis` a 360/390/768 al 200%. Es un recorte de información esencial, no un detalle cosmético, y el audit oficial no lo detecta porque trata `.truncate` como intencional.

La corrección es pequeña: reemplazar `truncate` por `break-words` en `caja-app.tsx:3053` y permitir que la fila crezca. Después hay que repetir B4, B5, B6, el 200% general y el audit; el veredicto no se hereda. Si además se corrige el corte del monto de `$2,092.00` en dos líneas (M1), mejorará la claridad, pero eso no es lo que bloquea el F4 en esta ronda.
