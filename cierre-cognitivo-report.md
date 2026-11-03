# Cierre cognitivo — “Antes de cerrar”

- **Rama:** `p0/cierre-cognitivo`
- **Base:** `499a301`
- **Commit de código + test:** `82709f2` (`feat(cognitiva): checklist antes de cerrar en corte`)
- **Build SHA sellado:** `82709f26547378072dbe6229f696c706ff546a36`
- **Merge:** no ejecutado.

## Qué muestra la tarjeta

En la pestaña **Corte**, arriba del formulario “Cuenta el efectivo de hoy”:

1. **Vencidos** — pendientes abiertos con fecha México anterior a hoy.
2. **Para hoy** — pendientes abiertos que vencen hoy (hora México).
3. **Para mañana** — pendientes abiertos que vencen mañana, máximo 5. Si hay
   más, se indica cuántos quedaron y se ofrece “Ver en Pendientes”. No se
   muestran fechas más lejanas.
4. **Cobros por confirmar** — los `pendingOrders` que ya trae el dashboard. Se
   pasan como prop; la tarjeta no hace otro fetch de dashboard. Cada cobro
   muestra monto, “Esperando confirmación” y un botón “Ver” que abre el
   pedido. Nunca usa la palabra “pagado”.

Cada pendiente tiene título, vencimiento, **Completar**, **Posponer a
mañana** y el enlace **Ver en Pendientes**. Completar lo saca de la lista;
posponerlo lo mueve al grupo “Para mañana” con fecha mañana 09:00 de México.

Si no hay nada: “No hay pendientes para hoy. Puedes cerrar cuando quieras.”

## Comportamiento y accesibilidad

- La tarjeta solo se lee y se muestra con la pestaña Corte activa.
- **“Ahora no”** la oculta en `sessionStorage`
  (`mercado-cero:antes-de-cerrar:oculto:v1`). No borra pendientes ni cobros.
  Los avisos críticos de dinero siguen en Caja (`Cobros pendientes`, tira
  “Por cobrar”) y la diferencia del corte sigue en su formulario.
- Lee la preferencia compartida
  `localStorage["mercado-cero:companion:suggestions"]`. Con `"off"` se oculta
  solo esta tarjeta; los avisos críticos de dinero no se ocultan. Si la llave
  no existe, se asume encendida. No se implementó pantalla de preferencias.
- Estado de carga: “Revisando pendientes de hoy y de mañana…”. Error de red:
  “No pude leer los pendientes. Puedes cerrar igual.” con Reintentar, sin
  bloquear el corte.
- Acciones y enlaces con objetivo mínimo de 48 px (`min-h-12`), foco visible
  global, teclado, texto ampliado y sin depender solo del color. Sin
  animaciones nuevas.
- `aria-live="polite"` anuncia completar, posponer y ocultar. Los errores usan
  `role="alert"`.
- Copy neutral: sin diagnósticos, culpa, “fallaste”, “vas mal”, “deberías”,
  “triste” ni “ánimo”. Tampoco se inventan gastos sin clasificar.

## Cambios técnicos

- Nuevo `web/src/components/closing-checklist.tsx`.
- Nuevo `web/src/lib/mexico-date.ts` con las utilidades de fecha México.
  `pending-tasks.tsx` ahora las reutiliza (sin cambio de comportamiento).
- `caja-app.tsx` monta la tarjeta en Corte y le pasa
  `dashboard.pendingOrders`, `selectOrder` y `selectTab("pendientes")`.
- Las acciones usan `PATCH /api/tasks/:id`, que es el contrato real existente
  de la ruta (el encargo decía “POST”; no se cambió la API ni su lógica).
- Sin dependencias nuevas. Sin cambios en la lógica de dinero.

## Gates

| Gate | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | **PASS** (0 errores, 0 warnings) |
| Tipos | `npx tsc --noEmit` | **PASS** |
| Build | `npm run build` | **PASS**, `BUILD SHA 82709f2` |
| Sintaxis del E2E | `python -m py_compile web/scripts/closing-checklist-e2e.py` | **PASS** |
| E2E Playwright | `web/scripts/closing-checklist-e2e.py` contra `:3302` | **PASS**, 18/18 comprobaciones |
| Accesibilidad manual | 360 px, texto `xlarge`, foco por teclado | **PASS**: sin scroll horizontal y objetivos de 60 px |

`npm run verify:fast` con el árbol limpio dio **3/3 gates** (guard, lint,
types) y `HARNESS OK` (62.8 s). La evidencia quedó en
`harness/evidence/runs/2026-11-03T01-57-53-087Z-fast.json` (ignorada por git).

## Evidencia E2E

Servidor aislado en `:3302`, `DATABASE_PATH` temporal y `DEMO_MODE=true`.
El script exige un servidor ya levantado, falla claro si no responde y se
niega a correr contra `:3000` o `:3230`.

```powershell
$env:BASE_URL="http://localhost:3302"
python web/scripts/closing-checklist-e2e.py
```

Comprobaciones: servidor/build, `DEMO_MODE`, cobro del dashboard, creación por
API de 4 pendientes, aparición de la tarjeta, “Ver en Pendientes”, completar,
posponer a mañana 09:00, exclusión de fechas futuras, “Ver” del cobro,
“Ahora no” sin borrar, avisos de Caja tras “Ahora no”, persistencia en la
sesión, sugerencias apagadas, llave ausente, lista vacía y fallo de red sin
bloquear el corte.

Capturas fuera de git, en `%TEMP%\opencode\cierre-cognitivo\`:

- `01-corte-con-pendientes.png`
- `02-pendiente-de-hoy.png`
- `03-completado.png`
- `04-pospuesto-manana.png`
- `05-ahora-no-corte.png`
- `06-caja-avisos-siguen.png`
- `07-lista-vacia.png`
- `08-error-red.png`
- `09-sugerencias-off.png`
- `08-texto-grande-360.png` (revisión de texto ampliado)
- `09-foco-teclado.png` (revisión de foco)

## Limitaciones y notas

- El E2E necesita una base desechable con `DEMO_MODE=true`: para probar el
  estado vacío cierra por la API oficial `/api/demo/pay` los cobros demo y
  borra solo los pendientes que creó. No debe apuntarse a datos reales.
- El grupo “Para mañana” se limita a 5; el resto se consulta en Pendientes.
- La preferencia de sugerencias se relee en montaje, `focus`, evento
  `storage` y un eventual evento `mercado:preferences` en la misma pestaña.
  Cambiarla por consola sin emitir evento ni recargar no repinta hasta el
  siguiente foco/recarga.
- La tarjeta hace su propia lectura de `/api/tasks`; no duplica la lectura del
  dashboard. Es independiente de la bandeja de Pendientes, que conserva su
  propia carga.

## Conflicto previsible con `p0/sin-ia`

Ambos carriles tocan `web/src/components/caja-app.tsx`. Hoy los hunks son
disjuntos:

- `p0/sin-ia`: bloque de borrador recuperado (~2450), `CajaPanel` y estado de
  venta manual.
- `p0/cierre-cognitivo`: import de la tarjeta, callback `goToTasks` (~2258),
  montaje en la sección Corte (~2613) y `memo` al final (~7715).

El merge textual debería ser limpio; el riesgo es solo si `p0/sin-ia` agrega
imports o `memo` cerca de esas líneas. No hay estado compartido ni cambio de
comportamiento entre ambos: uno mejora la venta manual y el otro agrega la
lista de cierre. `pending-tasks.tsx` solo lo toca este carril (extracción de
utilidades de fecha México).
