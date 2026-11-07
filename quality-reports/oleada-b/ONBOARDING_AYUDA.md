# Onboarding y ayuda — Oleada B (`/caja` y `/ventas`)

> **Rol:** `mc-onboarding-ayuda` · **Modo:** solo lectura.
> **Repo:** `mercado-cero` · **Rama:** `design/oleada-b-caja-ventas` · **Fecha:** 4 de noviembre de 2026.
> **Alcance:** copy visible, microcopy de estados, ayuda contextual y criterios de claridad de `/caja` (venta manual) y `/ventas` (historial).
> **Fuera de alcance:** implementar, cambiar contratos de dinero, editar código o hacer commits.
> **Método:** lectura estática de `web/src/components/caja/*`, `web/src/app/caja/page.tsx`, `web/src/app/ventas/page.tsx`, `ventas.css`, `nav.ts`, `payment-labels.ts`, `format.ts`, parsers y APIs; revisión de las capturas de `quality-reports/oleada-b/capturas` y del smoke `oleada-b-smoke.json`.
> **Límite:** **no ejecuté la app, ni el smoke, ni pruebas con personas, ni lector de pantalla.** Las capturas y el smoke son de una corrida previa; no son evidencia del HEAD actual.

---

## 0 · Veredicto

La venta manual existe y no depende de voz ni IA: se agregan productos, se calcula el total, se elige método y se registra. El smoke existente (33/33) y la lectura del código lo confirman en lo mecánico.

**La claridad no está lista para una primera venta sin acompañamiento.** Los problemas que más daño hacen no son de estilo:

1. El resultado de efectivo llama “Efectivo recibido” al efectivo **aplicado** y muestra un cambio que no cuadra con esa etiqueta: si el cliente dio $100 y el total era $70, se lee “Efectivo recibido $70.00 / Cambio $30.00”.
2. En una venta mixta efectivo + fiado, el resultado dice “No es dinero recibido” sobre **toda** la venta, aunque sí entraron $60 en efectivo.
3. En demo, una venta en efectivo se ve “PAGADO / Cobrado” en `/ventas`, mientras la tarjeta “Cobrado confirmado” dice $0.00.
4. El CTA se deshabilita sin decir por qué en los tres casos que más importan: efectivo vacío o insuficiente, fiado sin nombre y fiado mayor al total.
5. Un fallo de red muestra el mensaje crudo del navegador (“Failed to fetch”) y el botón sigue diciendo “Confirmar venta”; no hay un “Reintentar” que explique si la venta se guardó.
6. “Por cobrar” en `/ventas` es un saldo global que excluye fiado, pero se presenta junto a cifras de hoy y sin decirlo.
7. El parser convierte “1/2” en 12 unidades, “2,5” en 25 y “1,000” en $1.00 sin avisar.
8. El verde de “verificado” se usa también en fiado, demo, cambio y en el chip del total.

**Recomendación:** corregir estos ocho puntos antes de la prueba con personas; el resto es pulido de vocabulario y jerarquía. No hace falta un manual: hacen falta cuatro ayudas de una línea y un resultado que nombre cada cantidad.

---

## 1 · Evidencia, árbol y límites

`git status` muestra cambios sin commitear y archivos nuevos de la ola. No los modifiqué. La rama no está limpia; cualquier `verify` que se corra ahora tendrá `dirty:true` y no será evidencia válida hasta commitear.

| Revisé | Para qué |
|---|---|
| `web/src/components/caja/caja-screen.tsx` | flujo, estados, validaciones, borrador, recuperación de pendiente |
| `web/src/components/caja/sale-line-items.tsx` | alta de productos, copy de vacío y errores de línea |
| `web/src/components/caja/sale-summary.tsx` | total, métodos, efectivo/cambio, fiado, CTA |
| `web/src/components/caja/sale-result.tsx` | resultado, títulos, notas, saldos, acciones |
| `web/src/components/caja/payment-panel.tsx` | cobro digital, link/QR, demo, polling, errores |
| `web/src/components/caja/types.ts` | parseo de dinero y cantidad |
| `web/src/app/caja/page.tsx`, `web/src/app/ventas/page.tsx` | composición y copy de página |
| `web/src/app/ventas/ventas.css`, `web/src/components/caja/caja.css` | color y jerarquía que refuerzan o contradicen el copy |
| `web/src/components/shell/nav.ts`, `app-shell.tsx`, `mobile-nav.tsx` | shell, ayuda y salida a la app legacy |
| `web/src/lib/payment-labels.ts`, `db.ts`, `orders.ts` | verdad canónica de estados y saldos |
| `quality-reports/oleada-b/capturas/*`, `oleada-b-smoke.json`, `a11y.json` | evidencia existente y contradicciones visibles |
| **No revisado en ejecución** | runtime, red real, lector de pantalla, teléfono físico, personas |

> **Nota de evidencia:** las capturas `caja-efectivo-resultado-*.png` y `caja-digital-pendiente-*.png` muestran `TOTAL $0.00 · COBRAR` sobre la pantalla de resultado. El código actual (`caja-screen.tsx:369` y `394-409`) usa `order.totalCents` y oculta el CTA cuando `view !== "compose"`, así que la captura parece anterior al código. **No la uses como evidencia del HEAD**; hay que recapturar. El problema que sí queda es el H1 estático “Nueva venta” sobre el resultado.

---

## 2 · Lo que ya funciona y no hay que romper

- **Venta manual sin micrófono y sin IA:** el flujo se completa con teclado y botones; el smoke registra `voice_requests=[]` y el check “la venta manual no llamó a voz” pasa.
- **Alta, edición y borrado de productos:** el total se recalcula; el smoke valida $70 → $90 → $125 → $105.
- **Efectivo con cambio:** el cambio se calcula en vivo y se muestra antes de confirmar.
- **Fiado con nombre:** crea deuda sin efectivo; el resultado no dice “cobrado” (aunque el copy tiene los problemas de §5).
- **Digital pendiente:** crea el pedido, permite generar link/QR, hace polling y reanuda el cobro al recargar.
- **Demo separado:** el resultado de un pago demo dice “Pago demo (simulado)” y el smoke confirma `demo_paid`.
- **Borrador recuperable:** una venta interrumpida se restaura con `role="status"` y acciones.
- **Idempotencia de reintento:** el `requestId` se reutiliza si el payload no cambió; el smoke confirma que un 502 posterior al commit no duplica.
- **Accesibilidad automatizada:** `a11y.json` reporta 0 violaciones de axe y `under44: []`; 320/390 sin overflow. Ojo: la casa pide 48 px y los botones de icono (`caja.css:218-228`) miden 44; el script no los marca. Conviene subirlos a 48.
- **Navegación:** Caja y Ventas son destinos reales; el shell se comparte.

Todo esto es la base. El reporte no propone tocar contratos de dinero ni reescribir el motor.

---

## 3 · `/caja`: qué ve la persona y qué debería leer

### 3.1 Mapa de copy actual → copy propuesto

| Zona | Copy actual | Problema | Copy propuesto |
|---|---|---|---|
| Encabezado | “CAJA · Nueva venta” + “miércoles, 4 de noviembre. Registra sin IA: agrega conceptos, revisa el total y elige cómo cobrar.” | “Sin IA” es una categoría del producto, no de la persona; introduce una duda y envejece mal. “Conceptos” es contable. | “CAJA · Nueva venta” + “Agrega lo que vendiste, revisa el total y elige cómo te pagan.” |
| Chip de total | “TOTAL $0.00 · COBRAR” | Es un segundo CTA siempre activo; con $0 invita a un callejón sin salida. Fondo verde de éxito sobre un total no cobrado. | “Total $0.00 · Agrega un producto” cuando no hay líneas; “Total $90.00 · Ver cobro” cuando hay. Fondo neutro, no verde. |
| Sección de productos | “CONCEPTOS · Qué estás vendiendo · 0 conceptos” | Cuatro nombres para lo mismo: concepto, producto, servicio, “qué vendiste”. | “PRODUCTOS · Qué estás vendiendo · 0 productos”. |
| Vacío | “Aún no hay conceptos. Agrega uno a mano. No necesitas inventario ni micrófono.” | “Conceptos”; “a mano” suena a castigo; “ni micrófono” introduce un tema que la persona no preguntó. | “Aún no hay productos. Escribe lo que vendiste. No necesitas inventario.” |
| Alta | “Agregar concepto · Producto o servicio · Cantidad · Precio unitario · Agregar” | “Concepto” otra vez; no hay ayuda para fracciones; no hay ayuda de formato de precio. | “Agregar producto · Producto o servicio · Cantidad · Precio unitario · Agregar” + “Para medio kilo, usa 0.5.” + “Precio con punto decimal: 35.50.” |
| Columnas de línea | “Concepto · Cantidad · Precio · Importe” | “Precio” vs “Precio unitario”; “Importe” es el subtotal, no el total. | “Producto · Cantidad · Precio unitario · Subtotal”. |
| Cobro | “COBRO · Total de la venta · Lo que el cliente debe pagar. No es dinero recibido. · Cómo se paga” | “No es dinero recibido” es correcto, pero se repite en casi todas las pantallas; “Cómo se paga” es pasivo. | “COBRO · Total de la venta · Lo que el cliente debe pagar. Todavía no es dinero recibido. · ¿Cómo te pagan?” |
| Métodos | “Efectivo · Digital · Fiado · Mixto” | “Digital” no dice link/QR; “Mixto” no dice qué combina y se comporta como un cuarto método. | Mantener Efectivo y Fiado. “Digital” + ayuda “Link o QR; el banco confirma.” “Mixto” → “Combinar” + “Efectivo con digital o con fiado.” |
| Efectivo | “Efectivo recibido” | No hay ayuda; el CTA se deshabilita si está vacío sin explicar. | “Efectivo recibido” + “Escribe lo que te dieron. El cambio se calcula solo.” |
| Cambio / faltante | “Cambio $10.00” / “Falta cobrar $40.00” | “Cambio” no dice que se devuelve; “Falta cobrar” no ofrece salida. El cambio usa verde de éxito. | “Cambio a devolver $10.00” / “Faltan $40.00 para completar el cobro. Escribe más efectivo o elige Digital, Fiado o Combinar.” Fondo neutro. |
| Fiado | “Monto a fiado · ¿Quién queda a deber?” | No dice que es deuda; no hay ayuda de nombre; el CTA se deshabilita si falta. | “Monto a fiado” + “No es dinero recibido; queda como deuda.” “¿Quién queda a deber?” + “Escribe el nombre para poder cobrarle después.” |
| Digital | “Se generará un link o QR. El pago queda pendiente hasta que el banco lo confirme; una captura o un botón no confirman nada.” | “No confirman nada” suena a regaño; “banco” está bien, pero no dice qué hacer. | “Se creará un link o QR. El pago queda pendiente hasta que el banco lo confirme. Una captura no cuenta.” |
| CTA | “Confirmar venta” / “Generar cobro $50.00” / “Registrar fiado $100.00” | Falta “por”; no hay helper que diga qué quedará registrado. | “Confirmar venta” / “Generar cobro por $50.00” / “Registrar fiado por $100.00” + “Quedará a fiado con Juan.” o “Se registrará el efectivo y el cambio.” |
| Pie | “El total es lo que debe pagar el cliente; no es dinero recibido hasta que el método lo confirme.” + “¿Necesitas dictar? La Caja clásica sigue disponible en la vista anterior mientras migramos el resto de los módulos.” | La primera línea repite lo que ya dice el panel; la segunda está fuera del primer viewport, dice “vista anterior” y habla de migración. | Una línea: “El total no es dinero recibido hasta que confirmes el cobro.” La voz, cerca de “Agregar producto”: “¿Prefieres dictar? Abre la Caja clásica.” |

### 3.2 Hallazgos que no se resuelven solo con la tabla

**C-01 · “Sin IA” no es un beneficio para quien vende.** El subtítulo (`caja-screen.tsx:393`) pone la arquitectura del producto por delante de la tarea. Una persona que nunca usó la app no necesita saber que no hay IA; necesita saber qué hacer. Además, si la voz vuelve, el texto queda falso. **P1.**

**C-02 · Hay tres “Cobrar” compitiendo.** El chip del encabezado, la barra fija móvil y el botón del panel dicen “Cobrar” o “Confirmar venta”. En compose, el chip está activo incluso con $0 y solo hace scroll. En una caja de una pasada debe haber **un** primario visible. Propuesta: chip “Ver cobro” solo con líneas; barra fija “Cobrar”; panel “Confirmar venta”. **P1.**

**C-03 · El H1 no cambia con el estado.** El encabezado siempre dice “Nueva venta” (`caja-screen.tsx:391`), incluso cuando ya hay un resultado. La persona puede preguntarse si la venta se registró o si sigue en captura. Propuesta: “Nueva venta” en compose, “Cobrar venta” en pago, “Venta registrada” en resultado. **P1.**

**C-04 · La voz está enterrada y la salida es ambigua.** El único aviso es el pie (`caja-screen.tsx:506-509`): “La Caja clásica sigue disponible en la vista anterior…”. “La vista anterior” no es un nombre; el enlace va a `/`, no a una ruta llamada “Caja clásica”; y “mientras migramos” es una excusa interna. Si la voz importa, debe estar cerca de “Agregar producto” con el nombre “Caja clásica”. Si no importa en B, quitar el pie y no prometerla. **P1 de inclusión.**

**C-05 · El chip del total usa verde de éxito.** `caja.css:22-42` pinta el chip con `--color-green-soft` y `--color-accent` siempre. En esta app el verde significa “verificado” o “pagado”; un total que todavía no se cobró no debería verse verde. Propuesta: `surface-2` con borde de acento; verde solo para el estado verificado. **P1 de verdad visual.**

**C-06 · “Limpiar venta” no es “descartar”.** El botón dice “Limpiar venta” (`sale-summary.tsx:193`) y el diálogo nativo dice “¿Descartar la venta sin confirmar?” (`caja-screen.tsx:469`). Dos verbos para la misma acción; “limpiar” suena a borrar campos, no a perder la venta. Propuesta: “Descartar venta” + confirmación inline “¿Descartar esta venta? Se pierden los productos.” **P2.**

**C-07 · Después de agregar, el foco no vuelve al producto.** `addLine` (`sale-line-items.tsx:28-52`) limpia los campos pero no enfoca la descripción. Para vender cinco cosas, la persona tiene que tocar el campo de producto cinco veces. El reset de “Nueva venta” sí enfoca (`caja-screen.tsx:182-187`). Propuesta: mismo foco después de agregar; opcional Enter para agregar. **P2 de fricción.**

**C-08 · En 320/390 el botón “Agregar” queda bajo la nav y el flujo manual exige scroll.** La captura `caja-vacia-390x844.png` muestra el botón “Agregar” cortado por la barra inferior. No es un bloqueo (se puede desplazar), pero una persona mayor puede no descubrirlo. Propuesta: fila de alta más compacta o “Agregar” visible sin scroll; no reducir targets. **P2 de acompañamiento.**

---

## 4 · ¿Se puede vender sin micrófono y sin IA?

| Pregunta | Respuesta | Evidencia |
|---|---|---|
| ¿Se puede vender sin micrófono? | **Sí.** No hay micrófono en `/caja`; el alta es por campos. | `sale-line-items.tsx`; smoke “la venta manual no llamó a voz”. |
| ¿Se puede vender sin IA? | **Sí.** El POST de la venta no depende de un modelo; el intérprete de voz no está en esta pantalla. | `caja-screen.tsx:274-319`; smoke `voice_requests=[]`. |
| ¿La voz bloquea? | **No.** No existe estado de “escuchando” ni espera de transcripción. | No hay referencias a voz en `components/caja/*`. |
| ¿La voz es opcional? | **No exactamente: está ausente.** La alternativa existe en la Caja clásica, pero el aviso está en el pie y el enlace dice “la vista anterior”. | `caja-screen.tsx:506-509`. |
| ¿El flujo manual es rápido? | **Aceptable en desktop; lento en móvil.** En 390/320 el alta ocupa casi toda la pantalla, “Agregar” queda bajo la nav y el foco no vuelve al producto. | Capturas `caja-vacia-390/320`; `sale-line-items.tsx:28-52`. |
| ¿Se puede usar solo con teclado? | **Sí, con fricción.** Los controles son accesibles, pero Enter no agrega y el foco no se mueve después de agregar. | `sale-line-items.tsx:139-185`; no hay `<form>`. |
| ¿La pantalla promete voz? | **Un poco.** “Sin IA” y “ni micrófono” introducen el tema; el pie ofrece la Caja clásica. | `caja-screen.tsx:393`; `sale-line-items.tsx:69`. |

**Conclusión:** sí, una persona puede vender sin micrófono y sin IA; la voz no bloquea porque no está. El problema es de copy: se menciona la IA en el lugar equivocado y la alternativa de voz no es descubrible. La corrección no es “agregar un micrófono”, es **dejar de vender la ausencia** y, si la Caja clásica sigue siendo la opción de voz, nombrarla y ponerla donde se decide el alta.

---

## 5 · Mensajes de error y recuperación

### 5.1 El hallazgo central: el CTA se apaga antes de que el mensaje pueda hablar

`canConfirm` (`caja-screen.tsx:358-365`) deshabilita el botón si:

- no hay líneas o el total es 0;
- el fiado supera el total (`overpay`);
- el fiado no tiene nombre;
- el método es efectivo y el efectivo no cubre el total;
- el método es fiado y el fiado no cubre el total.

`validate()` (`caja-screen.tsx:205-241`) contiene mensajes correctos para esos casos, pero **solo se ejecuta dentro de `confirmSale()`**, y `confirmSale()` no se puede invocar con el botón deshabilitado. En la práctica, los mensajes de fiado sin cliente, fiado mayor al total y fiado incompleto son **inalcanzables**; la persona solo ve un botón gris. Ese es el P0 de acompañamiento más importante de `/caja`.

### 5.2 Matriz de errores

| ID | Caso | Lo que ve hoy | Problema | Copy recomendado | Sev. |
|---|---|---|---|---|---|
| E-01 | Efectivo insuficiente, campo vacío | Nada; “Confirmar venta” deshabilitado | El método por defecto es Efectivo. La persona agrega un producto y no sabe por qué no puede confirmar. | Bajo el campo: “Escribe el efectivo que te dieron o elige otro método.” En el panel: “Falta cobrar $90.00.” | **P0** |
| E-02 | Efectivo insuficiente, con monto | “Falta cobrar $40.00” en bloque terracota; CTA deshabilitado | Dice qué falta, no qué hacer; el rojo lo trata como error en vez de decisión. | “Faltan $40.00 para completar el cobro. Escribe más efectivo o elige Digital, Fiado o Combinar.” | P1 |
| E-03 | Fiado sin cliente | Nada; CTA deshabilitado | El campo “¿Quién queda a deber?” no está marcado como obligatorio. | “Escribe el nombre de quien queda a deber para registrar el fiado.” | **P0** |
| E-04 | Fiado mayor al total | Nada; CTA deshabilitado. El desglose muestra el fiado topado al total, así que el número escrito no coincide con el aplicado. | La persona escribió $120, el desglose dice $100 y no hay explicación. | “El fiado no puede ser mayor que el total ($100.00). Ajusta el monto o elige Combinar.” | **P0** |
| E-05 | Fiado menor al total, método Fiado | Nada; CTA deshabilitado | No hay camino visible para completar con efectivo. | “El fiado no cubre el total. Faltan $20.00; elige Combinar para poner efectivo y fiado.” | P1 |
| E-06 | El total cambia después de elegir Fiado | El monto a fiado se queda con el total viejo; el CTA se deshabilita por sobrepago o faltante, sin aviso | Valor obsoleto oculto; la persona no entiende por qué dejó de funcionar. | “El total cambió. Ajusta el monto a fiado.” + actualizar el campo o enfocarlo. | P1 |
| E-07 | Producto vacío en una línea existente | “Escribe el concepto.” solo después de confirmar; si el precio también está vacío, el total es 0 y el CTA se apaga sin mensaje | Dos nombres (“concepto” / “qué vendiste”); el error no se limpia al corregir. | “Escribe qué vendiste.” + limpiar el error al cambiar el campo. | P1 |
| E-08 | Cantidad o precio inválidos | En el alta hay mensajes; en una línea existente no hay validación. El total baja en silencio y el CTA puede apagarse. | El error no está en el campo que lo causa; la persona no sabe qué corregir. | “Escribe una cantidad mayor que cero. Para medio kilo, usa 0.5.” / “Escribe un precio mayor que cero. Usa punto decimal, sin separadores de miles.” | **P0** |
| E-09 | Error de red o respuesta no JSON | `caught.message` crudo: “Failed to fetch”, “Load failed”, “Unexpected token '<'…”. El botón sigue diciendo “Confirmar venta”. | Inglés/técnico; no dice si la venta se guardó; invita a repetir y duplicar. | “No sabemos si la venta quedó registrada. Revisa tu conexión y toca Reintentar. Si cambias los productos o el monto, revisa Ventas antes de cobrar otra vez.” | **P0** |
| E-10 | Reintento después de error | El mismo botón “Confirmar venta”; el `requestId` solo se reutiliza si el payload no cambió | No hay señal de que reintentar sea seguro; si la persona edita, se genera otra llave y puede duplicar. | Botón “Reintentar venta” + “No cambies los datos para no duplicar. Si tienes que cambiarlos, revisa Ventas primero.” | **P0** |
| E-11 | Error de línea obsoleto | El mensaje rojo se queda después de corregir el campo; `onUpdate` no limpia `lineErrors` | La persona cree que sigue mal cuando ya está bien. | Limpiar el error de esa línea al cambiar cualquiera de sus campos. | P2 |
| E-12 | Error de alta obsoleto | Cambiar la cantidad no limpia `addError`; solo descripción y precio lo hacen | Mensaje falso hasta el siguiente “Agregar”. | Limpiar `addError` al cambiar cantidad, precio o descripción. | P2 |
| E-13 | 409 de idempotencia | “Ese identificador de solicitud ya se usó con otros datos. No se creó otro pedido.” o el mensaje cross-mode | “Identificador de solicitud” es lenguaje de desarrollador; no dice qué revisar. | “Esta venta ya se había registrado con otros datos. No se creó otra. Revisa Ventas antes de volver a cobrar.” | P1 |
| E-14 | Rate limit | “Demasiadas solicitudes. Espera un momento e intenta de nuevo.” | Es correcto, pero no confirma que no se creó una venta. | “Espera unos segundos y vuelve a intentar. No se registró otra venta.” | P2 |
| E-15 | Fallo al generar link/QR, actualizar o simular | En `payment-panel.tsx`, `caught.message` crudo para fallos de red; para fallos del servidor, “No se pudo generar el cobro.” / “No se pudo leer el pedido.” / “No se pudo simular el pago.” | “Cobro” no distingue link de QR; no dice si se creó algo. | “No se pudo crear el link. Revisa tu conexión y vuelve a intentar.” / “No se pudo crear el QR. Vuelve a intentar; no se generó otro.” / “No se pudo actualizar. Vuelve a intentar.” / “No se pudo simular el pago.” | P1 |
| E-16 | Efectivo insuficiente: el CTA se rotula como cobro digital | Con método Efectivo y $50 de $90, el botón dice “Generar cobro $40.00” pero está deshabilitado, porque `confirmLabel` usa `digitalDueCents` sin mirar el método (`sale-summary.tsx:54-63`) y `canConfirm` exige efectivo completo (`caja-screen.tsx:364`). | El botón promete una acción que el método elegido no va a ejecutar; la persona no entiende si debe generar un cobro o completar el efectivo. | Mientras el método sea Efectivo y falte dinero: “Faltan $40.00” o “Completar cobro”, no “Generar cobro”. El texto “Generar cobro” solo aparece si el método o la combinación va a crear un cobro digital. | **P0** |

### 5.3 El parser convierte entradas ambiguas en otro número

`types.ts:17-32` limpia los caracteres que no sean dígitos o separadores. Eso produce errores de dinero silenciosos:

| La persona escribe | Hoy se interpreta | Debería |
|---|---:|---|
| `1/2` (medio kilo) | **12 unidades** | 0.5 o error “Usa 0.5 para medio kilo.” |
| `1 1/2` | **112 unidades** | 1.5 o error |
| `2,5` (2.5 kg) | **25 unidades** | 2.5 o error |
| `2.5` | 2.5 | 2.5 |
| `1,000` (mil pesos) | **$1.00** | $1,000.00 o error |
| `1,234.50` | **$0.00** | $1,234.50 o error |
| `35,50` | $35.50 | $35.50 (bien) |
| `1000` | 1000 | 1000 |
| `1000.999` | $1,000.99 (redondea) | Aceptar o avisar que se redondea |
| `1000` en cantidad | 999 (tope silencioso) | Aceptar 1000 o avisar “máximo 999” |

No es solo un mensaje: es una venta con otra cantidad o otro precio. **P0 de validación.** La corrección debe ser de parser y de copy, no solo de copy. Mientras se arregla, el texto de ayuda debe decir “Usa punto decimal y escribe la cantidad sin fracciones” — pero eso no sustituye la validación.

### 5.4 Copy para el error de red y el reintento

**Hoy:** `setError(caught instanceof Error ? caught.message : "No se pudo registrar la venta.")` (`caja-screen.tsx:314-315`); lo mismo en `payment-panel.tsx:76-77,98-99,120-121`.

**Propuesta:**

> **No sabemos si la venta quedó registrada.**
> Revisa tu conexión y toca **Reintentar**. Si cambias los productos o el monto, revisa **Ventas** antes de cobrar otra vez.

Con dos acciones:

- **Reintentar venta** (primario; conserva productos, efectivo, fiado y nombre).
- **Ver ventas** (secundario; para comprobar si ya apareció).

Y una nota corta: “No cambies los datos para no duplicar.” El `requestId` protege el mismo payload; no protege una edición. La copy no debe prometer “nunca se duplica”.

Si el error es de validación del servidor, no mostrar el mensaje crudo: mapear por `code` (`validation_error`, `request_id_conflict`, `rate_limited`, `body_too_large`) a una frase y, cuando aplique, al campo.

---

## 6 · Verdad del dinero: pagado, pendiente, demo, fiado y cambio

### 6.1 Matriz de estados visibles

| Situación | Lo que ve hoy | Lo que es verdad | Ambigüedad que puede confundir | Copy recomendado |
|---|---|---|---|---|
| **Efectivo exacto** | “Venta cobrada en efectivo” / $90 / “El efectivo se registró en la caja…” / Estado “Pagado” / “Efectivo recibido $90” | Entraron $90; no hay cambio | “Efectivo recibido” es correcto aquí, pero es el mismo rótulo que en el caso con cambio, donde es falso | “Cobraste $90.00 en efectivo.” / “Recibiste $90.00.” |
| **Efectivo con cambio** | “Venta cobrada en efectivo” / $70 / “Efectivo recibido $70.00” / “Cambio $30.00” | Recibió $100; se aplicaron $70; cambio $30 | **“Recibido $70 + cambio $30” no cuadra**: si recibió 70, el cambio sería 0. El rótulo muestra el aplicado, no el recibido. | “Cobraste $70.00.” / “Recibiste $100.00.” / “Se aplicaron $70.00.” / “Cambio a devolver $30.00.” |
| **Efectivo + fiado** | “Venta registrada con saldo fiado” / $90 / “La venta quedó registrada y tiene saldo vivo en Fiado. **No es dinero recibido**.” / “Efectivo recibido $60” / “Saldo vivo fiado $30 · Juan” | Entraron $60; $30 quedaron a fiado | **El “No es dinero recibido” niega los $60 que sí entraron.** El banner “Quedó anotado en Fiado…” hace que toda la venta parezca deuda. | “Cobraste $60.00 y quedaron $30.00 a fiado.” / “Efectivo recibido $60.00.” / “Fiado pendiente $30.00 · Juan.” / “El fiado es deuda: no lo cuentes como dinero recibido.” (solo para la parte fiada) |
| **Fiado puro** | “Venta registrada con fiado” / $100 / “La venta quedó registrada y tiene saldo vivo en Fiado. No es dinero recibido.” / Estado “Registrado” / “Saldo vivo fiado $100 · Cliente B” / banner / “no entregues como cobrado” | No entró dinero; Juan debe $100 | El icono es verde; el estado dice “Registrado”, no “Fiado”; el importe grande no está rotulado; “Cliente B” se parte en dos líneas. | “Quedó a fiado con Juan.” / Importe rotulado “Fiado pendiente”. / “No recibiste dinero. Juan debe $100.00.” / “Anotado en Fiados.” / Acción “Ver fiado de Juan”. |
| **Digital pendiente, sin link** | Panel “Pedido AA09” / estado “Registrado” / “Falta cobrar $50.00” / “El pedido ya está registrado. El dinero aún no se considera recibido.” / “Generar link” / “Generar QR” | Venta registrada; no hay pago ni link | “Registrado” no dice “por cobrar”; “proveedor” aparece en la nota; no se explica que falta crear el link. | Estado “Por cobrar”. “La venta está registrada, pero no has recibido el pago.” / “Crear link de cobro” / “Crear QR”. |
| **Digital pendiente, con link** | “Pendiente” / “Falta cobrar $50.00” / “LINK DE COBRO · Abrir link” + icono de copiar / URL cruda (en demo, `http://localhost:3100/...`) / “Actualizar estado” | Link generado; el banco aún no confirma | “Abrir link” no es la acción que necesita la comerciante (compartir); el icono de copiar no tiene texto visible; la URL localhost parece compartible; “Pendiente” no dice “esperando al banco”. | Estado “Esperando al banco”. Título “Link de cobro listo”. Primario “Copiar link” (visible); secundario “Abrir link”. “Compártelo con el cliente. El pago se confirma solo.” En demo: “Link de prueba: solo funciona en este equipo. No lo compartas.” |
| **Demo digital** | “Pago demo (simulado)” / “Esta simulación no es dinero real ni una confirmación del banco.” / Estado “Demo pagado” / icono verde / bloque “Simular CoDi/tarjeta” | Simulación; no es dinero; no se entrega | **“Demo pagado” dice “pagado”**, justo lo que la verdad demo prohíbe; el verde refuerza “éxito”; no hay “no entregues”. | “Pago demo (simulado).” / Estado “Demo · no es dinero real.” / “No entregues el producto por este pago.” / Sin verde. |
| **Efectivo demo** | “Venta cobrada en efectivo” / icono verde / Estado “Pagado” / “Efectivo recibido $70” | En modo demo, el efectivo demo no entra a `cashCents`; la tarjeta “Cobrado confirmado” lo excluye | **La fila y el resultado lo presentan como dinero real**, mientras el resumen lo excluye. La captura `ventas-1448x1086.png` muestra “Cobrado confirmado $0.00” y una fila “PAGADO / Cobrado $80.00”. | “Efectivo demo (simulado).” / “No entra al corte real.” O una decisión de producto: si el efectivo demo debe contar, que cuente en el resumen y se etiquete; no puede estar en un lado y no en el otro. |
| **Verificado por pey** | “Pago confirmado por pey” / “El pago fue confirmado por el proveedor. No lo confirmó una captura ni un botón.” / banner “Confirmación del proveedor, no de una captura.” / verde | Pago digital real confirmado por webhook firmado | “Proveedor” en vez de “pey” o “banco”; el banner repite la nota; el verde es correcto aquí, pero comparte color con todo lo demás. | “Pago verificado por pey.” / “El banco confirmó el pago. Ya puedes entregar.” / “Una captura no cuenta.” / Verde solo aquí. |
| **Parcial / efectivo + digital pendiente** | Panel “Falta cobrar $30.00” / “El pedido ya está registrado. **El dinero aún no se considera recibido**.” / estado “Pendiente” | Ya entraron $60 en efectivo; faltan $30 digitales | **La frase niega los $60 recibidos**; no hay desglose. | “Ya recibiste $60.00 en efectivo. Faltan $30.00 por cobrar en digital.” / Estado “Pago parcial”. |
| **Cambio** | “Cambio $10.00” en verde; el resultado lo muestra como un hecho más; si se recarga, el resultado no se recupera (no hay pending para una venta cubierta) y el cambio se pierde | Es un cálculo de presentación, no un pago; no se guarda | El verde lo equipara con “verificado”; al recargar, la persona no sabe si dio cambio o no. | “Cambio a devolver $10.00.” / “Recibiste $100.00; se aplicaron $90.00.” / Fondo neutro. Si no se persiste: “El cambio no se guardó en la venta.” |

### 6.2 El importe grande del resultado no está rotulado

`SaleResult` muestra `order.totalCents` como número protagonista (`sale-result.tsx:62`) sin una etiqueta “Total de la venta”. En efectivo cobrado se puede inferir; en fiado o mixto no. La persona puede leer el número como “lo que me pagaron” o “lo que me deben”. **Cada importe grande debe llevar etiqueta:** “Total de la venta”, “Fiado pendiente”, “Falta cobrar”, “Recibiste”.

### 6.3 Títulos, notas y acciones recomendados por variante

| Variante | Título | Importe | Hechos | Nota | Acciones |
|---|---|---|---|---|---|
| Efectivo exacto | “Cobraste $90.00 en efectivo” | “Total de la venta $90.00” | “Recibiste $90.00” | “El efectivo ya está en tu caja. No pasó por el banco.” | Nueva venta · Ver ventas |
| Efectivo con cambio | “Cobraste $70.00 en efectivo” | “Total de la venta $70.00” | “Recibiste $100.00” · “Se aplicaron $70.00” · “Cambio $30.00” | “El cambio no es un pago; no se suma a la venta.” (o “El cambio no se guardó” si no se persiste) | Nueva venta · Ver ventas |
| Efectivo + fiado | “Cobraste $60.00 y quedaron $30.00 a fiado” | “Total de la venta $90.00” | “Efectivo recibido $60.00” · “Fiado pendiente $30.00 · Juan” | “El fiado es deuda: no lo cuentes como dinero recibido.” | Ver fiado de Juan · Nueva venta |
| Fiado puro | “Quedó a fiado con Juan” | “Fiado pendiente $100.00” | “Cliente Juan” · “Fiado $100.00” · “Recibido $0.00” | “No recibiste dinero. Juan debe $100.00.” | Ver fiado de Juan · Nueva venta |
| Digital pendiente | “Cobro pendiente” | “Falta cobrar $50.00” | “Venta registrada” · “Pago digital pendiente” | “El banco todavía no confirma. No entregues como pagado hasta que aparezca Pagado.” | Crear link · Crear QR |
| Demo | “Pago demo (simulado)” | “Total de la venta $50.00” | “Estado Demo · no es dinero real” | “No entregues el producto por este pago.” | Nueva venta · Cerrar demo |
| Verificado | “Pago verificado por pey” | “Total de la venta $50.00” | “Pagado · verificado por pey” | “El banco confirmó el pago. Ya puedes entregar.” | Nueva venta · Ver ventas |
| Parcial (efectivo + digital) | “Pago parcial: faltan $30.00” | “Total de la venta $90.00” | “Efectivo recibido $60.00” · “Falta digital $30.00” | “Ya entró el efectivo; el digital sigue pendiente.” | Copiar link · Actualizar |

### 6.4 Reglas de verdad visual y verbal

- **Verde solo para verificado por pey.** El efectivo es neutro (icono `Banknote`), el fiado es terracota/atención (`NotebookPen`), el pendiente es azul/info (`Clock3`), el demo es maíz (`FlaskConical`), el cambio es neutro. Hoy `caja.css:678-687` pinta **todos** los iconos de resultado de verde; `caja.css:407-410` pinta el cambio de verde; `caja.css:22-42` pinta el chip del total de verde.
- **“Pagado” solo si está cubierto.** “Pagado” no significa “entregable” si hay fiado abierto; la copy debe decir “Pagado, con fiado pendiente” o no usar “Pagado” como título.
- **“Cobrado” solo si entró dinero.** Un fiado no es “cobrado”; un pendiente digital no es “cobrado”; un demo no es “cobrado”.
- **“Verificado” solo si lo confirmó pey.** El efectivo no es “verificado”; el demo no es “verificado”; una captura no es “verificado”.
- **“Demo” nunca lleva “pagado”.** La etiqueta canónica es “Pago demo (simulado)” (`payment-labels.ts:48-51`). Hoy `sale-result.tsx:151-152` y `payment-panel.tsx:253-254` dicen “Demo pagado”.
- **“Fiado” siempre se acompaña de “no es dinero recibido” una vez, no tres.** La repetición en título, nota, banner y pie cansa y hace que la persona deje de leer.
- **“Saldo vivo” es jerga.** Usar “Fiado pendiente”. `creditCents` es el monto original; `creditBalanceCents` es el saldo vivo. La UI usa el campo correcto, pero el rótulo no lo explica.
- **El cambio no es un pago.** No se guarda, no se suma, no se marca “verificado”. Si no se persiste, el resultado debe decirlo, no omitirlo.
- **La fecha del cambio:** `changeCents` solo vive en memoria (`caja-screen.tsx:68,291`). En una venta cubierta, `PENDING_KEY` se borra (`caja-screen.tsx:294-298`), así que al recargar se vuelve a compose y el cambio desaparece. Persistirlo atado al `orderId`, mostrarlo en el detalle de `/ventas` o decir “Cambio no registrado” son las salidas honestas.

---

## 7 · `/ventas`: estados, importes, método, saldo, vacío y paginación

### 7.1 Lo que dice hoy

| Zona | Copy actual | Problema | Copy propuesto |
|---|---|---|---|
| Encabezado | “VENTAS · Historial” + “Consulta las ventas registradas. Los importes son ventas, no necesariamente dinero cobrado.” | El H1 no coincide con la nav (“Ventas”); el subtítulo empieza con una advertencia larga. | “VENTAS · Ventas” + “Lo que vendiste y cómo se cobró.” La advertencia va en la leyenda del final. |
| Tarjeta 1 | “Ventas hoy” / “Registradas, no necesariamente cobradas” | “Ventas” puede leerse como cobrado; el helper lo aclara, pero el título no. | “Vendido hoy” / “Todo lo registrado hoy, cobrado o no.” |
| Tarjeta 2 | “Cobrado confirmado” / “Efectivo + pagos verificados por pey” | En demo, excluye el efectivo demo; una fila puede decir “Cobrado $80” y esta tarjeta $0.00. No incluye abonos de fiado en la descripción. | “Cobrado hoy” / “Efectivo y pagos verificados. No incluye demo ni fiado.” En demo: “Cobrado demo” o “Cobrado real $0 · demo $80”. |
| Tarjeta 3 | “Por cobrar” / “Saldo pendiente, sin sumarlo a la caja” | Es un saldo **global** (`pendingCentsTotal`, `db.ts:1475-1487`), no de hoy; **excluye fiado**; “la caja” es ambiguo. | “Por cobrar digital” / “Links y QR pendientes de todos los días. No incluye fiado.” Si se quiere hoy, usar `summary.pendingCents` y decirlo. |
| Lista | “Ventas registradas” / “20 en total · página 1 de 1” | No dice “mostrando 25”; con muchas ventas no se sabe cuántas se ven. | “Ventas registradas” / “Mostrando 1–20 de 20 · página 1 de 1”. |
| Fila | Badge + “Pedido A58F” + “Hoy 8:07 a.m. · Sin método · Cliente C” + importe + “Cobrado $X” o “Sin cobro confirmado” + “Saldo vivo” | “Sin método” en fiado y pendiente; no muestra el saldo pendiente digital; “Parcial” se usa para una venta cubierta con fiado; “Saldo vivo” es jerga. | Badge “Fiado” / “Pendiente” / “Pagado” / “Demo”; método “Fiado”, “Digital”, “Efectivo + fiado”; importe “Total $90.00” + “Recibido $60.00 · Falta $30.00”; “Fiado pendiente $30.00 de $100.00”. |
| Detalle | “Ver conceptos” | “Conceptos” es contable; no parece desplegable. | “Ver detalle” o “Ver productos” + chevron. |
| Paginación | “Anterior” / “Siguiente” | Correcto, pero sin “Mostrando X de Y” ni “Volver a la primera” cuando la página no existe. | “Anterior / Siguiente” + “Mostrando 1–25 de 84”. |
| Nota final | “El historial se lee de la misma base que Caja. Un pedido pendiente o fiado no es dinero recibido; solo se marca pagado con la confirmación válida del proveedor o con el efectivo registrado.” | Habla de implementación (“misma base”), de “proveedor” y de “pedido”; es larga. | “Pagado = dinero cobrado. Pendiente y fiado = todavía no es dinero recibido. Demo = simulación.” |

### 7.2 Hallazgos

**V-01 · “Historial” vs “Ventas”.** La nav dice “Ventas”, el H1 dice “Historial”, el botón dice “Nueva venta”, la nota dice “historial”. La persona puede pensar que “Ventas” es otra cosa. Propuesta: H1 “Ventas”, eyebrow “Historial”, o al revés, pero un solo nombre. **P2.**

**V-02 · En demo, la página se contradice.** La captura `ventas-1448x1086.png` muestra “Cobrado confirmado $0.00” y una fila “PAGADO Pedido B793 $80.00 / Cobrado $80.00”. El resumen usa `cashCents` + `verifiedDigitalCents` (`ventas/page.tsx:84-90`), que excluye demo; las filas usan `order.status` y `order.paidCents`, que incluyen el efectivo demo. `db.ts:1354-1357` decide a propósito que el efectivo demo conserve la etiqueta “Efectivo recibido”, y `getDailySummary` lo manda a `demoCashCents` (`db.ts:1816-1830`). El resultado es una contradicción visible. **P0 de verdad del dinero.**

- Opciones: (a) en demo, todas las cifras y filas se etiquetan “demo” y el resumen incluye demo; (b) en demo, las filas demo llevan sello “DEMO” y la tarjeta dice “Cobrado real $0 · demo $80”; (c) no se muestran ventas demo en el historial real. Cualquiera es mejor que “Pagado/Cobrado” sin demo.

**V-03 · “Por cobrar” no es lo que parece.** Es global, no de hoy, y excluye fiado. La tarjeta está junto a “Ventas hoy” y “Cobrado confirmado” (hoy), así que se lee como si fuera del día. **P0 de alcance.** Copia: “Por cobrar digital (acumulado)” + “Links y QR de todos los días. No incluye fiado.” Si producto quiere hoy, cambiar el dato y decir “de hoy”.

**V-04 · “Cobrado confirmado” excluye demo, pero las filas no.** Es el mismo problema de V-02, visto desde la tarjeta. **P0/P1.**

**V-05 · “Sin método” en fiado y pendiente.** `paymentMethod` es null para fiado puro y para un pedido digital sin pago; `methodLabel` (`ventas/page.tsx:221-235`) devuelve “Sin método”, que suena a dato faltante o error. **P1.** Copia: derivar de `creditBalanceCents` y `due`:

- fiado → “Fiado”
- pendiente digital → “Digital”
- efectivo + fiado → “Efectivo + fiado”
- efectivo + digital → “Efectivo + digital”
- sin dato → “Sin cobro” (nunca “Sin método”).

**V-06 · La fila no muestra cuánto falta.** Para un pendiente con $60 cobrados y $30 digitales, la fila muestra “Cobrado $60.00” y nada más; el saldo de $30 no aparece. Para un pendiente con $0, muestra “Sin cobro confirmado” y el total; no dice “Falta $50.00”. **P1.** Copia: “Recibido $60.00 · Falta $30.00” o “Falta $50.00 por cobrar”.

**V-07 · “Parcial” se usa para dos cosas.** `statusLabel` devuelve “Parcial” cuando hay crédito y algún pago (`ventas/page.tsx:211-213`), aunque la venta esté totalmente cubierta por efectivo + fiado. Eso no es un pago parcial: es una venta con fiado. **P1.** Copia: “Fiado + efectivo” para ese caso; reservar “Pago parcial” para `partially_paid`.

**V-08 · Tres vocabularios para el mismo estado.** Caja dice “Registrado” / “Pendiente”; Ventas dice “Registrado” / “Pendiente” / “Fiado” / “Parcial” / “Demo”; `payment-labels.ts` dice “Por cobrar” / “Esperando confirmación” / “Demo (simulado)”. **P1.** Un solo mapeo:

- `confirmed` con saldo digital → “Por cobrar”
- `payment_pending` → “Esperando al banco”
- `confirmed` solo fiado → “Fiado”
- `confirmed` efectivo + fiado → “Fiado + efectivo”
- `paid` efectivo → “Pagado en efectivo”
- `paid` verificado → “Pagado · verificado”
- `demo_paid` → “Demo (simulado)”
- `fulfilled` → “Entregado”
- `cancelled` → “Cancelado”
- `partially_paid` → “Pago parcial”.

**V-09 · Vacío falso en página fuera de rango.** Si `page=99` y hay 20 ventas, `orders.length===0` y la página muestra “Todavía no hay ventas registradas.” (`ventas/page.tsx:98-101`), lo cual es falso. **P1/P2.** Copia: “No hay ventas en esta página.” + “Volver a la primera”. Además, clampear la página o redirigir.

**V-10 · La nota final es técnica.** “La misma base que Caja”, “proveedor”, “pedido”. **P1 de copy.** Reemplazar por la leyenda de tres verdades.

**V-11 · En 320, las tarjetas se comen el primer viewport.** La captura `ventas-320x640.png` muestra solo las tres tarjetas; la lista empieza debajo. La persona que entra a “Ventas” no ve ninguna venta. **P2 de composición/acompañamiento.** Propuesta: resumen en una línea o tarjetas de 3 columnas compactas; la lista primero.

**V-12 · “Pedido A58F” no es un folio útil.** Son los últimos 4 caracteres de un id; no es secuencial ni memorable. **P2.** Propuesta: “Venta de las 8:07” como título y “Folio A58F” como dato secundario; o un folio diario secuencial si el backend lo permite.

**V-13 · No hay enlace al fiado desde la fila.** El saldo vivo se muestra, pero para ver abonos o el detalle la persona tiene que ir a “Fiados” (que es legacy). **P2.** Añadir “Ver fiado de Juan” en la fila o en el detalle.

**V-14 · No hay estado de error de carga.** `/ventas` es server component; si la DB falla, no hay `error.tsx` ni copy de recuperación. **P2.** Añadir un estado “No pudimos cargar las ventas. No sabemos si hay ventas. Reintentar.” (Si no se implementa, al menos documentar el límite.)

---

## 8 · Ayuda contextual: una leyenda y cinco frases, no un manual

La app legacy ya tiene una ayuda larga (`caja-app.tsx:7924-8138`): 6 preguntas, primeros pasos, accesibilidad, preferencias. **No copiarla a `/caja`**: sería un manual dentro de una caja de una pasada. La ayuda nueva debe ser una leyenda y un botón “?” con cuatro o cinco frases.

### 8.1 Leyenda permanente (una línea bajo el total o los métodos)

> **Total de la venta no es dinero recibido.** Efectivo se registra; digital lo confirma el banco; fiado es deuda.

Esto cubre la duda más común sin abrir nada.

### 8.2 Hoja “¿Cómo funciona?” (5 puntos, 1 línea cada uno)

1. **Efectivo:** “Escribe lo que te dieron. El cambio se calcula solo.”
2. **Digital:** “Se crea un link o QR. El banco confirma; una captura no cuenta.”
3. **Fiado:** “Queda como deuda. Escribe el nombre de quien debe.”
4. **Demo:** “Es una simulación. No es dinero real y no se entrega.”
5. **Cambio:** “No es un pago; es lo que devuelves.”

Sin párrafos, sin “proveedor”, sin “idempotencia”.

### 8.3 Dónde ponerla

- **Caja:** un “?” junto a “Total de la venta” o un `<details>` “¿Cómo funciona?” debajo de los métodos. No en el pie.
- **Ventas:** una leyenda de tres líneas sobre la lista: “Pagado = dinero cobrado. Pendiente y fiado = todavía no es dinero recibido. Demo = simulación.”
- **Voz:** si la Caja clásica sigue siendo la opción, un enlace “¿Prefieres dictar? Abre la Caja clásica” junto a “Agregar producto”, no en el pie. Si no, quitar el pie.
- **Ayuda/Ajustes:** hoy `nav.ts:49-62` manda a `/?ayuda=1`, la app legacy. Desde `/caja`, pedir ayuda te saca de la pantalla nueva. Propuesta: una hoja local de ayuda corta, o al menos el enlace rotulado “Ayuda (Caja clásica)”. **P1 de continuidad.**

### 8.4 Banners de recuperación

- **Borrador:** “Recuperamos una venta sin confirmar.” está bien; añadir “Guardada en este dispositivo.” y “Seguir con esta venta” / “Descartar y empezar otra”. Hoy “Seguir” es ambiguo.
- **Cobro pendiente:** hoy `caja-screen.tsx:111-143` recupera un pedido pendiente y salta a pago/resultado **sin avisar**. La persona ve un pedido viejo como si fuera nuevo. Propuesta: “Retomamos un cobro pendiente del folio AA09.” + “Seguir cobrando” / “Empezar otra venta”. **P1.**
- **Resultado:** el panel de resultado no tiene `role="status"` ni `aria-live` y no mueve el foco (`sale-result.tsx:56`). Al confirmar, la persona con lector de pantalla puede quedarse sin anuncio. Propuesta: `role="status"`, `aria-live="polite"`, `tabIndex={-1}` en el título y foco al aparecer. Lo mismo cuando el polling cambia a “Pagado” en `payment-panel.tsx`. **P1 de accesibilidad/confianza.**

---

## 9 · Criterios de aceptación de claridad

### 9.1 Contenido y estados (QA estático, pasa/no pasa)

| ID | Criterio | Cómo se comprueba |
|---|---|---|
| AC-01 | Cero mensajes crudos en inglés o de desarrollador en la UI: `Failed to fetch`, `Load failed`, `NetworkError`, `Unexpected token`, `request_id`, `num_ref`, `proveedor`, `misma base`. | `rg` sobre strings de UI y revisión de los estados de error. |
| AC-02 | Todo CTA primario deshabilitado tiene una razón visible y una salida en el mismo viewport. | Recorrido manual de 8 estados: efectivo vacío, efectivo insuficiente, fiado sin nombre, fiado > total, fiado < total, producto vacío, cantidad 0, precio 0. |
| AC-03 | Todo importe tiene rótulo: total, recibido, aplicado, cambio, pendiente, fiado o demo. Ningún número grande sin etiqueta. | Inventario de `CurrencyAmount` en `/caja` y `/ventas`. |
| AC-04 | Verde solo en “verificado por pey” / “pagado digital”. Cero verde en fiado, demo, cambio, pendiente o chip de total. | Revisión visual + búsqueda de `--color-green` en las clases de estado. |
| AC-05 | Demo está rotulado en página, fila y resultado. Cero “Pagado/Cobrado” sobre demo. | Datos demo + capturas; comparar `demoCashCents` contra filas. |
| AC-06 | En mixto efectivo + fiado o efectivo + digital, la copy muestra el efectivo recibido y el saldo pendiente por separado; no dice “no es dinero recibido” cuando `paidCents > 0`. | Prueba de los dos casos con datos. |
| AC-07 | “Por cobrar” dice su alcance (hoy o acumulado) y si excluye fiado. Las filas pendientes muestran cuánto falta. | Revisión de copy + prueba con un pendiente parcial. |
| AC-08 | Entradas ambiguas (`1/2`, `1 1/2`, `2,5`, `1,000`, `1,234.50`) se interpretan correctamente o muestran error; cero reinterpretación silenciosa. | Tests unitarios del parser + prueba manual. |
| AC-09 | `/ventas?page=99` no dice “no hay ventas”; muestra “no hay ventas en esta página” y una salida. | Prueba de paginación fuera de rango. |
| AC-10 | La venta se completa sin micrófono y sin IA; la alternativa de voz, si existe, está a un clic del alta o no se promete. | Prueba manual + `rg` de `/api/voice`. |
| AC-11 | Al confirmar, el foco va al título del resultado y el lector anuncia “Venta registrada”. Al pasar a pagado por polling, se anuncia “Pagado”. | TalkBack/VoiceOver + teclado. |
| AC-12 | Un solo nombre por objeto: producto, venta, cobro, fiado, cambio. Cero “concepto” en el flujo principal, cero “Sin método”, cero “Demo pagado”. | Revisión de copy deck + `rg`. |

### 9.2 Tareas humanas (pasa/no pasa)

| ID | Criterio | Meta |
|---|---|---|
| HC-01 | Venta en efectivo con cambio: completar y explicar “recibí X, se aplicaron Y, cambio Z”. | 6/6; 0 errores de cambio |
| HC-02 | Fiado con nombre: completar y decir “es deuda, no dinero recibido”. | 6/6; 0 dicen “cobrado” |
| HC-03 | Cobro digital pendiente: generar link/QR y decir “todavía no está pagado”. | 6/6; 0 entregan como pagado |
| HC-04 | Demo: identificar que es simulación y que no se entrega. | 6/6; 0 dicen “dinero real” |
| HC-05 | Error de red simulado: reintentar sin duplicar y decir si la venta se guardó o si no se sabe. | 6/6; 0 ventas duplicadas |
| HC-06 | Historial: encontrar una venta y decir estado, importe, método y saldo pendiente. | 6/6 |
| HC-07 | Explicar la diferencia entre “Vendido hoy”, “Cobrado”, “Por cobrar” y “Fiado”. | 6/6; 0 los suman como si fueran lo mismo |
| HC-08 | 320 px y 200% de texto: completar una venta sin scroll horizontal y sin etiquetas esenciales cortadas. | 6/6; 0 overflow |
| HC-09 | Primera vez sin facilitador: completar las tareas 1–6 con la ayuda que ofrece la pantalla. | ≥5/6; 0 errores críticos de dinero |
| HC-10 | Recargar después de una venta y buscarla en Ventas: decir qué cambio se dio o que no se guardó. | 6/6; 0 falsa confianza |

**Errores críticos de dinero** (cualquiera invalida la prueba): dar cambio incorrecto, registrar un fiado sin nombre, marcar un pendiente como pagado, entregar por un demo, duplicar una venta después de un error, sumar fiado o demo a “cobrado”.

---

## 10 · Pruebas humanas que faltan

No se hizo ninguna. Esta es la lista mínima antes de decir que `/caja` y `/ventas` son claras.

### 10.1 Participantes

- 6–8 comerciantes por ronda, 2 rondas: abarrotes, fonda, tianguis, papelería.
- Mezcla de edad, escolaridad y experiencia digital; incluir al menos una persona con baja visión y una que use lector de pantalla.
- Remunerar cuando corresponda; no pedir datos reales innecesarios; consentimiento para grabar.

### 10.2 Tareas (sin capacitación previa)

1. Vender dos productos y cobrar en efectivo exacto.
2. Vender con efectivo y cambio (dar $100 por $70).
3. Intentar cobrar con $50 por una venta de $90 y explicar qué haría.
4. Anotar un fiado con nombre.
5. Intentar fiado sin nombre y con monto mayor al total.
6. Generar un cobro digital y explicar si ya está pagado.
7. Simular un pago demo y decir si es dinero real.
8. Interrumpir la venta, recargar y retomarla.
9. Simular un error de red y reintentar; comprobar si se duplicó.
10. Buscar una venta en `/ventas`, leer estado, importe, método y saldo; probar página 2 y página 99.
11. Explicar “Vendido hoy”, “Cobrado”, “Por cobrar” y “Fiado”.
12. Repetir 1, 4 y 6 en 320 px y con 200% de texto.

### 10.3 Preguntas post-tarea

- “¿Cuánto dinero entró en esta venta?”
- “¿Cuánto te deben?”
- “¿Puedes entregar el producto?”
- “¿Qué significa este estado?”
- “¿Qué harías si el banco no confirma?”
- “¿Dónde está el cambio?”
- “¿Qué crees que pasó cuando falló la red?”
- “¿Qué parte de la pantalla te ayudó y qué parte te estorbó?”

### 10.4 Medidas

- Tarea completada sí/no, sin ayuda.
- Errores críticos de dinero.
- Tiempo por operación (comparado con libreta/calculadora).
- Ayuda solicitada y dónde la buscó.
- NASA-TLX breve al final.
- Citas textuales de confusión.
- No declarar significación estadística ni “reducción de estrés” con esta muestra.

### 10.5 Condiciones y dispositivos

- Android Chrome y iPhone Safari, teléfono físico.
- 320×640, 390×844, 1366×768, 1448×1086.
- 200% de texto, alto contraste, teclado, TalkBack/VoiceOver.
- Red lenta, offline y 502 simulado.
- Demo con una persona que no sepa que es demo: ¿lo descubre por la pantalla?

### 10.6 Evidencia a guardar

- Video o audio con consentimiento.
- Tabla de tareas con resultado y errores.
- Notas de observación (dónde miró, qué leyó, qué ignoró).
- Capturas de los estados problemáticos.
- Un JSON de resultados por participante, sin datos personales.
- Veredicto: `PASS`, `PASS con reservas` o `NO-GO`; los casos no ejecutados se reportan `NOT RUN`, no `PASS`.

---

## 11 · Prioridad recomendada

| Prioridad | IDs | Qué corregir | Tipo |
|---|---|---|---|
| **P0** | E-01, E-03, E-04, E-16 | Explicar por qué el CTA está deshabilitado y dar salida en efectivo vacío, fiado sin nombre y fiado > total; no rotular como “Generar cobro” un CTA de efectivo incompleto. | Copy + estado |
| **P0** | §6.1 (efectivo con cambio) | Distinguir “recibido”, “aplicado” y “cambio”; no mostrar “Efectivo recibido $70 / Cambio $30”. | Copy + estado |
| **P0** | §6.1 (mixto) | No negar el efectivo recibido en una venta con fiado o digital pendiente. | Copy |
| **P0** | V-02, V-04 | Resolver la contradicción demo: “Pagado/Cobrado” en fila vs “Cobrado confirmado $0.00”. | Copy + datos/visual |
| **P0** | V-03, V-06 | Decir el alcance de “Por cobrar” (global, sin fiado) y mostrar el saldo pendiente en la fila. | Copy + datos |
| **P0** | E-09, E-10 | Copy de red incierta + “Reintentar” + advertencia de edición. | Copy + estado |
| **P0** | E-08 | Parser: `1/2`, `2,5`, `1,000`, `1,234.50`; no reinterpretar en silencio. | Validación |
| **P0** | §6.4 | Verde solo para verificado; sacar verde de fiado, demo, cambio y chip de total. | Visual |
| P1 | C-01, C-02, C-03, C-04, C-07 | Quitar “sin IA”; un solo CTA; H1 por estado; voz descubrible; foco después de agregar. | Copy + UX |
| P1 | E-02, E-05, E-06, E-07, E-13, E-15 | Mensajes de faltante, fiado incompleto, total cambiado, producto vacío, 409 y link/QR. | Copy + estado |
| P1 | §6.1 (link/QR) | “Copiar link” visible, “link de prueba” en demo, no mostrar localhost como link compartible, “se actualiza solo”. | Copy + UX |
| P1 | V-05, V-07, V-08, V-09, V-10 | Método real, “Parcial” vs “Fiado + efectivo”, vocabulario único, vacío de página, nota final. | Copy + datos |
| P1 | §8.4 | Aviso de cobro pendiente recuperado + foco/anuncio del resultado. | Copy + accesibilidad |
| P1 | §8.3 | Ayuda/Ajustes no debe sacar a la app legacy sin avisar. | Copy/IA |
| P2 | C-06, C-08, C-09, C-10 | “Descartar”, columnas, Enter/foco, alta móvil. | Copy + UX |
| P2 | V-11, V-12, V-13, V-14 | Primer viewport en 320, folio, enlace a Fiados, estado de error de carga. | Copy + composición |

---

## 12 · Copy listo para usar (resumen)

**Términos**

- Producto, productos (no “concepto” en el flujo principal).
- Venta, folio (no “pedido” en la lista de ventas).
- Total de la venta.
- Efectivo recibido (input), efectivo aplicado (resultado), cambio a devolver.
- Fiado pendiente (no “saldo vivo”).
- Por cobrar (digital pendiente), esperando al banco (link/QR generado).
- Pagado en efectivo, pagado · verificado, demo (simulado), entregado.
- Cobrado = dinero recibido. No usar para fiado, pendiente ni demo.

**Caja**

- “Agrega lo que vendiste, revisa el total y elige cómo te pagan.”
- “Aún no hay productos. Escribe lo que vendiste. No necesitas inventario.”
- “Para medio kilo, usa 0.5.”
- “Escribe lo que te dieron. El cambio se calcula solo.”
- “Faltan $40.00 para completar el cobro. Escribe más efectivo o elige Digital, Fiado o Combinar.”
- “Escribe el nombre de quien queda a deber para registrar el fiado.”
- “El fiado no puede ser mayor que el total ($100.00).”
- “El fiado no cubre el total. Faltan $20.00; elige Combinar.”
- “Cambio a devolver $10.00. Recibiste $100.00; se aplicaron $90.00.”
- “No sabemos si la venta quedó registrada. Revisa tu conexión y toca Reintentar.”
- “No cambies los datos para no duplicar. Si tienes que cambiarlos, revisa Ventas primero.”

**Resultado**

- “Cobraste $90.00 en efectivo.” / “Recibiste $90.00.”
- “Cobraste $60.00 y quedaron $30.00 a fiado.” / “Fiado pendiente $30.00 · Juan.”
- “Quedó a fiado con Juan.” / “No recibiste dinero. Juan debe $100.00.”
- “Pago demo (simulado). No entregues el producto por este pago.”
- “Pago verificado por pey. El banco confirmó el pago. Ya puedes entregar.”
- “Pago parcial: ya recibiste $60.00; faltan $30.00 digitales.”

**Ventas**

- “Vendido hoy” / “Todo lo registrado hoy, cobrado o no.”
- “Cobrado hoy” / “Efectivo y pagos verificados. No incluye demo ni fiado.”
- “Por cobrar digital” / “Links y QR de todos los días. No incluye fiado.”
- “Falta $30.00 por cobrar.”
- “Fiado pendiente $30.00 de $100.00.”
- “Ver detalle.”
- “No hay ventas en esta página. Vuelve a la primera.”
- “Pagado = dinero cobrado. Pendiente y fiado = todavía no es dinero recibido. Demo = simulación.”

**Ayuda**

- “Total de la venta no es dinero recibido. Efectivo se registra; digital lo confirma el banco; fiado es deuda.”
- “¿Prefieres dictar? Abre la Caja clásica.”

---

## 13 · Archivos y líneas citadas

| Archivo | Líneas / uso |
|---|---|
| `web/src/components/caja/caja-screen.tsx` | 205-241 validación; 358-365 `canConfirm`; 393 subtítulo; 394-409 chip; 413-425 borrador; 500-510 pie |
| `web/src/components/caja/sale-line-items.tsx` | 28-52 alta; 66-70 vacío; 128-132 error de línea |
| `web/src/components/caja/sale-summary.tsx` | 54-63 CTA; 109-121 cambio; 123-146 fiado; 148-160 digital; 179-195 alerta |
| `web/src/components/caja/sale-result.tsx` | 20-53 títulos/notas; 62 importe; 65-112 hechos; 114-125 banners; 127-141 acciones; 146-164 estados |
| `web/src/components/caja/payment-panel.tsx` | 31-32 saldo; 139-155 panel; 157-179 link/QR; 181-213 acciones; 215-230 demo; 238-244 nota; 249-266 estados |
| `web/src/components/caja/types.ts` | 17-32 parsers |
| `web/src/components/caja/caja.css` | 22-42 chip verde; 398-415 cambio verde; 678-687 icono verde |
| `web/src/app/ventas/page.tsx` | 66-76 encabezado; 78-96 tarjetas; 98-101 vacío; 103-109 lista; 111-158 filas; 159-172 detalle; 178-195 paginación; 199-203 nota; 208-235 estados/método |
| `web/src/lib/db.ts` | 1354-1357 efectivo demo; 1475-1487 `pendingCentsTotal` global; 1816-1830 buckets demo |
| `web/src/lib/payment-labels.ts` | 6, 48-51 verdad demo |
| `web/src/components/shell/nav.ts` | 49-62 Ayuda/Ajustes a legacy |
| `web/src/app/inicio/page.tsx` | 103-137 mismas tarjetas y “sin sumarlo a la caja” |
| `quality-reports/oleada-b/capturas/oleada-b-smoke.json` | 33/33 PASS mecánicos |
| `quality-reports/oleada-b/a11y.json` | axe 0; `under44: []` en los viewports medidos (la casa pide 48, no 44) |
| `quality-reports/oleada-b/capturas/*.png` | contradicciones visuales citadas |

---

## 14 · Límites de este documento

- No ejecuté la app ni el smoke; no hay evidencia runtime nueva.
- No hice pruebas con personas, lector de pantalla, teléfono físico, red real ni modo demo real.
- Las capturas pueden ser anteriores al código; la contradicción del chip `$0.00/COBRAR` en el resultado es un ejemplo. Las demás contradicciones citadas (efectivo recibido/aplicado, demo pagado, “Sin método”, “Por cobrar” global) están respaldadas por código actual, no solo por captura.
- No certifico WCAG; la accesibilidad automatizada no prueba comprensión.
- No modifiqué código, datos ni configuración; no hice commits.
- Las recomendaciones de copy no cambian contratos de dinero. Los cambios de parser, persistencia del cambio y etiquetado demo requieren implementación y pruebas propias.
