# Reporte P0 · venta sin IA y continuidad visible

- **Rama:** `p0/sin-ia`
- **Base:** `499a301` (`docs(cognitiva): contrato de carga y acompanamiento`)
- **Commits de código y test:**
  - `ddf2262` — `feat(caja): venta manual sin IA y borrador con decision`
  - `7b730bf` — `feat(caja): responder consultas locales antes del parser`
- **Build sellado:** `7b730bf62172a561e1ab726bc11e1564d77af31b`
- **Estado:** **PASS** (21/21 checks del E2E sin IA; gates estáticos en verde)
- **Alcance respetado:** sin cambios a webhook, estados de pago, cálculo de dinero ni dependencias.

## Qué cambió

### 1 · Venta manual evidente, incluso con el parser caído

- Se agregó **“Agregar a mano”** justo debajo del campo “Escribe la venta” y de
  “Interpretar”. Crea un renglón vacío, enfoca **Producto** y deja editar
  cantidad y precio.
- El camino ya existente (“Agregar producto” en la hoja, “Escribir productos”
  en el error) se conserva. No se duplicó lógica de dinero ni de creación de
  órdenes.
- Si `/api/voice/parse` falla (500/503, red caída o sin `OPENAI_API_KEY`), el
  error conserva el detalle útil y siempre termina en la salida manual:
  > No pude interpretar la venta. La IA no está disponible. Escribe el producto
  > o agrégalo a mano.
- El error muestra “Escribir productos” y el botón “Agregar a mano” sigue
  visible. **“Cobrar” nunca se bloquea por el fallo del parser.**
- El endpoint real de este repo es `/api/voice/parse`; no existe
  `/api/interpret`. La intercepción del E2E usa la ruta real.

### 2 · Consultas locales antes de tocar la red (P1-4)

`interpretText` ahora intenta, antes de `fetch("/api/voice/parse")`:

1. `answerDebtQuery(clean, dashboard.credits)` para “¿quién me debe?”,
   “¿cuánto me deben?”, fiado/deudas.
2. `answerLocal(clean)` si la frase es una consulta explícita de ventas,
   caja o pendientes (“¿Cuánto vendí?”, “¿Cuánto llevo?”, “¿Qué hay
   pendiente?”).

La detección es conservadora para no confundir una venta o un abono
(“Juan me pagó 50 del fiado”) con una consulta. Si no es consulta local, sigue
el flujo normal de interpretación.

### 3 · Banner de borrador recuperado con decisión explícita

- Copy: “Recuperé tu venta de las HH:MM” + “N productos · $importe. Nada se
  envía hasta que confirmes.”
- Acciones: **Seguir** y **Empezar de nuevo**.
- “Empezar de nuevo” abre una confirmación inline:
  “Se borrará esta venta. No se puede deshacer.” con **Cancelar** y
  **Sí, empezar de nuevo**.
- No se borra nada al primer clic. El foco pasa a la confirmación; “Cancelar”
  devuelve el foco a “Empezar de nuevo”; al confirmar, el foco cae en
  “Agregar producto”.
- “Seguir” conserva el borrador y enfoca el primer producto.
- Si el borrador recuperado fue editado, “Empezar de nuevo” **no borra la
  edición**: oculta el banner y avisa que se use “Limpiar”. Es la protección
  que ya existía y se mantuvo.

### 4 · Accesibilidad

- Acciones nuevas y del banner con `min-height: 48px` (60px con texto
  ampliado).
- Teclado: “Agregar a mano” se activa con Enter y enfoca el producto.
- Foco explícito en confirmación, cancelación, seguir y limpiar.
- El banner usa `role="status"` + `aria-live="polite"`; el error usa
  `role="alert"`.
- Probado a 360px con texto `xlarge`; sin animaciones nuevas.

## Pruebas y evidencia

### Gates estáticos

| Comando | Resultado |
|---|---|
| `npm ci` | OK (385 paquetes; avisos de vulnerabilidades preexistentes) |
| `npm run lint` | **PASS** |
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** · `BUILD SHA 7b730bf62172a561e1ab726bc11e1564d77af31b` |
| `npm run verify:fast` | **PASS** · 3/3 gates (guard, lint, types) |

### E2E `web/scripts/sin-ia-e2e.py`

Servidor aislado en `:3303`, `DATABASE_PATH` y `DATABASE_BACKUP_DIR` temporales,
`DEMO_MODE=true`, sin `OPENAI_API_KEY`, `PEY_API_KEY` ni
`PEY_WEBHOOK_SECRET`. La red externa se bloquea desde el navegador.

Resultado: **21 PASS · 0 FAIL · 1 NOTE**.

Casos verificados:

- Con `/api/voice/parse` en 500:
  - “¿Cuánto vendí?” responde en pantalla (“Hoy llevas…”) **sin llamar al
    parser**.
  - “¿quién me debe?” responde (“Te deben $50.00 en 1 fiado de 1 cliente”)
    **sin llamar al parser**.
  - El fallo de una venta muestra el copy manual y no borra nada.
- Venta manual de 2 ítems: Quesadilla 2 × $35 + Agua 1 × $20 = **$90**.
- Efectivo recibido **$100** → “Cambio $10.00”; la orden queda
  `totalCents=9000`, `paidCents=9000`, `status=paid`, `creditCents=0`.
- El `POST /api/orders` lleva los 2 ítems escritos a mano y solo `$90`
  aplicados (el cambio no entra al ledger).
- Borrador de 2 productos y $30: al recargar se recupera con productos,
  importe y hora.
- “Seguir” conserva el borrador; “Empezar de nuevo” **no borra antes de
  confirmar**; “Cancelar” tampoco; “Sí, empezar de nuevo” limpia draft y
  `localStorage`.
- Solo hubo **una** llamada a `/api/voice/parse` en todo el recorrido: la del
  caso que debía fallar. Cero llamadas a `/api/voice/transcribe` y cero
  peticiones externas.
- 48px, foco, teclado y texto ampliado a 360px.

JSON de resultados: `%TEMP%\opencode\sin-ia\sin-ia-e2e.json`.

### Regresión

`web/scripts/p0-venta-e2e.py` contra `:3101` con base temporal y el build
`7b730bf`: **66 PASS · 0 FAIL · 0 KNOWN**. Cubre $100/$90 con cambio, $100 con
$30 de fiado, doble envío, pendiente durable y los casos de tecleo. El JSON de
evidencia generado se retiró del árbol para no commitear artefactos de corrida.

### Capturas (fuera de git)

`%TEMP%\opencode\sin-ia\`:

| Archivo | Contenido |
|---|---|
| `00-consulta-local-ventas.png` | “¿Cuánto vendí?” respondido localmente |
| `00b-consulta-local-fiado.png` | “¿quién me debe?” respondido localmente |
| `01-parser-500.png` | Error del parser con “Agregar a mano” y “Escribir productos” |
| `02-venta-manual-90.png` | 2 renglones manuales, total $90 y cambio $10 |
| `03-cobro-cambio-10.png` | Hoja de resultado con efectivo y cambio |
| `04-borrador-recuperado.png` | Banner con productos, importe y acciones |
| `05-confirmar-empezar.png` | Confirmación antes de borrar |
| `06-texto-grande-360.png` | “Agregar a mano” a 360px con texto ampliado |

## Cómo se ve el camino manual

Al abrir Caja, debajo del campo “Escribe la venta” y del botón “Interpretar”
aparece un botón secundario de borde punteado: **“+ Agregar a mano”**, con la
leyenda “Sin IA: escribe producto, cantidad y precio.” Al pulsarlo se crea un
renglón en “Pedido en curso” y el cursor queda en **Producto**; cantidad y
precio están en el mismo renglón. “Cobrar” se habilita cuando hay un renglón
válido y el cobro sigue su curso normal.

Si el parser falla, el mismo botón permanece a la vista y el bloque de error
agrega “+ Escribir productos”. No hay que recargar ni reintentar la IA.

## Limitaciones

- “Sin red” en este carril significa **sin IA y sin red externa**. La app sigue
  necesitando su servidor local para `POST /api/orders` y para persistir; no se
  agregó service worker ni modo offline-first. El E2E bloquea toda petición
  fuera de `:3303`.
- El detector de consultas locales es deliberadamente conservador. Una consulta
  que no coincide sigue el flujo del parser; si el parser está caído, recibe el
  mensaje con salida manual.
- El TTS de una respuesta local puede usar `/api/tts` (Piper local). No es una
  llamada de interpretación ni de IA generativa.
- “Empezar de nuevo” sobre un borrador **editado** no lo borra: conserva la
  edición y pide usar “Limpiar”. Es una protección existente, no un fallo.
- La verificación de lector de pantalla es por roles, `aria-live`, foco y DOM;
  no se probó con un lector real en dispositivo físico.
- `verify:fast` cubre guardrails, lint y tipos; no reemplaza `verify:full`.
  La regresión P0 de venta se corrió aparte con su propio servidor y base
  temporal.
- No se hizo merge. El carril queda en `p0/sin-ia`.

## Conflictos previsibles con `p0/cierre-cognitivo`

Ambos carriles tocan `web/src/components/caja-app.tsx`. Los hunks más
propensos a conflicto son:

1. Estado de `CajaApp` cerca de `restoredDraftAt` (`confirmingRestoredClear`).
2. Inicio y `catch` de `interpretText` (consulta local y copy manual).
3. Bloque JSX del banner de borrador recuperado.
4. Bloque de `clearDraft` / `updateDraftItems` (reset de confirmación).
5. Dentro de `CajaPanel`: botón “Agregar a mano” después de `.sale-line` y
   copy del error.
6. `web/scripts/p0-venta-e2e.py`, si `p0/cierre-cognitivo` también actualiza
   las expectativas del banner (“Seguir” / “Empezar de nuevo” y confirmación).

No hay conflicto semántico con dinero, estados de pago ni webhook: este carril
no tocó esas rutas. Al resolver, conservar ambas intenciones: la venta manual y
las consultas locales de este carril, más los cambios de cierre del otro.
