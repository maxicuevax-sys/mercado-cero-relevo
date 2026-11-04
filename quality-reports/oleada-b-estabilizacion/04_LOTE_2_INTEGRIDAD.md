# 04 — Lote 2: integridad de operaciones

**Commits:** `70b2313` (estado de cliente, pending tray, reconciliación), `f0bef29`/`16cb40f` (ajustes), `eab2a6f` (dos pestañas y barra), `bdfbe8b` (instancia del draft).
**Alcance:** P1-01, P1-06, P1-12; preservación de P1-10.

## P1-01 — Drafts y dos Cajas

- `/caja` lee el draft v1 solo si no hay v2; convierte centavos a texto, infiere método y conserva la llave de venta legacy si existe.
- Después de importar, elimina la llave v1 y muestra “Recuperamos el borrador…”.
- Si hay v1 y v2 distintos, muestra aviso, bloquea “Confirmar venta” y ofrece “Usar esta venta” o “Descartar la de la Caja clásica”.
- La Caja clásica detecta el draft v2, avisa y bloquea la creación de una venta hasta que el operador elige “Usar esta Caja clásica”.
- La nav marca Fiados/Corte/Metas/Pendientes/Ayuda/Ajustes como “Clásica” y el nombre accesible lo explica.

## P1-06 — Cola de pendientes

- La llave `caja-pending:v2` ya era un array; ahora se cargan todos los ids.
- 404 y estados terminales se podan; los errores de red se muestran como “sin lectura”.
- No se abre ningún cobro automáticamente al recargar.
- Bandeja con total, cobrado, falta y fiado por pedido; acciones “Seguir cobrando”, “Ver resultado” y “Actualizar lista”.
- “Nueva venta” vuelve a compose sin borrar, cancelar ni ocultar el pendiente.
- El botón “Nueva venta” del panel deja claro que el cobro sigue registrado.

## P1-12 — 502 post-commit

- 502/503/504 y fallo de red crean `unknownResult` persistido en `mercado-cero:caja-unknown:v2`.
- Se bloquean líneas, métodos, efectivo, fiado, cliente y “Descartar” hasta resolver.
- Acciones: “Consultar si se registró”, “Reintentar con la misma llave”, “Ver ventas”.
- La consulta usa `GET /api/orders?requestId=...` (read-only, `no-store`, sin tocar el motor) y adopta la orden si existe.
- Si no existe, permite corregir con una llave nueva; si existe, muestra resultado/pago pendiente.
- La llave se reconstruye desde el aviso aunque el storage de la solicitud se haya perdido.
- El test intercepta el primer POST, lo deja llegar al servidor y devuelve 502; tras recargar y reconciliar queda una sola orden.

## P1-10 — No regresión

El endpoint `/api/demo/pay` no se tocó. `npm run test:demo-pay` se ejecuta en aislamiento con puertos 3331–3333 y SQLite temporal. La corrida funcional es 58/58; el check 0b de árbol limpio se repite después del commit documental.

## Residual declarado

La Caja legacy conserva su flujo histórico de venta y no tiene la reconciliación guiada de `/caja`; sí tiene la guardia de draft v2. Se documenta como residual P2 en `12_PENDIENTES_OLEADA_C.md`. La fuente nueva y el alcance auditado de P1-12 es `/caja`.
