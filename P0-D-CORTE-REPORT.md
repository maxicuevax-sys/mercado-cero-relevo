# P0-D · Corte no destructivo + cierre versionado

**Carril:** `p0/corte`  
**Worktree:** `mercado-cero-corte`  
**Base:** `db47540` (`master` con P0-A/B/C/C.1/E/F/G y voz mergeados)  
**Commit de código verificado:** `efd1539b41a9032a864411475220a9af209c59fb`
**Estado:** correcciones de la revisión independiente aplicadas; **sin merge**.

---

## 0 · Respuesta a la revisión independiente

La revisión pidió **CAMBIOS NECESARIOS**. Esto es lo que se corrigió, en el
mismo orden:

| # | Hallazgo | Corrección | Evidencia |
|---|---|---|---|
| 1 | Carrera de `load()` | `dirtyRef` se consulta **al resolver** el fetch: si el usuario ya escribió, solo se actualiza `status` y se marca `stale`; nunca se llama a `fillFromStatus`. | E2E “refresh limpio no pisa lo escrito mientras carga”. |
| 2 | Migración y snapshots | Migración en `BEGIN IMMEDIATE … COMMIT` con recuperación de `cash_closes_legacy`; columna `snapshot_known`; backfill conservador; filas viejas muestran “No registrado”. | E2E de esquema viejo, de migración interrumpida y de esquema ya versionado. |
| 3 | Retiro previo en corrección | Checkbox explícito “Ya retiré $X del corte #N”; suma a retiros/esperado solo si se marca. | E2E cerrar → retirar → vender → corregir, con y sin checkbox. |
| 4 | Idempotencia y concurrencia | `requestId` único idempotente, `expectedVersion` obligatorio con `409 version_conflict`, lectura por `closeId`, mensaje de `reason_required` persistente. | E2E doble envío, versión vieja, dos pestañas y `reason_required` tras recargar. |
| 5 | Historial | La API devuelve las últimas 5 versiones **más la v1**; la UI lo rotula cuando hay más de 5. | E2E de 6 versiones: `[6,5,4,3,2,1]`. |
| 6 | Preview fuera de orden | Token de petición: las respuestas viejas se ignoran al cerrar/reabrir o cambiar de conteo. | E2E con la primera respuesta retrasada y alterada; gana la segunda. |
| 7 | Contrato/errores | `counted_required` sale de `closeCash` (Zod permite 0), JSON malformado → `400 invalid_json`, `setStale(true)` si falla un refresco con status cargado, label “Pendiente digital de hoy”. | E2E de contrato, refresco fallido y resumen. |
| 8 | Evidencia | El check de puerto acepta cualquier puerto aislado distinto de `:3000`; migración corre en un segundo puerto temporal. | E2E “puerto aislado, nunca :3000”. |

---

## 1 · Qué cambió

### 1.1 Borrador local que no se pisa

- El conteo vive en el estado del componente montado en la sección oculta; el
  cambio de tab no lo reinicia.
- `load()` distingue carga completa de `preserveDraft`.
- **Carrera corregida:** si el fetch resuelve después de que el usuario empezó a
  escribir, `dirtyRef.current` es `true`; se actualiza `status` y se marca
  `stale`, pero **no** se llenan campos ni se limpia `dirty`.
- `mercado:refresh` con cambios sin guardar no llama a `load()`; muestra “Hay
  cambios sin guardar.” y la acción “Actualizar totales”, que refresca solo
  totales del servidor.
- Si el refresco falla con status ya cargado, se marca `stale` y el aviso dice
  “Los totales del servidor pueden haber cambiado.”
- No hay autoguardado ni envío automático.

### 1.2 Validación

- Parser estricto de montos: acepta `400`, `400.5`, `400,50`; rechaza texto,
  negativos y más de dos decimales; distingue vacío de inválido.
- Contado vacío/0 no guarda, error inline y foco en `#corte-contado`.
- Base negativa/no numérica no guarda, foco en `#corte-base-next`.
- Base > contado se bloquea en cliente y servidor (`base_exceeds_counted`).
- La confirmación muestra gastos, retiros, debería haber, contado y base.
- La diferencia de la confirmación viene de `POST /api/cash/preview`; el aviso
  guardado usa `close.differenceCents`. La cifra inline se rotula “Diferencia
  estimada”.

### 1.3 Cierre versionado en SQLite

- Cada guardado es una fila inmutable con `version`, sin upsert destructivo.
- La v1 no lleva motivo. La v2+ exige `reason` no vacío.
- `snapshot_known` distingue snapshots reales de filas migradas:
  - `true` en cierres nuevos;
  - `false` en filas viejas donde fiado/pendiente digital no se registraban.
- La UI muestra **“No registrado”** para fiado/digital cuando
  `snapshotKnown === false`, nunca `$0.00` silencioso.
- Snapshots guardados: efectivo cobrado, fiado total y pendiente digital del día.
- `audit("cash.close", …)` incluye `version`, `reason`, `requestId` y
  `expectedVersion`, dentro de la misma transacción.
- `resetDemoData()` sigue borrando `cash_closes`.

### 1.4 Retiro previo explícito

- Cuando hay un corte guardado con `withdrawalNextCents > 0`, la corrección
  ofrece:
  **“Ya retiré $X del corte #N”** con checkbox.
- Si se marca, se suma a retiros y al esperado del preview/cierre; si no, no se
  suma. El resumen y la confirmación muestran “Incluye retiro previo del corte
  #N”.
- Después de guardar, el campo Retiros queda con el total y el checkbox se
  reinicia.

### 1.5 Idempotencia, concurrencia e historial

- `requestId` viaja en el cierre y tiene índice único parcial.
- Reintentar la misma llave devuelve la misma fila; no duplica.
- `expectedVersion` es obligatorio. Si no coincide con la última versión:
  `409 version_conflict` con `currentVersion`.
- La respuesta posterior al `COMMIT` se lee por `id`, no “la última”, evitando
  el 500 si otra pestaña guarda entre medio.
- `reason_required` y `version_conflict` cierran la hoja, muestran toast y
  **dejan el mensaje visible después de `load()`**.
- Historial: últimas 5 + v1; máx. 6 filas en la API. Con más de 5 se rotula “Se
  muestran las últimas 5 versiones y la primera.”

### 1.6 Preview

- `previewTokenRef` invalida respuestas viejas al abrir, cerrar o reintentar.
- La confirmación solo se habilita cuando la respuesta vigente llegó.

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
  snapshot_known INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(date, version)
);
CREATE INDEX idx_cash_closes_date ON cash_closes(date);
CREATE UNIQUE INDEX idx_cash_closes_date_version ON cash_closes(date, version);
CREATE UNIQUE INDEX idx_cash_closes_request_id
  ON cash_closes(request_id) WHERE request_id IS NOT NULL;
```

### Migración

Todo corre en `BEGIN IMMEDIATE … COMMIT`; cualquier fallo hace `ROLLBACK`.

1. **Esquema viejo** (`cash_closes` sin `version`): se reconstruye la tabla; la
   fila anterior queda como v1 con `snapshot_known = 0` y
   `snapshot_cash_cents = cash_sales_cents + cash_credit_cents`.
2. **Migración interrumpida** (solo `cash_closes_legacy` o ambas): se recuperan
   las filas que falten y se elimina la legacy.
3. **Esquema ya versionado sin `snapshot_known`/`request_id`**: se agregan por
   `ALTER TABLE`; `snapshot_known` nace en 0 y se hace backfill solo cuando
   fiado o pendiente digital tienen un valor > 0. Un cero viejo no se presenta
   como cero real.

Los tres escenarios están automatizados en el E2E.

---

## 3 · Endpoints

### `GET /api/cash`

Devuelve `CashStatus` con `saved` (última versión) e `history` (últimas 5 +
v1). Cada `CashClose` incluye `version`, `snapshotKnown`, `requestId` y
`reason`.

### `POST /api/cash/preview`

Calcula sin escribir. Cuerpo:
`openingCents`, `expensesCents`, `withdrawalsCents` (ya con el retiro previo si
se marcó), `countedCents`, `baseNextCents`.

Respuesta `200` con `preview` e `issues` (`counted_required`,
`base_exceeds_counted`). JSON malformado → `400 invalid_json`.

### `POST /api/cash/close`

Mismo cuerpo que preview más:

- `reason?: string` (obligatorio desde la v2);
- `requestId?: string` (idempotencia);
- `expectedVersion: number` (**obligatorio**; 0 para el primer corte).

Errores:

- `400 invalid_json` — cuerpo no parseable.
- `400 invalid_close` — Zod (montos, versión esperada).
- `400 counted_required` — contado 0 (validado en `closeCash`, no en Zod).
- `400 base_exceeds_counted` — base > contado.
- `400 reason_required` — ya existe corte y no hay motivo.
- `409 version_conflict` — `expectedVersion` no coincide; incluye
  `currentVersion`.
- `500` — fallo inesperado.

La llave idempotente se busca antes de validar; un reintento devuelve la fila
original. La respuesta se lee por `closeId`.

---

## 4 · Archivos

- `web/src/lib/db.ts` — esquema, migración transaccional/recovery, backfill.
- `web/src/lib/cash.ts` — versiones, idempotencia, `expectedVersion`,
  snapshots, historial y lectura por id.
- `web/src/lib/types.ts` — `snapshotKnown`, `requestId`, preview.
- `web/src/app/api/cash/close/route.ts` — contrato, JSON malformado, 409.
- `web/src/app/api/cash/preview/route.ts` — preview y JSON malformado.
- `web/src/components/caja-app.tsx` — carrera de `load`, retiro previo, token de
  preview, mensajes persistentes, resumen/historial.
- `web/scripts/p0-corte-e2e.py` — E2E aislado + migración automatizada.
- `harness/evidence/p0-corte-e2e.json` y capturas 360/200.
- `harness/STATE.md` — handoff del carril.

---

## 5 · Gates

Ejecutados desde `web/`:

| Gate | Resultado |
|---|---|
| `npm ci` | OK |
| `npm run lint` | OK |
| `npx tsc --noEmit` | OK (después de `next build`, que genera `.next/types`) |
| `npm run build` | OK, 23 rutas, incluye `/api/cash/preview` |
| `node scripts/harness-guard.mjs` | OK |

No se corrió `verify:full` (se hace al mergear).

---

## 6 · E2E

```bash
cd web
python scripts/p0-corte-e2e.py
```

Resultado: **69 PASS · 0 FAIL · 0 KNOWN**.

El script levanta su propio `npm start` en `:3101` con DB temporal y, para la
migración, un segundo servidor aislado en `:3102` (o el siguiente puerto libre).
Nunca usa `:3000`. Al final detiene ambos y borra las DB temporales. La
evidencia quedó generada con `code.commit = efd1539b41a9032a864411475220a9af209c59fb`
y `dirty: false`.

Casos:

1. Contar y provocar refresh, venta y cambio de tab; el borrador sigue.
2. Refresh limpio + escribir mientras carga: la respuesta no pisa el conteo.
3. Refresco fallido: conserva el conteo, muestra error y avisa que los totales
   pueden haber cambiado.
4. Validación: contado vacío/0, base no numérica/negativa, base > contado.
5. Confirmación con gastos/retiros/debería haber y diferencia del servidor,
   incluso con la copia local vieja.
6. Contrato API: `requestId` idempotente, `expectedVersion` 409, `reason_required`,
   `counted_required`, JSON malformado.
7. Historial de 6 versiones conserva v1.
8. Primer cierre v1 con snapshot.
9. Cerrar → retirar → vender → corregir: sin checkbox falta $155; con checkbox
   suma $155 a retiros y cuadra; v2 conserva v1.
10. `reason_required` visible después de recargar y sin duplicar.
11. Dos pestañas: 409 visible y sin duplicar.
12. Preview fuera de orden: la respuesta vieja no pisa la nueva.
13. 360 px y 360/200 sin overflow ni palabras partidas.
14. Migración vieja → v1 desconocida → v2 conocida.
15. Migración interrumpida con `cash_closes_legacy`.
16. Esquema ya versionado: agrega columnas y marca snapshot desconocido.
17. 0 peticiones a `:3000`; puertos aislados.

---

## 7 · PASS / FAIL / KNOWN

| Área | Estado |
|---|---|
| Carrera de `load()` | PASS |
| Validación y foco | PASS |
| Base > contado | PASS |
| Confirmación con diferencia del servidor | PASS |
| Retiro previo explícito | PASS |
| Versiones inmutables y motivo | PASS |
| Idempotencia (`requestId`) | PASS |
| Concurrencia (`expectedVersion` 409) | PASS |
| Mensaje `reason_required` persistente | PASS |
| Historial conserva v1 | PASS |
| Preview fuera de orden | PASS |
| Migración vieja / recovery / versionada | PASS |
| 360 px / 200 % | PASS |
| TalkBack/VoiceOver y teléfono físico | KNOWN (no probado) |
| Zoom real de navegador | KNOWN (CSS `font-size: 200%`) |
| Personas / SUS / NASA-TLX | KNOWN (fuera del carril) |

---

## 8 · Riesgos y decisiones

- **Contado 0 se bloquea** y **base > contado se bloquea**. Son decisiones de
  producto explícitas; si el negocio necesita permitirlos, hay que cambiar la
  regla en `closeCash` y el formulario.
- **`snapshot_known = false`** significa “no se registraba fiado/digital al
  cerrar”. No se inventa un cero. En filas versionadas viejas con fiado/digital
  en cero el backfill conserva la duda (desconocido).
- **El retiro previo no es automático**: solo se suma si la persona marca el
  checkbox. Si no lo marca, el sistema puede mostrar un faltante real.
- **El borrador sobrevive a tab y `mercado:refresh`, no a recargar el
  navegador.** No se agregó `localStorage` para no confundirlo con autoguardado.
- **`reason_required` se evalúa antes que `expectedVersion`.** Un primer guardado
  viejo sin motivo recibe el mensaje accionable de motivo; con motivo recibe
  409. Está documentado y probado.
- **`requestId` se genera por apertura de confirmación.** Un reintento dentro de
  la misma hoja reutiliza la llave; si se cierra y otra pestaña ya guardó,
  `expectedVersion` evita el duplicado.
- **Historial máximo 6** (últimas 5 + v1); no hay paginación de versiones
  antiguas.
- **Preview depende de red**; si falla, no se guarda hasta reintentar y tener la
  diferencia del servidor.
- **Pruebas humanas pendientes**: 6–8 comerciantes, SUS/NASA-TLX,
  TalkBack/VoiceOver, teléfono físico, zoom real.

---

## 9 · Qué falta para integrar

1. Revisión independiente de esta segunda ronda.
2. Merge por el orquestador; este carril no hace merge.
3. `npm run verify:full` en `master` después del merge.
4. Decidir producto: contado 0 y base > contado.
5. Pruebas humanas y de accesibilidad reales.

---

## 10 · Confirmación de aislamiento

- No se tocó `mercado-cero` ni el puerto `:3000`.
- No se tocaron pagos, webhook, `pey`, `/api/verify` ni `paymentTruth`.
- El E2E corrió en `:3101` (y migración en `:3102`), con DB temporales; 0
  peticiones a `:3000`.
- No se hizo merge a `master` en el carril.

## 10 · Integración final (2 nov 2026)

- **Merge:** `9c85107`; endurecimientos posteriores en `9f7d02d` (`requestId` seguro fuera de contexto seguro, conteo inválido y checkbox tras 409).
- **E2E:** `p0-corte-e2e.py` **69/0/0** en `:3101` sobre `9f7d02d`.
- **Harness (histórico, corregido):** la corrida citada como “full 13 de 13 en `219b26f`” no es verificable en este worktree: `harness/evidence/latest.json` de esa época registra `gitAtStart.sha = 91ad4ee` y `git.dirty: true`, y el catálogo era anterior a `deps`. **No se usa como handoff.** El catálogo actual es 25 gates; `full` son 23 (24 con film).
- **Motion:** `motion-check.py` **19/0** (el reporte original decía 14/0); `contrast` axe 0; HIG axe 0, `under12=0`. El JSON de 91ad4ee tiene `code.dirty:true`; el carril a11y debe corregirlo para un full limpio.
- **Residuales:** migración pensada para un solo proceso `next start`; `requestId` no está atado al payload (la UI genera uno por apertura); los tests de dos contextos reales, 6 versiones en UI y migración parcial quedan como huecos de cobertura.
- **Fallback probado:** con `crypto.randomUUID = undefined` (contexto no seguro), el cierre guarda con `requestId` `close_…` y responde “Corte #1 guardado”.
