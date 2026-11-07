# Contratos de componentes

Estos contratos son **especificaciones** y no son una API asumida. El agente debe mapearlos al framework real.

## MoneyAmount

Entrada: `amountMinor` en unidades menores (centavos, entero), `currency='MXN'`, `size`, `emphasis`, `privacy`. No usar float para cálculo financiero. Formato `Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'})` solo al renderizar. `privacy='hidden'` oculta sin leer cantidad al lector de pantalla.

## PaymentStatus

Entrada: `{provider, paymentId, localSaleId, state, verifiedAt?, reference?, amountMinor}`. Estados discriminados; solo `verified` con verificación auténtica permite etiqueta **Pago verificado**. `pending` y `offline` requieren texto contextual y nunca un check verde de éxito. Estado debe anunciarse accesiblemente sin repetirse por eventos de polling.

## SaleComposer

Entrada: borrador transitorio con ítems, descripción libre, impuesto/configuración si procede, método de pago seleccionado. Componer mediante teclado, voz opcional o catálogo. Confirmación explícita antes de persistir. Guardado local/recuperación no duplica folios. No asumir existencia de voz ni de reconocimiento fiable.

## DebtLedger

Cuenta por cliente, cargos (fiados), abonos, anulaciones justificadas, fecha y autor. Saldo = cargos − abonos − ajustes aprobados. Permitir abono parcial. Confirmación y auditoría en cada ajuste. Registrar venta a fiado UNA sola vez; cobro posterior es abono, no venta nueva.

## CashClose

Abre/cierra caja por sesión, movimientos auditables, conteo por denominación MXN, retiros, gastos, ventas efectivo y cambios. Esperado, contado y diferencia son variables distintas. No sumar digital recibido como billetes físicos.

## GoalEnvelope

Meta virtual: `targetAmountMinor`, `recordedSetAsideMinor`, categoría, fecha objetivo, cuentas permitidas. **No es custodia real ni fondos bloqueados.** Si no existe integración bancaria capaz de verificar saldo real, declarar «Apartado en tu registro».

## PendingTask

`id,title,kind,dueAt?,source,owner,completionState,snoozeUntil?`; notificación opcional y limitada. Si tarea se origina automáticamente debe explicar por qué y permitir descartarse. No incluir nombres de deudores en push sin consentimiento.

## ContextualAssistant

Interfaz opcional que puede explicar, buscar y proponer acciones; no modifica dinero sin confirmación. Separar propuestas de reglas deterministas y texto generado. Debe poder apagarse sin perder funciones básicas.

## GuideStep/PracticeSale

Dataset ficticio etiquetado «PRÁCTICA» separado en namespace/tenant o base de datos local distinta. No se mezclan ventas falsas en cierres, reportes ni métricas. Permitir saltar introducción y reabrir ayuda.

## Design invariants

- Un único CTA primario por tarea; accesibles focus y teclado.
- Cada estado tiene icono + texto; no solo color.
- Importes con dígitos tabulares; no recalcular en la capa visual.
- No manipular timestamp/referencia del proveedor.
- Screen-reader labels explican naturaleza del movimiento y el estado.
- Sin doble envío/registro; idempotencia y referencia de evento.
- Crear/editar en flujos de negocio con logs y pruebas de regresión.
