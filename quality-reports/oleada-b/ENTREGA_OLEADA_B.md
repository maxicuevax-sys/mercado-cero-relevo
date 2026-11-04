# Entrega Oleada B — Caja y Ventas

> **Estado:** implementación funcional en local, **sin commit**. Verificador independiente la aprueba como base para Oleada C, con commit de checkpoint pendiente y handoff público NO-GO.
> **Rama:** `design/oleada-b-caja-ventas` · **Base/tag:** `oleada-a-cierre` = `26c7741`.
> **Servidor de referencia:** `http://localhost:3100` con `APP_URL=http://localhost:3100` para desarrollo local.
> **Handoff público:** **NO-GO**. `latest.json` es de `9206ea1`; full 21/23 por `tunnel`/`preflight`; no hay `verify:evidence` de B.

## 1. Resultado

Se construyeron pantallas reales para el recorrido:

**Inicio → `/caja` → registrar venta manual → elegir cobro → resultado → nueva venta o `/ventas`.**

- `/caja` es una pantalla nueva, no un redirect ni la interfaz legacy con otro color.
- `/ventas` es un historial real, paginado y de solo lectura.
- `/` sigue siendo la Caja legacy con `?tab=` para no romper consumidores.
- `/fiados`, `/corte`, `/metas` y `/pendientes` siguen como alias 307 a `/?tab=`.
- `/pay/**` no se tocó.

## 2. Rutas

| Ruta | Comportamiento |
|---|---|
| `/caja` | 200. Venta manual, efectivo/cambio, digital, fiado, mixto, resultado y reanudación de borrador/cobro. |
| `/ventas` | 200. Historial paginado (25/página), estados, saldo vivo de fiado, pendiente digital, conceptos. |
| `/` | 200 legacy. `?tab=caja/fiado/corte/meta/pendientes` intacto. |
| `/inicio` | 200; CTA “Registrar” y nav apuntan a `/caja`; “Ventas” a `/ventas`. |
| `/fiados` etc. | 307 a `/?tab=...`, conservando `ayuda=1`. |
| `/pay/**` | Intacto, fuera del AppShell. |

## 3. Componentes y archivos

### Nuevos

| Archivo | Responsabilidad |
|---|---|
| `web/src/app/caja/page.tsx` | Página real de Caja; solo pasa merchant y modo demo. |
| `web/src/app/ventas/page.tsx` | Historial real con `listOrders`, `getCredit`, paginación. |
| `web/src/app/ventas/ventas.css` | Presentación del historial. |
| `web/src/components/caja/caja-screen.tsx` | Orquestador de la venta: estado, draft, requestId, API, resultado. |
| `.../sale-line-items.tsx` | Conceptos, cantidades, precios, alta/edición/borrado. |
| `.../sale-summary.tsx` | Total, método, efectivo/cambio, fiado, validaciones y CTA. |
| `.../payment-panel.tsx` | Link/QR, polling, demo, estado pendiente. |
| `.../sale-result.tsx` | Resultado inequívoco: efectivo, digital, demo, fiado, mixto. |
| `.../types.ts` | Tipos de línea y parser de dinero/cantidad. |
| `.../caja.css` | Layout operativo, responsive, foco y estados. |
| `web/scripts/oleada-b-smoke.py` | 44 checks A–T. |
| `web/scripts/oleada-b-a11y.py` | axe, targets, HC y 200 % para `/caja` y `/ventas`. |
| `web/scripts/oleada-b-captures.py` | Capturas deterministas. |

### Modificados

| Archivo | Cambio |
|---|---|
| `web/src/components/shell/nav.ts` | Nav única: Inicio, Caja, Ventas, Fiados, Corte, Metas, Pendientes; móvil con 4 + Más. |
| `web/src/app/inicio/page.tsx` | CTA principal a `/caja`. |
| `web/next.config.ts` | `Cache-Control: private` para `/caja` y `/ventas`. |
| `web/scripts/oleada-a-smoke.py` | Actualizado a rutas reales de B. |
| `web/src/app/ventas/route.ts` | Eliminado; sustituido por `page.tsx`. |

## 4. Contratos preservados

Sin cambios en:

`lib/orders.ts`, `lib/cash.ts`, `lib/goals.ts`, `lib/tasks.ts`, `lib/db.ts`, `lib/payment-rules.ts`, `lib/payment-labels.ts`, `lib/pey-events.ts`, `lib/checkout.ts`, `app/api/**`, `app/pay/**`, `components/caja-app.tsx`, `app/page.tsx`.

La Caja nueva usa las mismas APIs que el motor: `POST/GET /api/orders`, `GET /api/orders/[id]`, `POST /api/orders/[id]/pay`, `POST /api/demo/pay`, `GET /api/dashboard` indirectamente vía datos de servidor solo donde aplica. No hay una segunda base ni un segundo webhook.

## 5. Flujo cubierto

- Venta de uno y varios conceptos; edición de cantidad; eliminación; total.
- Efectivo exacto, con cambio, insuficiente y decimales/miles.
- Doble pulsación; error 502 post-commit con reintento y misma `requestId`.
- Digital pendiente, link/QR, polling, demo `demo_paid`.
- Fiado total, mixto efectivo+fiado, cliente obligatorio, saldo vivo.
- Borrador recuperado tras recargar y cobro pendiente reanudado.
- Resultado con acciones “Nueva venta”, “Ver ventas”, “Volver a Caja”.
- `/ventas` con pedido, estado, importe, método, conceptos, saldo vivo y pendiente.
- Uso manual sin micrófono y sin IA; cero llamadas a `/api/voice` en el smoke.

## 6. Pruebas ejecutadas

| Prueba | Resultado | Evidencia |
|---|---|---|
| `oleada-b-smoke.py` | **44 PASS · 0 FAIL** | `quality-reports/oleada-b/oleada-b-smoke.json` |
| `oleada-a-smoke.py` | **33 PASS · 0 FAIL** | salida local |
| `oleada-b-a11y.py` | **8/8 matrices**, axe 0 normal/HC, 0 targets <44, 200 % sin overflow | `quality-reports/oleada-b/a11y.json` |
| HIG legacy | **5/5 viewports** | `demo/hig-after/audit.json` |
| mobile-320 legacy | **60 PASS · 0 FAIL** | `harness/evidence/mobile-320-e2e.json` |
| p0-venta | **66/0/0** | `harness/evidence/p0-venta-e2e.json` |
| p0-fiado | **51/0/0** | `harness/evidence/p0-fiado-e2e.json` |
| p0-corte | **69/0/0** | `harness/evidence/p0-corte-e2e.json` |
| p0-integración | **51/0/0** | `harness/evidence/p0-integracion-e2e.json` |
| p0-dinero | **45/0 + 3 KNOWN** | `harness/evidence/p0-dinero-e2e.json` |
| webhook | **40/40** | `harness/evidence/` |
| checkout | **19/19** | `harness/evidence/` |
| TypeScript / ESLint / build | PASS | buildSha `26c7741...` |
| `verify:static` / `verify:evidence` | **pendientes después del commit** | — |

Los 3 KNOWN de p0-dinero siguen siendo: payload real de pey no verificable sin portal; reconciliación de red no ejecutada; contrato de conteo posterior al cierre.

## 7. Capturas

En `quality-reports/oleada-b/capturas/`:

- `caja-vacia-{1448x1086,1366x768,390x844,320x640}.png`
- `caja-venta-en-curso-{...}.png`
- `caja-metodo-digital-{1448,390}.png`
- `caja-efectivo-resultado-{1448,390}.png`
- `caja-fiado-resultado-{1448,390}.png`
- `caja-digital-pendiente-{1448,390}.png`
- `ventas-{1448x1086,1366x768,390x844,320x640}.png`
- Evidencia adicional del auditor de accesibilidad en la misma carpeta.

Las capturas corresponden al build local con el código de esta ola; los PNG están ignorados por Git.

## 8. Accesibilidad

- 1 `main`, 1 skip link, 1 nav visible, 1 `aria-current` visible por breakpoint.
- Foco al resultado/pago; foco al siguiente renglón o “Agregar” al borrar; foco no tapado por paybar/nav con scroll padding.
- Targets ≥44 px; mobile 5 slots y “Más” con 48 px.
- axe 0 en normal y alto contraste propio; 200 % sin overflow con `$1,000,000.00`.
- `prefers-reduced-motion` evita scroll suave.
- **No ejecutado:** lector real (NVDA/JAWS/VoiceOver/TalkBack), iOS/Safari, HCM real, QR real, teclado virtual real. **WCAG no certificada.**

## 9. Subagentes invocados

Todos fueron sesiones `general` del harness, instruidas para actuar como el rol nombrado; **no son perfiles `mc-*` configurados**.

| Rol | Sesión | Resultado |
|---|---|---|
| `mc-auditoria-repo` | `ses_e59324e2dffe1q1mOcJkhbnNt3` | Inventario, extracción y rutas. |
| `mc-ventas-pagos` | `ses_e59324e2bffeDt1oaro8V2K52x` | Contratos de venta/pago y secuencias. |
| `mc-sistema-diseno` | `ses_e59324e29ffemXusGt6msgzre5` | Dirección visual y estados. |
| `mc-shell-responsive` | `ses_e59324e28ffe1HurxrnXnRRkXn` | Rutas, nav y responsive. |
| `mc-fiado-corte` | `ses_e58e92694ffeBdxlUqugxVKbnu` | Fiado, abonos y corte. |
| `mc-modulos-negocio` | `ses_e58e92692ffeVcWAWp0FwpApXn` | Independencia de inventario e interfaces futuras. |
| `mc-onboarding-ayuda` | `ses_e58e92690ffeBQA8HT97iIhmdw` | Copy, errores y acompañamiento. |
| `mc-accesibilidad` | `ses_e58e9268fffetlsj3DhOQPE6qU` | Teclado, foco, HC, 200 %. |
| `mc-verificador-final` | `ses_e58ca568bffePIM05XgKKlXVdR` | Veredicto independiente y re-auditoría. |

Informes en `quality-reports/oleada-b/`.

## 10. Veredicto independiente

- **P0 de producto:** ninguno.
- **P1 abierto:** `POST /api/demo/pay` heredado, sin idempotencia por pedido ni comprobación `order.demo`. No es regresión de B; el cliente bloquea doble clic, pero dos pestañas podrían duplicar un demo. No se modificó el endpoint sin autorización.
- **Oleada B como base para C:** **sí**, con commit de checkpoint y evidencia formal.
- **Cierre formal:** pendiente de commit, `verify:static`, `verify:evidence`, full documentado como parcial si se omite túnel, y HIG específico de las rutas nuevas.
- **Handoff público:** **NO-GO**.

## 11. Pendientes y límites

1. `/` legacy sigue existiendo; hay dos Cajas y dos borradores independientes, sin lock cross-tab.
2. `/fiados`, `/corte`, `/metas` y `/pendientes` siguen en legacy; su migración es Oleada C/D.
3. La Caja nueva no incluye voz, verificación de comprobante, ayuda/ajustes ni reset demo; se ofrece la Caja clásica para esos casos.
4. La cola de pendientes reanuda solo el último; los demás quedan visibles en la libreta legacy de Pendientes.
5. `/ventas` no tiene filtros/búsqueda ni desglose de pagos; 25 por página.
6. El total limita su tamaño para evitar overflow al 200 %; no escala indefinidamente con zoom.
7. `APP_URL` local se fuerza para el link/QR; el handoff público sigue bloqueado por el túnel.
8. No se probó pago pey real, QR real, lector de pantalla, iOS/Safari, HCM real ni full gate.
9. `latest.json` full sigue siendo de `9206ea1`; no se declara GO.

## 12. Siguiente — Oleada C

1. Commit B + `verify:static`/`verify:evidence` sobre HEAD limpio.
2. Migrar Fiados y Corte al AppShell y a rutas propias.
3. Compartir un único draft/lock de venta entre `/` y `/caja`, o retirar la Caja legacy.
4. Extraer `Sheet`, `StatusBadge`, `paymentTruth` y el shell CSS de `inicio.css`.
5. Decidir el P1 de idempotencia de `/api/demo/pay` con dueño de pagos.
6. Cerrar HIG/contrast/motion de las rutas nuevas y documentar el full parcial.
