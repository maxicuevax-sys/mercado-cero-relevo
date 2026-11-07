# Fiados y Corte — comparación con el tablero maestro

Referencias: `design-references/mercado-cero/01_REFERENCIAS/00_MASTER_1536x1024.png`,
recortes `19_Libreta_Fiados_Movil.png` y `20_Corte_Caja_Movil.png`.

## Cambios

- Fiados: encabezado con regreso, pestañas Por cobrar/Historial funcionales,
  filas sin tarjetas ni medallones, iconos lineales, saldo a la derecha y Nuevo
  fiado al pie. La fila completa abre el formulario existente de abonos.
- Búsqueda y total accesibles desde la lupa. Se conserva búsqueda por nombre,
  paginación y estados vacíos. Historial muestra créditos saldados; Por cobrar
  excluye saldados. La cuenta de la pestaña representa créditos abiertos.
- Corte: fecha, efectivo esperado en caja, digital verificado, ventas, gastos y
  saldo, con Realizar corte al pie. Conteo, denominaciones, revisión y diálogo
  financiero existentes se abren desde esa acción. Movimientos y versiones
  permanecen en Detalle de movimientos. Los retiros se muestran si existen.
- Las dos rutas conservan el shell de escritorio. En móvil usan el encabezado
  con regreso de los recortes, sin navegación inferior adicional.
- No se modificaron APIs, base de datos, contabilidad, componentes de abono o
  conteo, pagos, webhooks ni checkout. No se publicaron cambios.

## Evidencia local

Directorio: `quality-reports/exact-parity-fiados-corte/`.

- `responsive.json`: 16 combinaciones, 320/390/768/1448 px, texto 100/200 %,
  ambas rutas sin desbordamiento horizontal. Capturas correspondientes en PNG.
- Capturas inspeccionadas: móvil 390, 320 con texto 200 %, escritorio 1448.
- `functional.json`: búsqueda vacía, historial excluye deuda abierta, abono en
  efectivo de $10 reduce $50 a $40, liquidación pasa a Historial con saldo $0,
  vista previa del corte y persistencia de versión 1 tras recargar.
- Pruebas de UI en Chromium, con SQLite temporal y demo explícita en localhost.
  No equivalen a pruebas en iPhone/Safari o con lector de pantalla real.
- Guardrails, ESLint y TypeScript pasaron antes del checkpoint; aquella corrida
  no es evidencia formal por árbol sucio. El cierre formal se consulta en
  `harness/evidence/latest-static.json`, ligado al HEAD final, y se valida con
  `cd web; npm run verify:evidence -- --static`.

## Límites de la paridad

Se replica la composición de las dos pantallas móviles del maestro, adaptada a
controles táctiles y texto ampliable. No se certifica igualdad píxel a píxel:
se conservan las fuentes locales Hearth/Alder y los datos vivos, en vez de
copiar las cifras y fechas ilustrativas del tablero. Se añaden acceso a
búsqueda y detalles financieros para conservar funciones y la verdad demo/pey.
El maestro no contiene una versión de escritorio de estas dos pantallas;
su adaptación mantiene el shell actual. La fecha es informativa, sin simular
un selector de días para el que esta ruta no tiene contrato de lectura.

## Reversión y pendientes

Revertir el commit de este carril restaura las dos vistas y elimina el CSS
compartido específico. No hay migraciones ni datos de producción que revertir.
No se hizo merge. El full público sigue sujeto a túnel/preflight y a las
condiciones de entrega ya documentadas; este trabajo no cambia ese estado.
