# 10 · Preflight de Fase 3 (solo lectura)

> **Decisión:** **FASE 3 BLOQUEADA. No se inicia la implementación de Caja, venta ni cobros.**
> Motivo: la condición de entrada es que la identidad visual y sus componentes estén integrados y aprobados. Fase 1 está **RECHAZADA** (`08_VEREDICTO_INDEPENDIENTE.md`) y Fase 2 no ha comenzado (`09_GATE_FASE_2.md`).
> Este documento es un **preflight de lectura**, no una implementación.

## 1. Estado del gate

| Gate | Estado | Evidencia |
|---|---|---|
| Inicio escritorio aprobado | **NO** | `08_VEREDICTO_INDEPENDIENTE.md` → RECHAZADO |
| Design system aprobado | **NO** | Fase 2 no iniciada |
| Componentes visuales aprobados | **NO** | Fase 2 no iniciada |
| Árbol limpio | **NO** | 3 archivos sucios + `quality-reports/` |
| Evidencia del HEAD | **NO** | `latest.json` es de `9206ea1`; `b8f127d` sin full |

**No se debe implementar Caja hasta que esos gates cambien.**

## 2. Mapa del flujo actual (lectura)

| Capa | Archivo / componente | Qué hace |
|---|---|---|
| Entrada de venta | `web/src/components/caja-app.tsx` → `CajaPanel` | Voz/texto/manual, draft, cantidades, precio, efectivo, fiado, crear orden |
| Creación de orden | `caja-app.tsx` → `createOrder`; `web/src/app/api/orders/route.ts`; `web/src/lib/orders.ts` | Persiste ítems, efectivo, fiado y saldo digital |
| Cobro | `caja-app.tsx` → `PaymentPanel` | Link/QR, polling, estado pendiente, demo, compartir link |
| QR | `QrImage` en `caja-app.tsx` | Renderiza QR real del payload; no es la ilustración decorativa |
| Webhook | `web/src/app/api/webhooks/pey/route.ts` | Única transición a `paid` con evento firmado e idempotencia |
| Verificación | `web/src/app/api/verify/route.ts` | Valida comprobante/ID y referencias; demo no es verificado |
| Checkout público | `web/src/app/pay/[id]/*` | Link público, estado, success |
| Estados visibles | `web/src/lib/payment-labels.ts` | Efectivo, digital verificado, declarado, pendiente, fiado, demo, parcial |
| Fiado | `CreditList`/`CreditPaySheet`, `/api/credits/*` | Deuda y abono; no es venta nueva |
| Corte | `CashCloseCard`, `/api/cash/*` | Efectivo, gastos, retiros, diferencia, cierre versionado |
| Demo | `demo_paid`, flags de pago, `/api/demo/*` | Simulación etiquetada; nunca `paid` |

## 3. Invariantes que no se pueden tocar

1. **Solo el webhook firmado de pey** transiciona `payment_pending → paid`. Una captura, un QR o una respuesta del cliente no confirman dinero.
2. Un demo es `demo_paid`, nunca `paid`, y no entra a caja real.
3. Efectivo registrado ≠ pago bancario verificado.
4. Fiado es deuda; un abono antiguo no es venta nueva.
5. El corte separa efectivo, verificado, declarado, demo, fiado, gastos y retiros; no suma digital al cajón.
6. Meta virtual no es custodia ni rendimiento.
7. Nada de doble registro por doble clic; `requestId`/idempotencia se conserva.
8. No inventar método, monto, cliente ni estado si el backend no lo soporta.

## 4. Brechas ya detectadas (sin implementar)

| Área | Brecha | Evidencia previa |
|---|---|---|
| Método de pago | No hay pantalla/radio-group Efectivo/Digital/Fiado antes de registrar; el default sin efectivo/ fiado es digital por cobrar | Auditoría funcional `ses_e5d3f2bedffeJly…` |
| `paymentMethod` | El schema lo acepta, pero `createOrder` no lo usa para tarjeta/efectivo | `api/orders/route.ts`, `lib/orders.ts` |
| QR | Es un sheet, no una pantalla; falta tab Escanear, compartir QR, expiración real; “expira en 10 minutos” fijo | `PaymentPanel` |
| Quick actions | “Cobrar” y “Producto” enfocan la misma venta; “Gasto” y “Reporte” van a Corte | `CajaBook` |
| Venta | CTA “Cobrar” no es “Registrar venta”; el total se duplica en dos bloques | `CajaPanel` |
| Fiado | Sin búsqueda/historial/nuevo fiado; fecha de creación, no último movimiento | `CreditList` |
| Metas | Solo `goals[0]`; no crear meta | `GoalCard` |
| Accesibilidad | `/inicio` HC/skip/text scale; Caja mantiene su propio shell | `08` + auditoría a11y |
| Tests | `/inicio` sin HIG/axe; Caja E2E no se ha corrido sobre este HEAD | `07_REGRESIONES.md` |

## 5. Escenarios obligatorios de Fase 3 (cuando se abra)

A. Efectivo cobrado.
B. Digital pendiente.
C. Digital confirmado por evento válido.
D. Pago fallido.
E. Reintento duplicado.
F. Venta a fiado.
G. Abono sobre fiado anterior.
H. Venta interrumpida/recarga.
I. Sin conexión.
J. Voz incorrecta + corrección manual.

Cada escenario debe probar que ventas, cobros, saldos, fiados y corte conservan sus invariantes.

## 6. Orden propuesto al abrir Fase 3

1. `mc-auditoria-repo`: mapa final de dependencias y tests.
2. `mc-ventas-pagos`: contratos de venta/pago; ninguna modificación de API sin test.
3. `mc-sistema-diseno`: componentes de venta/ticket/estado.
4. `mc-shell-responsive`: layout de Nueva venta/Cobro en 1448/1366/768/390.
5. `mc-fiado-corte`: revisión de fiado/corte, solo lectura o parche aislado.
6. `mc-accesibilidad`: teclado, foco, importes, errores, 200%.
7. `mc-verificador-final`: APROBADO/RECHAZADO con capturas y tests.

## 7. Condición de salida

No se implementa Fase 3 hasta que:

- Inicio esté **APROBADO**.
- Fase 2 (design system) esté **APROBADA**.
- El árbol esté limpio y la evidencia `verify:full`/`verify:evidence` corresponda al HEAD.
- Los contratos de pago/webhook estén identificados y probados.

**No hay cambios de código en este documento.**
