# P0-D · Corte no destructivo + cierre versionado

**Carril:** `p0/corte`  
**Worktree:** `mercado-cero-corte`  
**Base:** `db47540` (`master` con P0-A/B/C/C.1/E/F/G y voz mergeados)  
**Commit de código verificado:** `e0fc8cef816c0e34acf238ce486c99b71b109ed1`  
**Estado:** implementado y verificado en el carril; **sin merge**.

---

## 1 · Qué cambió

### 1.1 Borrador local que no se pisa

- El conteo vive en el estado del componente, que sigue montado en la sección
  oculta del tab (`<section hidden={tab !== "corte"}>`). Cambiar de tab no lo
  reinicia.
- `load()` distingue dos modos:
  - carga completa (montaje o refresco sin cambios): llena campos y totales;
  - `load({ preserveDraft: true })`: actualiza **solo** `CashStatus` (totales,
    corte guardado e historial) y deja intactos apertura, gastos, retiros,
    contado, base y conteo por denominación.
- Si llega `mercado:refresh` (venta, cobro, refresco global) con cambios sin
  guardar, **no** se llama a `load()`: se marca `stale` y se muestra el aviso
  “Hay cambios sin guardar.” con la acción explícita **“Actualizar totales”**.
- Esa acción refresca los totales del servidor con `preserveDraft` y conserva
  el conteo. No hay autoguardado ni envío automático del corte.
- El botón de refrescar de la cabecera también usa `preserveDraft` cuando hay
  cambios.

### 1.2 Validación

- Todos los montos se leen con un parser estricto:
  - acepta `400`, `400.5`, `400,50`;
  - rechaza texto, más de dos decimales y números negativos;
  - distingue vacío de inválido (el mensaje de error no es el placeholder).
- Contado vacío o `0` no guarda; el error se muestra inline y el foco va al
  campo `#corte-contado`.
- Base negativa o no numérica no guarda; el foco va a `#corte-base-next`.
- Base mayor que el contado se **bloquea** (decisión conservadora): aviso
  inline, botón deshabilitado y el servidor también responde `400`
  `base_exceeds_counted`.
- La confirmación siempre se abre (no guarda de golpe cuando la diferencia es
  cero) y muestra **gastos, retiros, debería haber, contado y base**.
- La diferencia de la confirmación viene de `POST /api/cash/preview`, que la
  calcula con los totales vivos del servidor. El aviso posterior al guardado
  usa `close.differenceCents` devuelto por el servidor. La cifra inline del
  formulario se rotula “Diferencia estimada” y una nota aclara que el servidor
  la recalcula al confirmar.

### 1.3 Cierre versionado en SQLite

- `cash_closes` deja de tener una sola fila por fecha. Ahora cada guardado es
  una fila inmutable con `version`.
- La versión 1 se crea sin motivo. Un segundo guardado exige `reason` no vacío
  y crea la versión 2; la versión 1 no se actualiza ni se borra. Los siguientes
  guardados crean 3, 4, …
- Cada fila guarda un snapshot del negocio al cerrar:
  - `snapshot_cash_cents`: efectivo cobrado del día (ventas en efectivo +
    abonos de fiado en efectivo);
  - `snapshot_credit_cents`: saldo total de fiado pendiente;
  - `snapshot_pending_digital_cents`: pendiente de cobro digital del día.
- El resumen posterior y el historial leen filas guardadas, no recalculos: una
  venta o un fiado posteriores no cambian la foto.
- `audit("cash.close", "cash_close", id, { date, version, reason, countedCents,
  expectedCents, differenceCents, baseNextCents })` se escribe en la misma
  transacción que el cierre.
- `resetDemoData()` sigue borrando `cash_closes`; no hay datos fantasma.

### 1.4 UI

- Después de guardar se muestra **“Corte #N”** con fecha, efectivo del día,
  fiado pendiente, pendiente digital, contado y diferencia.
- Historial breve de hasta 5 versiones de hoy, con número, hora, contado,
  diferencia y motivo de corrección. La versión 1 permanece visible.
- Cuando ya hay un corte, el botón principal dice **“Corregir corte”** y la
  hoja pide un motivo obligatorio (máx. 280 caracteres). Sin motivo no se
  guarda.
- Se añadió la **Base inicial** como campo editable (antes solo se mostraba
  como dato). Gastos y retiros ya existían.
- Sin rediseño: misma tarjeta, mismos tokens y misma dirección “Mostrador
  claro”. Los controles conservan 48 px (`min-h-12`), el foco global
  `:focus-visible` y los errores `role="alert"`/`aria-invalid`.
- Probado a 360 px y a 360 px con `font-size: 200%` sin overflow horizontal y
  sin palabras partidas.

---

## 2 · Esquema

```sql
CREATE TABLE cash_closes (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  opening_cents INTEGER NOT NULL DEFAULT 0,
  cash_sales_cents INTEGER NOT NULL DEFAULT 0,
  cash_credit_cents INTEGER NOT NULL DEFAULT 0,
  expenses_cents INTEGER NOT NULL DEFAULT 0,
  withdrawals_cents INTEGER NOT NULL DEFAULT 0,
  expected_cents INTEGER NOT NULL DEFAULT 0,
  counted_cents INTEGER NOT NULL DEFAULT 0,
  difference_cents INTEGER NOT NULL DEFAULT 0,
  base_next_cents INTEGER NOT NULL DEFAULT 0,
  withdrawal_next_cents INTEGER NOT NULL DEFAULT 0,
  snapshot_cash_cents INTEGER NOT NULL DEFAULT 0,
  snapshot_credit_cents INTEGER NOT NULL DEFAULT 0,
  snapshot_pending_digital_cents INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(date, version)
);
CREATE INDEX idx_cash_closes_date ON cash_closes(date);
```

### Migración de una DB existente

`migrateCashCloses()` detecta si falta la columna `version`:

1. renombra la tabla vieja a `cash_closes_legacy`;
2. crea la tabla nueva;
3. copia cada fila vieja como `version = 1`, con
   `snapshot_cash_cents = cash_sales_cents + cash_credit_cents` y snapshots de
   fiado/digital en `0` (no se conocían al momento de ese cierre);
4. elimina la tabla vieja y recrea el índice.

Probado manualmente con una DB de esquema viejo (`cash_closes` con
`UNIQUE(date)`): el servidor arrancó, `/api/cash` devolvió la fila como versión
1 y la migración no perdió montos. En bases ya versionadas, el código añade por
`ALTER TABLE` cualquier columna nueva que falte.

---

## 3 · Endpoints

### `GET /api/cash`

Devuelve `CashStatus`:

```json
{
  "date": "2026-11-01",
  "openingCents": 50000,
  "cashSalesCents": 7000,
  "cashCreditCents": 0,
  "expensesCents": 0,
  "withdrawalsCents": 0,
  "expectedCents": 57000,
  "saved": { "version": 2, "...": "..." },
  "history": [{ "version": 2 }, { "version": 1 }]
}
```

`saved` es la última versión; `history` trae hasta 5, la más reciente primero.

### `POST /api/cash/preview`

Calcula sin escribir. Cuerpo:

```json
{
  "openingCents": 50000,
  "expensesCents": 1000,
  "withdrawalsCents": 500,
  "countedCents": 55500,
  "baseNextCents": 40000
}
```

Respuesta `200`:

```json
{
  "status": { "...": "..." },
  "preview": {
    "openingCents": 50000,
    "expensesCents": 1000,
    "withdrawalsCents": 500,
    "countedCents": 55500,
    "baseNextCents": 40000,
    "cashSalesCents": 7000,
    "cashCreditCents": 0,
    "expectedCents": 55500,
    "differenceCents": 0,
    "withdrawalNextCents": 15500
  },
  "issues": []
}
```

`issues` puede traer `counted_required` o `base_exceeds_counted`.

### `POST /api/cash/close`

Mismo cuerpo que el preview y `reason?: string`.

- `200`: `{ close, status }` con la versión recién creada.
- `400 invalid_close`: montos inválidos (Zod).
- `400 counted_required`: contado vacío/0.
- `400 base_exceeds_counted`: base > contado.
- `400 reason_required`: ya existe un cierre y no se envió motivo.
- `500`: fallo inesperado.

El cierre se escribe dentro de `BEGIN IMMEDIATE`; relee la última versión y los
totales bajo lock para no pisar una corrección concurrente.

---

## 4 · Archivos

- `web/src/lib/db.ts` — esquema versionado, migración y seed del corte de ayer.
- `web/src/lib/cash.ts` — estado, preview, cierre transaccional, snapshots y
  auditoría.
- `web/src/lib/types.ts` — `CashClose` versionado, `CashClosePreview` y
  `CashStatus.history`.
- `web/src/app/api/cash/close/route.ts` — validación Zod y errores con código.
- `web/src/app/api/cash/preview/route.ts` — diferencia calculada por el
  servidor sin escribir.
- `web/src/components/caja-app.tsx` — `CashCloseCard`: borrador no destructivo,
  validación inline, confirmación con preview, resumen, historial y corrección
  con motivo.
- `web/scripts/p0-corte-e2e.py` — E2E aislado en `:3101`.
- `harness/evidence/p0-corte-e2e.json`,
  `harness/evidence/p0-corte-360.png`,
  `harness/evidence/p0-corte-360-200.png` — evidencia generada.
- `harness/STATE.md` — handoff del carril.

---

## 5 · Gates

Ejecutados desde `web/`:

| Gate | Resultado |
|---|---|
| `npm ci` | OK (385 paquetes) |
| `npm run lint` | OK, sin salida |
| `npx tsc --noEmit` | OK (después de `next build`, que genera `.next/types`) |
| `npm run build` | OK, 23 rutas; incluye `/api/cash/preview` |

Nota: `npx tsc --noEmit` en un checkout limpio falla antes del primer build
porque Next 16 genera `RouteContext`, `LayoutProps` y tipos de ruta en
`.next/types`; no es un error introducido por este carril.

---

## 6 · E2E

Comando:

```bash
cd web
python scripts/p0-corte-e2e.py
```

Resultado: **39 PASS · 0 FAIL · 0 KNOWN**. El script levanta su propio
`npm start` en `:3101` con una DB temporal, la reinicia con `/api/demo/reset` y
la elimina al final. Nunca apunta a `:3000`. La evidencia quedó generada con
`code.commit = e0fc8cef816c0e34acf238ce486c99b71b109ed1` y `dirty: false`.

Casos cubiertos:

1. Contar y provocar `mercado:refresh`, una venta real por API y cambio de tab:
   los cinco campos y el conteo siguen; 0 POST de cierre automáticos.
2. “Actualizar totales” refresca las ventas del servidor (+$50.00) sin borrar
   el conteo.
3. Contado vacío, contado 0, base no numérica y base negativa: error inline,
   foco en el campo, 0 POST.
4. Base $400 con contado $1: aviso y botón bloqueado.
5. Venta entre el conteo y la confirmación: la copia local dice “Cuadra”, pero
   la confirmación muestra la diferencia **del servidor** (“Falta $50.00”) y no
   guarda nada.
6. Confirmación con gastos, retiros, debería haber y diferencia del servidor.
7. Primer cierre: versión 1, snapshot efectivo/fiado/digital y
   `audit("cash.close")` versión 1.
8. Corrección sin motivo: no guarda y enfoca el motivo; con motivo crea versión
   2 y conserva la 1. Historial visible con ambas y el motivo.
9. Venta y fiado posteriores: el snapshot y el resumen del corte #2 no cambian;
   SQLite conserva la foto.
10. 360 px sin overflow horizontal y sin palabras partidas; 360 px a 200 %
    (CSS inyectado) ídem.
11. 0 peticiones del navegador a `:3000`; puerto `:3101`.

### Migración

Verificación manual adicional con una DB de esquema viejo: la fila existente
quedó como `version = 1`, `reason = NULL`, `snapshot_cash_cents = 1000` y
`/api/cash` la sirvió correctamente.

---

## 7 · PASS / FAIL / KNOWN

| Área | Estado |
|---|---|
| Borrador no destructivo | PASS |
| Validación inline y foco | PASS |
| Base > contado bloqueada | PASS |
| Confirmación con gastos/retiros/debería haber | PASS |
| Diferencia del servidor | PASS |
| Versión 1 inmutable + versión 2 con motivo | PASS |
| Auditoría con versión y motivo | PASS |
| Snapshot inmutable tras movimientos | PASS |
| Migración de DB existente | PASS (manual) |
| Reset de demo | PASS |
| 360 px / 200 % | PASS |
| TalkBack/VoiceOver y teléfono físico | KNOWN (no probado) |
| Zoom real de navegador | KNOWN (se inyectó `font-size: 200%`) |
| Personas / SUS / NASA-TLX | KNOWN (fuera de este carril) |

---

## 8 · Riesgos y decisiones

- **Base > contado se bloquea, no solo se advierte.** Es la opción conservadora
  permitida por la auditoría. Si el negocio necesita permitir una base mayor
  (por ejemplo, cambio que no se contó), habría que cambiar la regla en
  `closeCash` y en el formulario.
- **Contado 0 no se guarda.** Un cierre con caja vacía no es representable hoy.
  La auditoría lo pedía explícitamente; si se necesita, habría que distinguir
  “vacío” de “cero declarado”.
- **El borrador sobrevive al cambio de tab y a `mercado:refresh`, no a un
  recargado completo del navegador.** La auditoría pedía el tab montado; no se
  agregó `localStorage` para no confundir borrador con autoguardado.
- **La foto de fiado es global** (`SUM(balance_cents)` de créditos no
  liquidados), no solo del día. Es la misma cifra que usa el resumen diario.
- **La foto de pendiente digital** usa el pendiente del día de
  `getDailySummary()`. No incluye pedidos pendientes de fechas anteriores.
- **Preview añade un viaje al servidor** al abrir la confirmación. Si falla, la
  hoja muestra “Reintentar” y no deja guardar hasta tener la diferencia del
  servidor; es deliberado para no mostrar una cifra local.
- **Una corrección concurrente** se serializa con `BEGIN IMMEDIATE` y
  `UNIQUE(date, version)`. Si dos pestañas guardan a la vez, la segunda crea la
  siguiente versión; si no trae motivo, recibe `reason_required`.
- **El historial se limita a 5 versiones en la API.** Las versiones anteriores
  siguen en SQLite; no hay endpoint para paginarlas.
- **No hay exportación/impresión del corte** ni reconciliación pey dentro del
  cierre (P1 según la auditoría).

---

## 9 · Qué falta para integrar

1. Revisión independiente del diff (especialmente migración y transacción).
2. Merge por el orquestador; este carril **no** hace merge.
3. Correr `npm run verify:full` en `master` después del merge y actualizar
   `harness/evidence/latest.json`.
4. Decidir producto: ¿se permite contado 0 y base > contado en algún caso?
5. Pruebas humanas pendientes: 6–8 comerciantes, SUS/NASA-TLX, teléfono físico,
   TalkBack/VoiceOver, zoom real y alto contraste.
6. Si se quiere borrador tras recargar, diseñar persistencia explícita
   (no autoguardado) con confirmación de descarte.

---

## 10 · Confirmación de aislamiento

- No se tocó `mercado-cero` (worktree principal) ni el puerto `:3000`.
- No se tocaron pagos, webhook, `pey`, `/api/verify` ni `paymentTruth`.
- El E2E corrió en `:3101` con DB temporal y verificó 0 peticiones a `:3000`.
- No se hizo merge a `master`.
