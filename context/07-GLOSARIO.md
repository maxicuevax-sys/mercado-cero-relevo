# 07 · Glosario

> Términos del negocio, del sistema y del harness. Las definiciones son operativas: describen cómo se usan en este repo, no una teoría general.

---

## A · Negocio y producto

| Término | Significado en Mercado Cero |
|---|---|
| **Mercado Cero** | Caja hablada para comerciantes de barrio; PWA mobile-first. |
| **Lupita / Antojitos de Lupita** | Personaje y comercio de la demo; quesadillas en Coyoacán. `MERCHANT` en `config.ts:1-8`. |
| **Ana (hija)** | Cuenta receptora autorizada de la demo; la app **no** ve su saldo ni movimientos. `config.ts:5-6`; `RUNBOOK-DEMO.md:150`. |
| **Comerciante** | Persona que opera la caja; no se asume edad ni habilidad digital. |
| **Caja** | Destino principal: venta, cobro, actividad reciente. |
| **Fiado** | Deuda de un cliente; no es dinero recibido ni venta nueva. |
| **Abono** | Pago parcial/total de un fiado; puede ser efectivo o digital declarado. |
| **Corte de caja** | Cierre del día: base, ventas en efectivo, abonos, gastos, retiros, esperado, contado y diferencia. |
| **Base inicial** | Efectivo con el que se abre el día. |
| **Esperado / “Debería haber”** | `opening + cashSales + cashCredit - expenses - withdrawals`. |
| **Diferencia / “Cuadra”** | `counted - expected`; cero = cuadra; positivo = hay más; negativo = hay menos. |
| **Retiro** | Dinero que sale de la caja; no es gasto del negocio. |
| **Gasto de caja** | Dinero que se paga desde la caja durante el día. |
| **Meta / Mi camino** | Objetivo de ahorro declarado; “apartado” virtual, no custodia bancaria. |
| **Apartado declarado** | Monto que la persona dice haber separado; no es dinero depositado ni cuenta de ahorro. |
| **Pendientes** | Tareas manuales del negocio: crear, completar, posponer, eliminar. |
| **“Antes de cerrar”** | Tarjeta en Corte que reúne pendientes de hoy/mañana y cobros por confirmar. |
| **Cobro pendiente** | Pedido con saldo digital aún no confirmado; no es ingreso. |
| **Pago mixto** | Venta con efectivo + fiado + remanente digital. |
| **Venta registrada** | Suma de totales de pedidos del periodo; incluye fiado y pendiente. |
| **Cobrado confirmado** | Efectivo + pagos verificados por pey; no incluye demo, declarado ni pendiente. |
| **Declarado sin verificar** | Abono digital registrado por la comerciante; pey no lo confirmó. |
| **Demo** | Simulación; no es dinero real; usa `demo_paid`. |
| **Modo real** | `DEMO_MODE=false`; los pagos digitales dependen de pey. |
| **Piloto** | Visión de 10 comerciantes de Coyoacán; no ejecutado. |
| **Comisión / suscripción** | Modelo de negocio propuesto; no implementado. |

---

## B · Pagos y proveedores

| Término | Significado |
|---|---|
| **pey** | Proveedor de pagos mexicano usado para links, QR CoDi y webhooks. `https://api.pey.mx`. |
| **CoDi** | Riel de transferencia bancaria mexicano; en la app es una opción del link/QR. |
| **Link de pago** | Checkout alojado por pey; acepta CoDi, tarjeta y wallets si la cuenta lo permite. |
| **QR CoDi** | QR directo de pey (`/codi/qr`); segundo modo de cobro. |
| **`payment_link.status_updated`** | Evento de pey para link; `status='paid'` es el que importa. |
| **`codi.qr.payment_received`** | Evento de pey para QR CoDi. |
| **Webhook firmado** | Evento autenticado con Standard Webhooks (HMAC SHA-256 sobre body crudo, timestamp, `webhook-id`). |
| **Standard Webhooks** | Especificación de firma usada por pey. |
| **`clientReferenceId`** | Referencia del pedido en el link de pago; debe coincidir con `order.id`. |
| **`paymentLinkId`** | ID del link de pey; debe corresponder al pedido. |
| **`numRef`** | Número de referencia de 6 dígitos para QR CoDi. |
| **`transactionId`** | ID único de una transacción; idempotencia. |
| **`webhook-id`** | ID único del evento; idempotencia del webhook. |
| **Replay** | Reenvío del mismo evento; debe devolver 200 sin duplicar. |
| **Firma inválida** | Evento no autenticado; 401 y auditoría. |
| **Monto exacto** | La suma fresca debe igualar `total - paid - credit`; si no, 409. |
| **MXN** | Moneda obligatoria; otra moneda se rechaza. |
| **`paid`** | Pago digital confirmado por webhook, o efectivo registrado al crear la venta. |
| **`demo_paid`** | Pago simulado; no es dinero real; no se entrega. |
| **`payment_pending`** | Esperando confirmación del banco. |
| **`partially_paid`** | Pago parcial; queda saldo. |
| **`confirmed`** | Venta confirmada; puede tener saldo digital o fiado. |
| **`fulfilled`** | Entrega registrada; solo si el pedido está cubierto y sin fiado abierto. |
| **`cancelled`** | Venta anulada; no cuenta. |
| **`declared`** | Abono digital de fiado registrado por la comerciante; no verificado por pey. |
| **Conciliación** | Comparación read-only de pagos locales vs pey; reporta diferencias, no corrige. |
| **Comprobante falso** | `transactionId` que no existe o no corresponde; `/api/verify` debe rechazarlo. |

---

## C · Interfaz y diseño

| Término | Significado |
|---|---|
| **Mostrador claro** | Dirección HIG anterior: shell, tabs, tokens, checkout. |
| **Amable y de barrio** | Dirección actual: libreta de mostrador, LCD, teclas, Atkinson + Fraunces. |
| **Mercado de papel** | Dirección original: papel, tinta verde, sellos, halftone. Reemplazada. |
| **Libreta** | Metáfora de la UI barrio: hoja, renglones, margen terracota, índice de pestañas. |
| **LCD** | Display verde del total de la venta. |
| **Teclas** | Botones tipo calculadora; “Cobrar/Pagar” es la tecla grande. |
| **Sello** | Tratamiento visual de estado: DEMO/PAGADO/SIMULADO/CUADRA. |
| **Pill / badge** | Etiqueta compacta de estado (Demo, Por cobrar, Fiado). |
| **Sheet / hoja** | Panel modal inferior/centrado para cobro, abono, verificación, ayuda. |
| **Toast** | Aviso breve no crítico; no debe tapar contenido esencial. |
| **Banner** | Aviso persistente con acción (reintentar, actualizar). |
| **Empty state** | Estado vacío explicativo; no debe confundirse con error. |
| **200 %** | Prueba de texto al doble; se inyecta `font-size`, no es zoom real. |
| **48 px** | Target táctil mínimo usado en la app (más estricto que 44 px). |
| **`prefers-reduced-motion`** | Preferencia de movimiento reducido; la app la respeta. |
| **`forced-colors`** | Modo de alto contraste del sistema; **no implementado**. |
| **WCAG 2.2 AA** | Nivel de accesibilidad objetivo. |
| **HIG** | Human Interface Guidelines de Apple, adaptadas a web; no certificación. |
| **axe** | Motor de auditoría de accesibilidad usado por los scripts. |
| **Lighthouse** | Auditoría de performance/accesibilidad/SEO; las cifras del repo son históricas. |

---

## D · Datos y estados

| Término | Significado |
|---|---|
| **`orders`** | Pedidos/ventas. |
| **`order_items`** | Renglones de un pedido. |
| **`payments`** | Pagos (efectivo, pey, demo). |
| **`payment_events`** | Auditoría cruda de webhooks; firma, resultado, error. |
| **`customers`** | Clientes de fiado; unicidad por `(name, demo)`. |
| **`credits`** | Deudas de fiado. |
| **`credit_payments`** | Abonos de fiado. |
| **`cash_closes`** | Cortes versionados. |
| **`goals` / `goal_contributions`** | Metas y apartados. |
| **`tasks`** | Pendientes de negocio. |
| **`audit_log`** | Trazabilidad de acciones. |
| **`requestId`** | Llave de idempotencia; repetirla con el mismo payload devuelve el mismo resultado. |
| **`requestHash`** | Hash del payload para detectar reuso de `requestId` con otros datos. |
| **`expectedVersion`** | Versión de corte que el cliente cree vigente; si no coincide → 409. |
| **`previewFingerprint`** | Huella de totales del preview; si cambian antes de guardar → 409. |
| **`snapshot_*`** | Foto inmutable de efectivo/fiado/pendiente al cerrar. |
| **`snapshot_known`** | `false` en filas migradas donde no se registraba fiado/digital. |
| **Soft delete** | Borrado lógico (`deleted_at`), no físico. |
| **Migración** | Cambios de esquema al arrancar; un solo proceso. |
| **WAL** | Write-Ahead Logging de SQLite. |

---

## E · IA y voz

| Término | Significado |
|---|---|
| **STT** | Speech-to-text; OpenAI `gpt-4o-mini-transcribe` o configurable. |
| **Parser** | Convierte texto en `ParsedSale` (items, efectivo, fiado, cliente, intención). |
| **`intent`** | `sale`, `query`, `credit_payment`, `unknown`. |
| **`mockParse` / parser local** | Parser sin OpenAI; catálogo y reglas locales. |
| **Kokoro `em_santa`** | Voz open-source usada para frases fijas. |
| **Piper `es_MX-claude-high`** | Voz local para frases dinámicas. |
| **TTS** | Text-to-speech. |
| **`speechSynthesis`** | Voz del navegador; **no** se usa como fallback en el código actual. |
| **`OPENAI_API_KEY`** | Clave server-only; sin ella el parser local funciona, pero STT no. |
| **`voice/transcribe`** | Ruta que recibe audio y devuelve texto. |
| **`voice/parse`** | Ruta que interpreta texto. |
| **Consulta local** | Respuesta de deuda/ventas sin llamar al parser. |
| **`answerDebtQuery`** | Módulo que responde “quién me debe”. |

---

## F · Demo y operación

| Término | Significado |
|---|---|
| **`DEMO_MODE`** | `true` fuerza demo; `false` fuerza real; ausente = demo si no hay `PEY_API_KEY`. |
| **`demo_paid`** | Estado de pago simulado. |
| **`/api/demo/pay`** | Simula pago digital; nunca efectivo. |
| **`/api/demo/reset`** | Reinicia fixtures; backup; bloqueo si hay datos reales. |
| **`PEY_API_KEY`** | Clave server-only; su presencia desactiva demo por defecto. |
| **`PEY_WEBHOOK_SECRET`** | Secreto de firma del webhook. |
| **`APP_URL`** | URL pública HTTPS para links/success/webhook. |
| **`DATABASE_PATH`** | Ruta alternativa de SQLite. |
| **`DEMO_RESET_TOKEN`** | Token opcional para reset; la UI no lo envía. |
| **`FORCE_DEMO_RESET`** | `1` permite reset con pagos reales, conservándolos. |
| **Túnel** | Cloudflare Quick Tunnel; URL efímera. |
| **Quick tunnel** | Túnel sin configuración estable; puede morir. |
| **Cloudflare Access** | Capa de autenticación para producción; el webhook queda fuera. |
| **`preflight`** | Chequeo de servidor, túnel, datos, QR y respaldos. |
| **`tunnel-smoke`** | Chequeo del camino público HTTPS (8 checks). |
| **`rehearsal`** | Ensayo del guion (3 corridas, 19 pasos). |
| **QR de demo** | QR imprimible que apunta al túnel. |
| **Video histórico** | MP4 de respaldo; en este repo es “Mostrador claro”, no la UI final. |

---

## G · Harness y Git

| Término | Significado |
|---|---|
| **Harness** | Capa de gates, evidencia y handoff. |
| **Gate** | Comando determinista con marker exacto y artefacto. |
| **`fast`** | 3 gates: guard, lint, types. |
| **`static`** | 5 gates: fast + deps + build. |
| **`full`** | 23 gates; no incluye build; film opcional (24). |
| **`build`** | Gate de build con `BUILD_SHA`; solo en static. |
| **`film`** | Gate opcional de video/Stageshow. |
| **Marker** | Cadena exacta que el harness exige (p. ej. `WEBHOOK OK` + `40/40`). |
| **`latest.json`** | Evidencia local de una corrida full `ok:true`; no se versiona. |
| **`latest-static.json`** | Evidencia local de static; no pisa el full. |
| **`verify:evidence`** | Valida latest contra HEAD, árbol, buildSha y hashes. |
| **`gitAtStart` / `gitAtEnd`** | SHA/branch/dirty al inicio/fin de una corrida. |
| **`buildBound`** | La evidencia está atada al build servido. |
| **`partial`** | Corrida con `--only`/`--skip`; no cuenta como handoff. |
| **`KNOWN`** | Limitación declarada, no un pase. |
| **`PASS` / `FAIL` / `KNOWN`** | Resultados de E2E. |
| **`VERIFICADO`** | Observado directamente. |
| **`INFERIDO`** | Deducido de una ausencia/patrón. |
| **`DESCONOCIDO`** | Sin fuente suficiente. |
| **`NO VERIFICADO`** | Documento lo afirma, pero no hay artefacto. |
| **Worktree** | Checkout separado del mismo repo; 49 en este repo al último snapshot. |
| **Fast-forward** | Avance de rama sin merge; técnicamente posible, pero **bloqueado** por el P0 adversario. |
| **Bloqueo de merge** | `master` (`a85d903`) prohíbe avanzar hasta corregir P0-1/P0-2. |
| **P0 adversario** | Fallo confirmado por `p0/adversarial`: reset borra pago pey; home cachea datos privados. |
| **Reset demo** | Borra filas `demo=1` y resiembra fixtures; no debe borrar pagos reales. |
| **Caché pública** | `Cache-Control: public, s-maxage=60` en `/`; incompatible con datos privados en HTML. |
| **Merge-base** | Ancestro común; `d35c791` entre master y final. |
| **Detached HEAD** | Worktree sin rama (p. ej. `mercadero-design-preview` en `572847d`). |
| **Tag** | Punto de referencia inmutable; 4 en este repo. |
| **Stash** | Cambios guardados temporalmente; 0 en este repo. |
| **Reflog** | Historial de movimientos de refs; útil para reconstruir merges. |

---

## H · Legal / privacidad / confianza

| Término | Significado |
|---|---|
| **Cuenta receptora autorizada** | Cuenta de un familiar con permiso; la app no accede a movimientos. |
| **Consentimiento** | Autorización explícita para voz/datos; la app muestra aviso, no un flujo formal completo. |
| **Datos personales** | Nombres de clientes, deudas, audio; no se exportan ni se comparten. |
| **Custodia** | Dinero real bajo resguardo de un tercero; la app **no** la ofrece. |
| **Anti-fraude** | Rechazo de comprobantes falsos y webhooks inválidos. |
| **Falso positivo** | Marcar pagado algo que no lo está; el peor error possible. |
| **Certeza** | Que el dinero llegó y se puede probar; tesis del producto. |
| **Trazabilidad** | Poder explicar cada evento con payload/firma/resultado. |
| **Auditoría** | Registro de eventos y acciones; `audit_log` + `payment_events`. |

---

## I · Frases que conviene no confundir

- **“Ventas registradas” ≠ “cobrado confirmado”.** La primera suma totales; la segunda solo efectivo + pey verificado.
- **“Fiado” ≠ “venta”.** Es deuda; el abono no crea una venta nueva.
- **“Apartado” ≠ “dinero depositado”.** Es declarado; no hay custodia.
- **“Demo” ≠ “pagado”.** `demo_paid` no se entrega.
- **“Pendiente” ≠ “ingreso”.** `pendingCents` no entra a la caja.
- **“Declarado” ≠ “verificado”.** Un abono digital de fiado no pasó por pey.
- **“Preview” ≠ “build final”.** La preview `397039d` no es `b7154ca`.
- **“Video de respaldo” ≠ “UI actual”.** El MP4 es “Mostrador claro”, no barrio.
- **“Full” ≠ “static”.** `full` no corre build; `static` sí.
- **“Un gate no ejecutado” ≠ “verde”.** Es `NO VERIFICADO` o `partial`.
