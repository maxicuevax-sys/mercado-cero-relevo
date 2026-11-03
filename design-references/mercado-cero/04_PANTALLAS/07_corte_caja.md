# Corte de caja

**Prioridad:** P0 · **Agente dueño:** `mc-fiado-corte` · **Referencia:** `01_REFERENCIAS/recortes/20_Corte_Caja_Movil.png`

## Problema humano y tarea

Cerrar turno o día con suma de efectivo esperado, contado por billetes/monedas, gastos y retiros, sin mezclar digital.

## Jerarquía y componentes propuestos

Fecha/turno; efectivo esperado; digital confirmado por separado; gastos y retiros; entrada por denominación; resultado coincide/sobra/falta; explicación; CTA Cerrar caja con confirmación.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

Los billetes y monedas son denominaciones MXN configurables; digital verificado no es efectivo de cajón; abonos en efectivo alteran efectivo pero no ventas nuevas; salidas de caja separadas de gastos.

## Estados y situaciones de prueba

Cambio inicial, corte parcial, retiro de caja, gasto, fiado cobrado, pagos pendientes, discrepancia, sesión ajena.

## Accesibilidad

Tabla textual con denominación y cantidad, campo numérico accesible, errores precisos, confirmación de cierre reversible solo con política explícita.

## Definition of Done

Tres escenarios de conciliación sin diferencia y con sobrante/faltante; cifras rastreables a movimientos.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
