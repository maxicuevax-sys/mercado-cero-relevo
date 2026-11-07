# 07 — Onboarding y ayuda: revisión adversarial de Oleada B

> **Rol:** `mc-onboarding-ayuda` (subagente independiente)
> **Repo:** `mercado-cero` · **HEAD:** `4130e71` (`docs: cierre formal local de Oleada B`)
> **Fecha:** 2026-11-04 · **Servidor:** `http://localhost:3100` · **buildSha:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02`
> **Modo:** demo (`DEMO_MODE=true`) · **Navegador:** Chromium headless, 1448×1086 / 390×844 / 320×640
> **Restricción cumplida:** no se editó código de producto ni se hizo commit. `git status` solo muestra `?? quality-reports/oleada-b-review/`.

## Veredicto

**Se puede vender sin micrófono y sin IA.** El flujo manual de efectivo simple funciona: 3 datos obligatorios, 2 clics de avance y un resultado claro. No hay llamadas a voz/IA en `/caja` ni en `/ventas`; las únicas menciones son el estado vacío (“No necesitas inventario ni micrófono”) y el pie que ofrece la Caja clásica para dictar.

**Pero Oleada B no puede declarar que “cobrar es claro” en todos los métodos.**

- **Efectivo simple: PASS con reservas.** Total, recibido, aplicado y cambio se muestran correctamente.
- **Mixto efectivo + digital: FAIL (P0).** La pantalla de cobro y `/ventas` borran los $60 que el cliente ya entregó y dejan ver solo los $40 pendientes.
- **Fiado puro: PASS con una frase falsa (P1).** El resultado dice que “el efectivo sí se registró en la caja” aunque no hubo efectivo.
- **Digital pendiente: PASS con callejón sin salida (P1).** No hay “Nueva venta” ni “Descartar cobro”; al volver a `/caja` se reanuda el pendiente sin avisar.
- **Ayuda y navegación: FAIL de continuidad (P1).** “Ayuda” y cuatro módulos de la nav abandonan la Caja nueva y abren la app legacy con voz/IA.
- **Móvil 320/390: PASS con fricción alta (P1).** La primera acción queda debajo del pliegue o tapada por la barra inferior.

**Recomendación de gate:** no cerrar onboarding B como “claro” hasta resolver **O-01 (P0)** y los P1 de fiado, digital, ayuda, nav y móvil. El efectivo simple puede mostrarse a una persona primeriza hoy, con acompañamiento.

> **Nota de alcance:** el verificador previo de Oleada B declaró “P0 de producto: ninguno”. Este P0 no es de contrato de pago ni de persistencia: es de **verdad visible y copy** en el caso mixto efectivo+digital. El dinero se guarda bien; lo que se pierde es la explicación de que $60 ya entraron.

| Severidad | Cantidad | IDs |
|---|---:|---|
| **P0** | 1 | O-01 |
| **P1** | 9 | O-02 a O-10 |
| **P2** | 20 | O-11 a O-30 |
| **P3** | 8 | lista al final de la sección 3 |

---

## 1. Método, alcance y qué cambió respecto al documento previo

Se recorrieron `/inicio`, `/caja`, `/ventas`, `/?ayuda=1` y los alias `/fiados`, `/corte`, `/metas` y `/pendientes`. Se hicieron ventas demo de efectivo, cambio, fiado, digital, mixto efectivo+fiado y mixto efectivo+digital. Se midieron controles, orden de tabulación, posiciones en 320/390 y textos exactos.

El documento previo `quality-reports/oleada-b/ONBOARDING_AYUDA.md` sirve como lista de intención, pero **no todas sus recomendaciones están aplicadas**. Lo que sí quedó resuelto en este HEAD:

| Antes | Ahora |
|---|---|
| “Efectivo recibido $70 + cambio $30” no cuadraba | Se muestra “Recibiste $100.00 / Efectivo aplicado $70.00 / Cambio $30.00” |
| H1 siempre “Nueva venta” | “Nueva venta” / “Cobrar venta” / “Venta registrada” |
| Chip del total en verde de éxito | Chip neutro (`--color-surface-2`) |
| “Limpiar venta” vs “descartar” | “Descartar venta” + confirmación |
| `1,000` y `1,234.50` se reinterpretaban | `1,000` → $1,000.00; `1,234.50` → $1,234.50; `1/2` se rechaza |
| `/ventas?page=99` mostraba “no hay ventas” | La página se limita a la última existente |
| Error de red crudo al confirmar la venta | “No sabemos si la venta quedó registrada… Reintentar venta” |
| “Por cobrar” sin alcance | En `/ventas`: “Por cobrar digital… de todos los días. No incluye fiado.” (Inicio sigue distinto; ver O-11) |

Lo que sigue abierto es lo que se detalla abajo. Los conteos de ventas y los importes de las capturas **no son representativos**: la base demo ya tenía filas de pruebas anteriores y esta auditoría creó ventas de prueba. Se usan solo como ejemplos de estado.

### Límites

- No hubo personas reales, lector de pantalla real, teléfono físico, banco real, pey real, QR real ni micrófono real.
- No se probó `/ventas` con una base vacía: el seed demo siempre inserta historia. El estado vacío se revisó por código.
- No se certifica WCAG. Los hallazgos de foco/teclado son de teclado automatizado y DOM, no de usabilidad humana.
- No se revisaron contratos de pago/seguridad; este informe es de onboarding, copy y verdad visible del dinero.

---

## 2. Recorrido como primerizo: pasos, campos y decisiones

### 2.1 Flujo base (efectivo)

| # | Pantalla | Acción | Campo / control | Decisión | Fricción observada |
|---|---|---|---|---|---|
| 1 | `/inicio` | Toca “Registrar” o “Caja” | CTA / nav | Ninguna | Correcto; el CTA es visible en 320 |
| 2 | `/caja` | Escribe qué vendió | “Producto o servicio” | Ninguna | En 320 el campo queda en `top=627` y no se ve completo |
| 3 | `/caja` | Deja cantidad | “Cantidad” = 1 | Ninguna | Bien precargado |
| 4 | `/caja` | Escribe precio | “Precio unitario” | Ninguna | Bien |
| 5 | `/caja` | Toca “+ Agregar” | Botón | Ninguna | En 390 el botón queda en `y=745–793` y la barra inferior lo tapa |
| 6 | `/caja` | Escribe el efectivo | “Efectivo recibido” | Efectivo exacto o con cambio | El campo está visible; el cambio se calcula solo |
| 7 | `/caja` | Toca “Confirmar venta” | Botón primario | Confirmar | Si falta efectivo, el botón se deshabilita y dice “Faltan $X” |
| 8 | Resultado | Revisa y elige siguiente | “Nueva venta” / “Ver ventas” | Ninguna | Claro en efectivo; “Volver a Caja” es un no-op |

**Conteo del caso más simple:** 3 datos obligatorios (producto, precio, efectivo), 1 campo precargado (cantidad), 1 decisión con valor por defecto (método Efectivo), 2 clics de avance (Agregar, Confirmar) y 1 clic de cierre. **6 interacciones después de entrar a `/caja`.**

**Conteo de la pantalla vacía:** 25 controles visibles: 14 enlaces, 7 botones y 4 inputs. Hay **13 paradas de teclado antes del primer campo** (skip link, logo, 9 destinos de nav, “Ir a Inicio” y chip del total). En escritorio, el panel de cobro completo, con 4 métodos y el campo de efectivo, ya está visible antes de que exista un producto.

### 2.2 Variantes

| Variante | Datos extra | Decisiones extra | Resultado actual |
|---|---|---|---|
| Efectivo exacto | Efectivo recibido | Ninguna | Claro; “Efectivo exacto. No hay cambio.” |
| Efectivo con cambio | Efectivo recibido | Ninguna | Claro; “Recibiste / aplicado / cambio” |
| Fiado puro | Nombre | Método Fiado + nombre | P1: banner falso sobre efectivo |
| Digital | Ninguno | Método Digital; link o QR; copiar/abrir | P1: callejón y copiar oculto |
| Mixto efectivo + fiado | Efectivo, monto fiado, nombre | Método + reparto + nombre | P1: aviso “El total cambió” falso; título demo incorrecto |
| Mixto efectivo + digital | Efectivo | Método + reparto | **P0: no muestra el efectivo recibido** |
| Demo | Ninguno | Simular CoDi/tarjeta | Claro en el resultado; `/ventas` tapa el subestado |
| Error de red | Ninguno | Reintentar | Correcto: “No sabemos… Reintentar venta” |

**Lectura de onboarding:** en efectivo simple la persona puede completar la venta, pero en móvil tiene que descubrir que debe desplazarse para ver el alta y el botón “Agregar”. En digital y mixto aparecen decisiones que la pantalla no explica: link vs QR, “Mixto” vs “Digital”, y quién paga qué parte.

### 2.3 Preguntas que la pantalla no responde en el primer recorrido

1. **“¿Empiezo por el producto o por el efectivo?”** El panel de cobro ya está abierto con $0 y cuatro métodos; el alta está a la izquierda (escritorio) o debajo (móvil).
2. **“¿Qué es un concepto?”** La tabla y el contador usan “concepto”; el alta usa “producto o servicio”; el resultado usa “pedido” y “venta”.
3. **“¿Por qué el botón dice ‘Faltan $20’?”** Es un estado, no una acción; la ayuda está en la línea de arriba, no en el botón.
4. **“¿Ya me pagó o no?”** En mixto efectivo+digital la pantalla dice que el dinero no se recibió, aunque ya recibió $60.
5. **“¿Qué hago con este link?”** El siguiente paso real es copiarlo, pero “Copiar link” está escondido y “Abrir link” parece la acción principal; en demo el link es local.
6. **“¿Esto es dinero real?”** En el resultado demo sí se aclara; en la fila de `/ventas` todo se resume en “DEMO” y se pierde el subestado.
7. **“¿Dónde veo el cambio?”** En el resultado de efectivo sí; al recargar desaparece y `/ventas` no lo muestra.
8. **“¿Y si quiero empezar otra venta?”** En el cobro digital pendiente no hay salida; al volver a `/caja` se reanuda el viejo.
9. **“¿Dónde pido ayuda?”** “Ayuda” abre la Caja legacy con voz/IA, no una ayuda de esta pantalla.

---

## 3. Hallazgos P0–P3

### P0

#### O-01 — Mixto efectivo + digital borra el efectivo ya recibido (Caja y Ventas)

**Evidencia:** `EVIDENCIAS/onboarding-caja-mixto-efectivo-digital-panel.png`, `EVIDENCIAS/onboarding-ventas-fila-AEA7.png`, `EVIDENCIAS/onboarding-probe2.json`, `EVIDENCIAS/onboarding-ventas-filas.txt`.

Caso probado: total $100, efectivo $60, digital $40.

- En `/caja`, después de confirmar, el panel dice:
  > “Falta cobrar **$40.00**”
  > “El pedido ya está registrado. **El dinero aún no se considera recibido**.”
  No aparece “Recibiste $60.00” ni “Efectivo aplicado $60.00”. El chip superior sigue mostrando **$100.00**.
- En `/ventas`, la fila AEA7 dice:
  > `DEMO` · `Pedido AEA7` · `Hoy 11:08 a.m. · Efectivo` · `$100.00` · `Demo, no es dinero real` · `Falta cobrar $40.00`

  No dice “Recibido $60.00”. El pedido tiene `status: "confirmed"`, `paidCents: 6000`, `digitalPaidCents: 0`; no es `payment_pending`. Por eso el badge no lo marca como pendiente y el método se resuelve como “Efectivo”. En modo real, la rama de `paidCents > 0` mostraría “Cobrado $60.00”, pero el método seguiría diciendo “Efectivo” y el estado “Registrado”; la contradicción método/saldo persiste.

**Por qué es P0:** la persona no puede saber si los $60 están en su caja. Puede pensar que el cliente no ha pagado nada, que debe cobrar $100, o que el método fue todo efectivo. Es una contradicción de verdad del dinero en la pantalla principal y en el historial.

**Copy y estado recomendados:**

- Badge: **“Pago parcial”** o **“Por cobrar digital”** (no “Registrado” / “Demo” a secas).
- Caja:
  > **Ya recibiste $60.00 en efectivo.**
  > Falta cobrar **$40.00** en digital.
  > El efectivo ya está en tu caja. El pago digital se confirma con el banco.
- Ventas:
  > **Efectivo + digital**
  > Total $100.00 · **Recibido $60.00 · Falta $40.00**
  > En demo: “Demo · recibido $60.00 · falta $40.00; no es dinero real.”
- Derivar el estado de `total - paid - credit` y del saldo digital, no solo de `status === "payment_pending"`.
- No mostrar “El dinero aún no se considera recibido” cuando `paidCents > 0`; decir “El pago digital aún no se considera recibido”.

**Código:** `web/src/components/caja/payment-panel.tsx:30-31,152-156`; `web/src/app/ventas/page.tsx:128-135,161-183,251-298`; `web/src/components/caja/caja-screen.tsx:312-320`.

---

### P1

#### O-02 — Fiado puro: el banner afirma que se registró efectivo

**Evidencia:** `EVIDENCIAS/onboarding-caja-resultado-fiado.png`, `EVIDENCIAS/onboarding-caja-resultado-fiado.txt`.

En una venta 100% fiada, el resultado muestra:

> “Quedó anotado en Fiado. **Solo el fiado es deuda; el efectivo sí se registró en la caja.**”

No hubo efectivo. El banner es falso en modo real y en demo. Además, la nota dice “**La parte** fiada es deuda”, lo que sugiere que hay otra parte cobrada. Los hechos sí muestran “Saldo vivo fiado $100.00 · Juan”, pero la frase principal contradice el hecho.

**Copy recomendado:**

- Título: **“Quedó a fiado con Juan”**.
- Nota: **“No recibiste dinero. Juan debe $100.00.”**
- Hechos: **“Fiado pendiente $100.00 · Juan”** y **“Recibido $0.00”**.
- Banner: **“Anotado en Fiados. El fiado es deuda; no lo cuentes como dinero recibido.”** (sin mencionar efectivo).
- Si es mixto: **“Cobraste $60.00 y quedaron $40.00 a fiado con Juan.”**

**Código:** `web/src/components/caja/sale-result.tsx:58-62,133-137`.

#### O-03 — Mixto efectivo + fiado en demo se titula “Venta cobrada en efectivo”

**Evidencia:** `EVIDENCIAS/onboarding-caja-mixto-efectivo-fiado-resultado.png`, `EVIDENCIAS/onboarding-probe2.json` (mixtoFiado.post).

Caso: total $100, efectivo $60, fiado $40. El H2 dice:

> **“Venta cobrada en efectivo (demo)”**

Los hechos muestran $60 efectivo y $40 fiado, pero el título se lee como si los $100 fueran efectivo. Es un bug de demo: `isCashDemo = (lastPaymentDemo || demo) && hasCash && !hasDigital` no considera el fiado abierto. En modo real el título sería “Venta registrada con saldo fiado”, correcto.

**Copy recomendado:** **“Cobraste $60.00 y quedaron $40.00 a fiado con Juan (demo)”**. Nunca usar “cobrada en efectivo” si `creditBalanceCents > 0`.

**Código:** `web/src/components/caja/sale-result.tsx:26-34`.

#### O-04 — Aviso falso “El total cambió” en el mixto normal

**Evidencia:** `EVIDENCIAS/onboarding-probe2.json` (mixtoFiado.pre.main).

Con total $100, efectivo $60 y fiado $40, la pantalla muestra:

> “El total cambió. Ajusta el monto a fiado para que coincida con $100.00.”

El total no cambió: el usuario está haciendo un reparto válido. Si sigue el aviso y pone fiado $100, el sistema aplica $0 de efectivo y devuelve $60 como cambio; el reparto deja de ser el que quería.

**Causa:** `creditChanged` compara `creditEnteredCents !== totalCents` sin restar el efectivo aplicado (`sale-summary.tsx:59-63,172-176`).

**Copy recomendado:** eliminar el aviso cuando el reparto es válido, o decir:

> “El fiado cubre $40.00; el resto va en efectivo.”

Solo mostrar “El total cambió” si el total cambió después de que el usuario escribió el fiado, comparando contra `total - efectivo`.

#### O-05 — Cobro digital pendiente: callejón sin salida y reanudación silenciosa

**Evidencia:** `EVIDENCIAS/onboarding-caja-digital-pendiente-con-link.png`, `EVIDENCIAS/onboarding-caja-regreso-con-pendiente.png`, `EVIDENCIAS/onboarding-probe.json`.

En la vista de cobro pendiente las únicas acciones son “Generar link”, “Generar QR”, “Actualizar estado”, “Simular CoDi/tarjeta” (demo) y “Ver historial de ventas”. **No hay “Nueva venta”, “Empezar otra venta” ni “Descartar este cobro”.** Al volver a `/caja`, el `PENDING_KEY` reanuda el último pedido y salta a “Cobrar venta” **sin ningún aviso**. La persona que quería empezar otra venta queda atrapada en la anterior.

**Copy y flujo recomendados:**

- Banner al reanudar: **“Retomamos el cobro pendiente del folio B02A.”**
- Acciones: **“Seguir cobrando”** y **“Empezar otra venta”**; esta última debe pedir confirmación: **“¿Dejar este cobro pendiente? Podrás verlo en Ventas.”**
- En la vista de cobro: **“Dejar pendiente y salir”**.
- Si hay varios pendientes, decir cuántos y dónde están; no reanudar solo el último en silencio.

**Código:** `web/src/components/caja/caja-screen.tsx:114-144,605-628`; `web/src/components/caja/payment-panel.tsx:186-249`.

#### O-06 — El siguiente paso del link está escondido y el link demo es local

**Evidencia:** `EVIDENCIAS/onboarding-caja-digital-pendiente-con-link.png`; `web/src/components/caja/payment-panel.tsx:166-184`.

Después de generar el link, la pantalla muestra:

> “Link de cobro”
> “Abrir link” (enlace visible)
> Un icono de copiar **sin texto visible** (solo `sr-only` “Copiar link”)
> La URL cruda `http://localhost:3100/pay/...`

“Abrir link” es la acción visualmente más clara, pero abre el link en el navegador del comerciante; no lo comparte. “Copiar link” está escondido. En demo, el link apunta a `localhost` y **no dice que no se puede compartir**. El bloque “Modo demo” está separado, debajo.

**Copy y estado recomendados:**

- Título: **“Link de cobro listo”**.
- Primario visible: **“Copiar link”**; secundario: **“Abrir link”**.
- Texto: **“Compártelo con el cliente. El pago se confirma solo.”**
- En demo: **“Link de prueba: solo funciona en este equipo. No lo compartas.”** No mostrar una URL `localhost` como si fuera compartible.
- Si `navigator.clipboard` falla: **“No pudimos copiar el link. Mantén presionado el texto y cópialo a mano.”**

#### O-07 — “Ayuda” y “Ajustes” abandonan la Caja nueva y abren la app de voz

**Evidencia:** `EVIDENCIAS/onboarding-ayuda-desde-caja.png`, `EVIDENCIAS/onboarding-probe2.json` (help).

`nav.ts:49-62` manda “Ayuda” a `/?ayuda=1` y “Ajustes” a `/?ayuda=1#ajustes`. Al tocar “Ayuda” desde `/caja` se abre la Caja legacy:

> “Mercado Cero · La caja que habla”
> “Habla, escribe o agrega a mano; tú confirmas.”
> “La IA interpreta o lo agregas a mano; tú confirmas.”
> “Mantén y habla / Escuchar / Interpretar”

La persona que pedía ayuda para la pantalla nueva termina en otra app, con otra nav (Fiado, Corte, Meta) y una hoja de accesibilidad/voz. **No hay ayuda de la Caja nueva**: no explica link/QR, fiado, demo ni cambio.

**Copy y flujo recomendados:**

- Que “Ayuda” abra una hoja local con 5 puntos:
  1. **Efectivo:** “Escribe lo que te dieron. El cambio se calcula solo.”
  2. **Digital:** “Se crea un link o QR. El banco confirma; una captura no cuenta.”
  3. **Fiado:** “Queda como deuda. Escribe el nombre de quien debe.”
  4. **Demo:** “Es una simulación. No es dinero real y no se entrega.”
  5. **Cambio:** “No es un pago; es lo que devuelves.”
- Si se conserva la Caja clásica para voz/comprobante: **“¿Prefieres dictar o revisar un comprobante? Abre la Caja clásica.”** junto al alta, no en el pie.
- “Ayuda” no debe sacar de `/caja` sin avisar. Si sale, rotular **“Ayuda (Caja clásica)”**.

#### O-08 — La nav promete Fiados/Corte/Metas/Pendientes que no están migrados

**Evidencia:** `EVIDENCIAS/onboarding-probe2.json` (redirects), `EVIDENCIAS/onboarding-inicio-1448.png`.

Los cuatro destinos se ven como pantallas nuevas en el AppShell, pero todos son 307 a la Caja legacy:

| Etiqueta | URL final | H1 real |
|---|---|---|
| Fiados | `/?tab=fiado` | Caja |
| Corte | `/?tab=corte` | Caja |
| Metas | `/?tab=meta` | Caja |
| Pendientes | `/?tab=pendientes` | Caja |

La persona aprende una nav que no se corresponde con lo que recibe. En móvil, “Fiados” es una de las cuatro pestañas principales; es la ruta más fácil para salir sin querer de la Caja nueva.

**Copy y flujo recomendados:** ocultar los no migrados, o marcarlos **“Caja clásica”** y avisar al entrar: **“Fiados todavía vive en la Caja clásica. Te llevamos allí.”** No usar la misma nav visual para dos productos distintos.

#### O-09 — En 320/390 la primera acción queda debajo del pliegue o tapada por la barra

**Evidencia:** `EVIDENCIAS/onboarding-caja-vacia-320.png`, `EVIDENCIAS/onboarding-caja-320-primer-viewport.png`, `EVIDENCIAS/onboarding-caja-390-primer-viewport.png`, `EVIDENCIAS/onboarding-caja-390-alta-oculta.png`, `EVIDENCIAS/onboarding-probe3.json`.

- En 320, el primer campo está en `top=627` con viewport de 640; el alta empieza en `top=549` y no se ve completa. La persona ve “Aún no hay conceptos” y un chip “$0.00 / Ver cobro”, pero no el campo para agregar.
- En 390, el botón “+ Agregar” está en `y=745–793`; la barra inferior lo tapa. Se puede hacer scroll, pero la acción principal no se ve.
- El panel de cobro con $0 y cuatro métodos compite visualmente con el alta antes de que exista una venta.

**Copy y composición recomendados:**

- Poner el alta primero y **no mostrar el panel de cobro completo hasta que haya al menos un producto**.
- Estado vacío: **“Agrega lo que vendiste. No necesitas inventario.”** (sin “micrófono”).
- Asegurar que “+ Agregar” quede por encima de la barra inferior; aumentar `padding-bottom` y/o mover la barra.
- En 320, reducir el estado vacío para que el primer campo se vea sin scroll.

#### O-10 — En `/ventas`, el badge “DEMO” tapa fiado, pendiente y saldado

**Evidencia:** `EVIDENCIAS/onboarding-ventas-fila-9E3D.png`, `EVIDENCIAS/onboarding-ventas-1448.png`, `EVIDENCIAS/onboarding-ventas-1448.txt`; `web/src/app/ventas/page.tsx:128-129,257-258`.

En modo demo, `isDemoOrder = demo || …` hace que **todas** las filas muestren el badge “DEMO”. Una venta a fiado se ve:

> `DEMO` · “Efectivo + fiado · Juan” · “Saldo vivo $40.00”

El método dice fiado, pero el badge no. Una venta pendiente sí dice “DEMO · PENDIENTE”; una fiada no dice “DEMO · FIADO”. En el modo que se usa para enseñar, el estado principal se pierde.

**Copy recomendado:** **“DEMO · FIADO”**, **“DEMO · POR COBRAR”**, **“DEMO · SALDADO”**, **“DEMO · PAGADO”**; o un sello “DEMO” separado y el estado real al lado. No usar “DEMO” como sustituto del estado.

---

### P2

| ID | Hallazgo | Evidencia | Copy / acción recomendada |
|---|---|---|---|
| O-11 | La pantalla vacía muestra el cobro completo antes del producto: 25 controles, 4 métodos y un CTA deshabilitado. | `onboarding-caja-vacia-1448.png`; `onboarding-metricas.json` | Mostrar el alta primero; el cobro aparece cuando hay línea. Si se mantiene, resumir: “Cobro se activa cuando agregues un producto.” |
| O-12 | Después de “Agregar”, el foco va a la línea recién agregada, no al alta. Si la persona escribe el siguiente producto, puede sobrescribir el anterior. No hay `<form>` ni Enter para agregar. | `onboarding-caja-tras-agregar.png`; `onboarding-probe.json` (`focusedAfterAdd`); `sale-line-items.tsx:27-51`; `caja-screen.tsx:486-493` | Enfocar `mc-caja-new-description` después de agregar; anunciar “Agregado. Agrega otro o revisa el cobro.” Añadir `<form>` y Enter. |
| O-13 | “1 conceptos en curso”; además “concepto”, “producto o servicio”, “qué estás vendiendo” y “pedido” nombran lo mismo. | `onboarding-caja-tras-agregar.png`; `caja-screen.tsx:591`; `sale-line-items.tsx:58,61,67,173`; `payment-panel.tsx:144` | Un solo término: **“Producto o servicio”** en el alta; **“Venta”** o **“Folio”** en el resultado; **“Fiado pendiente”**. Corregir singular/plural. |
| O-14 | El botón deshabilitado se rotula “Faltan $20.00”: un estado convertido en acción. | `onboarding-caja-efectivo-insuficiente.png`; `sale-summary.tsx:65-79` | Estado arriba: “Faltan $20.00 para completar el cobro.” Botón: “Completar cobro” o “Confirmar venta” deshabilitado. |
| O-15 | “Mixto” no dice qué combina; “Generar cobro” registra la venta pero el link se genera en otro paso. | `onboarding-caja-vacia-1448.png`; `onboarding-caja-mixto-efectivo-digital-formulario.png`; `sale-summary.tsx:11,74` | “Efectivo + otro” o “Combinar” con helper “Efectivo con digital o fiado”. CTA: “Registrar venta y continuar” o “Crear cobro pendiente”. |
| O-16 | Lenguaje técnico: “Saldo vivo”, “proveedor”, “misma base”, “borradores independientes”, “pey”. | `sale-result.tsx:103`; `payment-panel.tsx:245`; `ventas/page.tsx:189,243`; `caja-screen.tsx:597` | “Fiado pendiente”, “banco”, “lo que vendiste”, “lo que empieces aquí no aparece en la Caja clásica”. |
| O-17 | El borrador recuperado dice “Seguir” y “Empezar de nuevo”; “Empezar de nuevo” descarta sin confirmar. | `onboarding-caja-borrador-recuperado.png`; `caja-screen.tsx:453-478` | “Seguir con esta venta” / “Descartar y empezar otra”; confirmar el descarte. |
| O-18 | El cambio no se persiste: al recargar el resultado, se vuelve a “Nueva venta” y se pierde “Cambio $30.00”. | `onboarding-caja-cambio-antes-recarga.png`; `onboarding-caja-cambio-despues-recarga.png`; `caja-screen.tsx:68,291-298` | Persistir el cambio con el `orderId` o decir: “El cambio no se guarda en el historial.” |
| O-19 | “Volver a Caja” no hace nada: es un `Link` a la misma ruta y conserva el resultado. | Prueba de clic (resultado → mismo H1); `sale-result.tsx:151-153` | Quitarlo o convertirlo en “Nueva venta”. Si se quiere volver, que limpie el resultado. |
| O-20 | “Por cobrar digital” es global, pero está junto a métricas de hoy; el título no dice “acumulado”. | `onboarding-ventas-1448.png`; `ventas/page.tsx:106-109` | “Por cobrar digital (acumulado)” + “Links y QR de todos los días. No incluye fiado.” |
| O-21 | `/ventas`: “Ver conceptos”, “Pedido”, “Saldo vivo”; no hay enlace al fiado de Juan. | `onboarding-ventas-1448.png`; `ventas/page.tsx:149,189,203` | “Ver detalle”, “Venta”/“Folio”, “Fiado pendiente”; añadir “Ver fiado de Juan” en la fila o el detalle. |
| O-22 | En 320/390, `/ventas` muestra solo las tres tarjetas en el primer viewport; ninguna venta. | `onboarding-ventas-320.png`, `onboarding-ventas-390.png`; `onboarding-probe3.json` (`firstRowTop=688`) | Resumen compacto de una línea o lista primero; que la primera venta se vea sin scroll. |
| O-23 | `/ventas` no tiene estado de error de carga (`error.tsx`/copy). | Código; no hay `error.tsx` en `web/src/app` | “No pudimos cargar las ventas. No sabemos si hay ventas. Reintentar.” |
| O-24 | En demo, “Cobrado confirmado $0.00” convive con filas “DEMO”; el título no aclara que es cobrado real. | `onboarding-ventas-1448.png`; `ventas/page.tsx:96-104` | “Cobrado real (demo no cuenta)” y un banner “Todo lo de esta pantalla es demo” si `demo`. |
| O-25 | Cantidad 1000 se convierte en 999 sin aviso; “1/2” solo dice “La cantidad debe ser mayor que cero”. | `onboarding-probe2.json` (parser); `types.ts:50-56` | “Máximo 999” visible; “Para medio kilo, usa 0.5.” |
| O-26 | Si hay varios cobros pendientes, solo se reanuda el último; los demás no se muestran en `/caja` y hay que buscarlos en Pendientes (legacy). | `caja-screen.tsx:114-144`; `PENDING_KEY` | Aviso “Tienes 2 cobros pendientes” + lista; no reanudar en silencio. |
| O-27 | “No necesitas inventario ni micrófono” introduce la voz en un flujo manual. | `sale-line-items.tsx:68` | “Agrega uno a mano. No necesitas inventario.” |
| O-28 | El pie “Caja clásica / borradores independientes” aparece en todas las vistas, incluso resultado y cobro; es jerga y distrae. | `caja-screen.tsx:589-598`; capturas | Moverlo cerca del alta y acortarlo: “¿Prefieres dictar? Abre la Caja clásica.” |
| O-29 | “Ver cobro” (chip), “Revisar cobro” (barra) y “Confirmar venta” (panel) son tres controles para el mismo tramo; los dos primeros solo hacen scroll. | `onboarding-caja-tras-agregar.png`; `caja-screen.tsx:436-443,569-583` | Un solo primario: “Confirmar venta”; el chip puede ser “Total” sin CTA. |
| O-30 | “Ir a ventas +” usa un icono de suma; “Registrar” es vago. | `onboarding-inicio-1448.png`; `inicio/page.tsx:164-169,224-226` | “Registrar venta” y “Ver ventas” con icono de lista/flecha. |

### P3

- “Ver conceptos” → “Ver detalle” / “Ver productos” (`ventas/page.tsx:203`).
- Paginación sin “Mostrando 1–25 de 55” (`ventas/page.tsx:121-123`).
- “Pedido A58F” son 4 caracteres de un id, no un folio memorable (`sale-result.tsx:76-78`; `ventas/page.tsx:149`).
- “Total registrado $X” en el pie del resultado es redundante (`sale-result.tsx:155-158`).
- “Caja” sigue activa en la nav durante el cobro/resultado; no marca el paso (`app-shell`/nav).
- “Meta del mes” y “Pendientes” en Inicio prometen módulos legacy; “Ver todos” va a `/?tab=pendientes` (`inicio/page.tsx:129-151,179`).
- “Fecha larga” en el subtítulo de Caja ocupa una línea sin ayudar a la tarea.
- “Caja clásica” en el pie se lee como una marca, no como una salida; si se conserva, explicar “para dictar o ver comprobantes”.

---

## 4. Verdad del dinero: cobrado, pendiente, demo, fiado y cambio

| Situación | Lo que muestra hoy | Verdad | Riesgo de confusión | Copy recomendado |
|---|---|---|---|---|
| **Efectivo exacto** | “Venta cobrada en efectivo (demo)” / “Total $70” / “Efectivo recibido $70” | Entraron $70 | Bajo; en demo el título aclara | “Cobraste $70.00 en efectivo.” / “Recibiste $70.00.” |
| **Efectivo con cambio** | “Recibiste $100 / Efectivo aplicado $70 / Cambio $30” | Recibió $100, aplicó $70, devuelve $30 | Bajo; “Cambio” sin “a devolver” y no persiste | “Cambio a devolver $30.00.” / “El cambio no es un pago.” |
| **Efectivo + fiado** | En real: “Venta registrada con saldo fiado”; en demo: “Venta cobrada en efectivo (demo)” | Entraron $60; $40 son deuda | **Alto en demo**: el título dice que todo fue efectivo | “Cobraste $60.00 y quedaron $40.00 a fiado con Juan.” |
| **Fiado puro** | “Venta registrada con fiado” / “Saldo vivo fiado $100 · Juan” / banner “el efectivo sí se registró” | No entró dinero; Juan debe $100 | **Alto**: el banner afirma efectivo inexistente | “Quedó a fiado con Juan.” / “No recibiste dinero. Juan debe $100.00.” |
| **Digital pendiente** | “Pedido B02A / REGISTRADO” → “PENDIENTE”; “Falta cobrar $50”; “El dinero aún no se considera recibido” | Venta registrada, pago no recibido | Medio: “Registrado” no dice “por cobrar” | “Por cobrar” / “Esperando al banco”; “La venta está registrada, pero no has recibido el pago.” |
| **Demo digital** | “Pago demo (simulado)” / “Demo (simulado)” / “Esta simulación no es dinero real” | Simulación; no se entrega | Bajo en el resultado; `/ventas` tapa el subestado | “Demo · no es dinero real.” / “No entregues el producto por este pago.” |
| **Verificado por pey** | “Pago confirmado por pey” / “proveedor” | Pago digital real confirmado por webhook | Medio: “proveedor” y “pey” son jerga | “Pagado · verificado por el banco. Ya puedes entregar.” |
| **Parcial efectivo + digital** | “Falta cobrar $40”; sin “Recibido $60”; fila “Efectivo” | Ya entraron $60; faltan $40 digitales | **P0**: niega el efectivo recibido | “Ya recibiste $60.00. Faltan $40.00 digitales.” / “Efectivo + digital · Recibido $60 · Falta $40.” |
| **Cambio** | “Cambio $30” en neutro; no se guarda | Cálculo de presentación, no pago | Medio: al recargar desaparece | “Cambio a devolver $30.00.” / “El cambio no se guarda en la venta.” |

**Reglas de lenguaje recomendadas**

- **“Cobrado” = dinero que ya entró.** No usarlo para fiado, pendiente ni demo.
- **“Pagado” = cubierto.** Si hay fiado abierto, decir “Pagado, con fiado pendiente” o no usar “Pagado” como título.
- **“Verificado” = lo confirmó el banco/pey.** El efectivo no es “verificado”; el demo tampoco.
- **“Demo” nunca lleva “pagado”.** “Pago demo (simulado)” es la etiqueta canónica.
- **“Fiado” siempre con “pendiente” o “deuda”.** No “saldo vivo”.
- **“Cambio” siempre con “a devolver”.** No es un pago ni se suma a la venta.
- **Verde solo para verificado/pagado digital.** El chip del total ya es neutro; mantener esa regla en resultados y filas.

---

## 5. `/ventas`: estados, importes, método, saldo, vacío y paginación

### Lo que funciona

- Encabezado coherente: “Historial / Ventas”; botón “Nueva venta”.
- Tres tarjetas separadas; en demo la primera dice “Incluye ventas demo; no es dinero real” y la segunda “Solo efectivo real y pagos verificados; demo no cuenta”.
- La lista muestra folio corto, fecha, método, cliente, conceptos, total, estado, saldo y “Falta cobrar” cuando aplica.
- `page=99` se limita a la última página; ya no muestra un vacío falso.
- El detalle “Ver conceptos” es un `<details>` accesible por teclado.

### Lo que falla

| Zona | Problema | Evidencia | Copy/acción |
|---|---|---|---|
| Fila de pago parcial | En demo: método “Efectivo”, badge “DEMO”, “Falta cobrar $40”, sin “Recibido $60”. En real: “Cobrado $60” pero método “Efectivo” y estado “Registrado”. | `onboarding-ventas-fila-AEA7.png`; `ventas/page.tsx:161-183,251-298` | Estado “Pago parcial”; método “Efectivo + digital”; “Recibido $60.00 · Falta $40.00” |
| Badge demo | Todas las filas demo pierden fiado/pendiente/saldado | `onboarding-ventas-fila-9E3D.png`; `ventas/page.tsx:128-129,257-258` | “DEMO · FIADO” / “DEMO · POR COBRAR” / “DEMO · SALDADO” |
| Tarjeta “Por cobrar digital” | Es global (todos los días), no de hoy; el título no lo dice | `onboarding-ventas-1448.png`; `ventas/page.tsx:106-109` | “Por cobrar digital (acumulado)” |
| “Cobrado confirmado” en demo | $0.00 junto a filas con importes; el título no dice “real” | `onboarding-ventas-1448.png` | “Cobrado real (demo no cuenta)” |
| “Saldo vivo” | Jerga; no dice “fiado” ni “pendiente” | `ventas/page.tsx:189` | “Fiado pendiente $40.00” |
| “Ver conceptos” | Suena a contabilidad, no a detalle | `ventas/page.tsx:203` | “Ver detalle” |
| “Pedido” | La pantalla se llama Ventas | `ventas/page.tsx:149` | “Venta” o “Folio” |
| Paginación | “N en total · página 1 de 3” sin “Mostrando 1–25” | `ventas/page.tsx:121-123` | “Mostrando 1–25 de N · página 1 de 3” |
| Vacío | Código correcto: “Todavía no hay ventas registradas. Registra la primera desde Caja.” | `ventas/page.tsx:113-116` | Bien; no ejecutado con base vacía |
| Error de carga | No hay `error.tsx` ni copy de recuperación | Código | “No pudimos cargar las ventas. Reintentar.” |
| Móvil | En 320/390 solo se ven las tarjetas; la primera fila está en `top=688` (320) | `onboarding-ventas-320.png`, `onboarding-ventas-390.png`; `onboarding-probe3.json` | Resumen compacto o lista primero |

**Lectura de onboarding de `/ventas`:** la página es honesta con el demo, pero en el modo demo el badge “DEMO” se come el estado que la persona necesita aprender. La fila de pago parcial es la más peligrosa: dice “Efectivo” y “Falta cobrar”, sin decir que ya entraron $60.

---

## 6. Decisiones innecesarias, callejones, lenguaje técnico y promesas

### Decisiones innecesarias

1. **Cuatro métodos de pago antes de tener un producto.** En efectivo la mayoría de los casos no necesita elegir; el panel ya está abierto con $0.
2. **Link o QR.** Son dos acciones equivalentes; la pantalla no dice cuál usar. Un primerizo no sabe si el cliente necesita link o QR.
3. **“Mixto” sin explicar el reparto.** No hay una guía “efectivo + fiado” vs “efectivo + digital”; el aviso falso “El total cambió” empeora.
4. **“Generar cobro” y después “Generar link”.** El primer CTA promete el link, pero solo registra la venta.
5. **“Ver cobro” / “Revisar cobro” / “Confirmar venta”.** Tres controles para un solo tramo; los dos primeros solo hacen scroll.
6. **“Volver a Caja” vs “Nueva venta”.** El primero no hace nada; el segundo es el que la persona necesita.
7. **“Seguir” / “Empezar de nuevo” / “Descartar venta”.** Tres formas de continuar o descartar; “Seguir” no dice qué.
8. **Ayuda y Ajustes** abren la misma hoja legacy; no son dos destinos.

### Callejones sin salida

- **Cobro digital pendiente:** no hay “Nueva venta” ni “Descartar”; al volver a `/caja` se reanuda el mismo pendiente sin aviso.
- **Ayuda:** sale a la Caja legacy; para volver hay que usar el historial del navegador.
- **Nav:** Fiados/Corte/Metas/Pendientes salen a la Caja legacy sin aviso.
- **“Volver a Caja”:** no-op; la persona sigue en el resultado.
- **Cambio:** al recargar, el recordatorio desaparece; no hay forma de consultarlo en `/ventas`.
- **Fiado:** el resultado dice “Quedó anotado en Fiado” pero no hay “Ver fiado de Juan”; hay que ir a la nav legacy.
- **Error de carga de `/ventas`:** no hay estado de recuperación; si la DB falla, no hay copy.

### Lenguaje técnico

| Hoy | Recomendado |
|---|---|
| Concepto | Producto o servicio |
| Pedido | Venta / Folio |
| Saldo vivo | Fiado pendiente |
| Proveedor / pey | Banco / pago verificado |
| La misma base que Caja | “Lo que vendiste y cómo se cobró” (sin implementación) |
| Borradores de cada pantalla son independientes | “Lo que empieces aquí no aparece en la Caja clásica.” |
| Verificar un comprobante | “Revisar un comprobante” |
| Idempotencia / request_id (si aparece) | “Esta venta ya se había registrado…” |

### Promesas de módulos no migrados

- `Fiados`, `Corte`, `Metas`, `Pendientes` en la nav.
- `Ver todos` de Pendientes en Inicio (`/?tab=pendientes`).
- `Ayuda` y `Ajustes` (`/?ayuda=1`).
- `Meta del mes` como KPI de un módulo que sigue en legacy.
- `Caja clásica` en el pie: es honesto, pero conviene nombrarlo como salida y no como parte del flujo.

---

## 7. Copy recomendado (listo para usar)

### Caja

- “Agrega lo que vendiste, revisa el total y elige cómo te pagan.” (actual, bien)
- “Aún no hay productos. Agrega uno a mano. No necesitas inventario.” (quitar “micrófono”)
- “Para medio kilo, usa 0.5.”
- “Escribe el efectivo que te dieron o elige otro método.”
- “Faltan $40.00 para completar el cobro. Escribe más efectivo o elige Digital, Fiado o Mixto.”
- “Escribe el nombre de quien queda a deber para registrar el fiado.”
- “El fiado no puede ser mayor que el total ($100.00).”
- “El fiado no cubre el total. Faltan $20.00; elige Combinar.”
- “Cambio a devolver $10.00. Recibiste $100.00; se aplicaron $90.00.”
- “No sabemos si la venta quedó registrada. Revisa tu conexión y toca Reintentar.”
- “No cambies los datos para no duplicar. Si tienes que cambiarlos, revisa Ventas primero.”
- “Efectivo + otro” / “Combinar” en lugar de “Mixto”.

### Resultado

- “Cobraste $90.00 en efectivo.” / “Recibiste $90.00.”
- “Cobraste $60.00 y quedaron $30.00 a fiado con Juan.”
- “Quedó a fiado con Juan.” / “No recibiste dinero. Juan debe $100.00.”
- “Pago demo (simulado). No entregues el producto por este pago.”
- “Pago verificado por el banco. Ya puedes entregar.”
- “Pago parcial: ya recibiste $60.00; faltan $30.00 digitales.”
- “El cambio no se guarda en el historial.”

### Digital pendiente

- “Por cobrar” antes del link; “Esperando al banco” después.
- “La venta está registrada, pero no has recibido el pago.”
- “Crear link de cobro” / “Mostrar QR”.
- “Link de cobro listo.” / “Copiar link” (visible) / “Abrir link” (secundario).
- “Compártelo con el cliente. El pago se confirma solo.”
- “Link de prueba: solo funciona en este equipo. No lo compartas.”
- “Dejar pendiente y salir” / “Empezar otra venta”.

### Ventas

- “Lo que vendiste y cómo se cobró.”
- “Vendido hoy” / “Todo lo registrado hoy, cobrado o no.”
- “Cobrado real” / “Efectivo y pagos verificados. Demo no cuenta.”
- “Por cobrar digital (acumulado)” / “Links y QR de todos los días. No incluye fiado.”
- “Recibido $60.00 · Falta $40.00.”
- “Fiado pendiente $40.00 de $100.00.”
- “Ver detalle.”
- “Mostrando 1–25 de N · página 1 de 3.”
- “Pagado = dinero cobrado. Pendiente y fiado = todavía no es dinero recibido. Demo = simulación.”
- “No pudimos cargar las ventas. Reintentar.”

### Ayuda

- “Total de la venta no es dinero recibido. Efectivo se registra; digital lo confirma el banco; fiado es deuda.”
- “¿Prefieres dictar? Abre la Caja clásica.” (cerca del alta, no en el pie)

### Navegación

- “Fiados (Caja clásica)”, “Corte (Caja clásica)”, “Metas (Caja clásica)”, “Pendientes (Caja clásica)” o simplemente ocultarlos.
- “Ayuda” debe abrir la hoja local; “Ajustes (Caja clásica)” si se conserva.

---

## 8. Criterios de aceptación de onboarding

| ID | Criterio | Cómo se comprueba |
|---|---|---|
| AC-01 | Una persona completa una venta en efectivo exacto sin ayuda y sin micrófono/IA. | 5/5 personas; 0 errores de dinero |
| AC-02 | Una persona con cambio dice “recibí X, se aplicaron Y, devuelvo Z”. | 5/5; 0 cambios incorrectos |
| AC-03 | En mixto efectivo+digital, la pantalla muestra “recibido” y “falta” por separado; 0 personas dicen “no me pagó nada”. | 5/5; revisar Caja y Ventas |
| AC-04 | En fiado puro, 0 personas dicen “me pagó” o “se registró efectivo”; el resultado dice “No recibiste dinero”. | 5/5; revisar banner |
| AC-05 | En demo, 0 personas creen que el dinero es real o que pueden entregar. | 5/5; resultado y fila |
| AC-06 | En digital pendiente, la persona encuentra “Copiar link” sin abrir el link y sabe que el pago no está confirmado. | 5/5; 0 comparten `localhost` |
| AC-07 | La persona puede empezar otra venta desde un cobro pendiente sin borrar datos ni recargar. | 5/5; botón visible |
| AC-08 | “Ayuda” abre una ayuda de la Caja nueva; si abre la clásica, lo dice antes. | 5/5; 0 personas salen sin saber |
| AC-09 | Fiados/Corte/Metas/Pendientes están ocultos o marcados “Caja clásica”; 0 personas creen que son pantallas nuevas. | 5/5 |
| AC-10 | En 320 y 390, el primer campo y “Agregar” se ven sin scroll y no quedan tapados por la barra. | 5/5; capturas y medición |
| AC-11 | En `/ventas`, una fila parcial muestra “Recibido” y “Falta”, no solo “Efectivo” y “Falta”. | 5/5; 0 personas suman el total como cobrado |
| AC-12 | No hay “concepto”, “pedido”, “saldo vivo”, “proveedor”, “Sin método” ni “Demo pagado” en el flujo principal. | `rg` + revisión de copy |
| AC-13 | Todo error de red dice si la venta se guardó o no, y ofrece “Reintentar” sin duplicar. | 5/5; prueba con POST abortado |
| AC-14 | Al confirmar, el foco va al título del resultado y el lector anuncia el estado; al pasar a pagado por polling, se anuncia. | TalkBack/VoiceOver; no ejecutado aquí |
| AC-15 | `/ventas?page=99` no muestra “no hay ventas”; página vacía real tiene copy y salida. | Prueba con página fuera de rango y base vacía |

**Errores críticos de dinero** que invalidan la prueba: dar cambio incorrecto, decir que un fiado es cobrado, decir que un demo es real, no ver el efectivo ya recibido en un mixto, duplicar una venta tras un error.

---

## 9. Evidencia

Todo en `quality-reports/oleada-b-review/EVIDENCIAS/`:

| Archivo | Qué muestra |
|---|---|
| `onboarding-probe.json` | Inventario de la Caja vacía, foco tras agregar, tab order, resultado efectivo/fiado, digital, ayuda |
| `onboarding-probe2.json` | Mixto efectivo+digital, mixto efectivo+fiado, borrador, paginación, ayuda, redirects, demo, parser |
| `onboarding-probe3.json` | Inicio, posiciones 320/390, primera fila de Ventas en 320 |
| `onboarding-probe4.json` | Error de red, reintento, medida del alta en 390 |
| `onboarding-probe5.json` | Cambio antes/después de recargar |
| `onboarding-tab-order.json` | 13 paradas antes del primer campo |
| `onboarding-metricas.json` | Resumen numérico de pasos, controles y viewports |
| `onboarding-copy-hallazgos.txt` | Textos exactos y referencias de código |
| `onboarding-entorno.txt` | HEAD, branch, `git status` limpio de producto y `buildSha` del servidor |
| `onboarding-caja-vacia-1448.png` | Panel de cobro completo antes del producto |
| `onboarding-caja-tras-agregar.png` | Foco en la línea agregada, “1 conceptos”, “Faltan $70” |
| `onboarding-caja-efectivo-insuficiente.png` | “Faltan $20” y CTA deshabilitado |
| `onboarding-caja-efectivo-cambio.png` | Recibiste/aplicado/cambio |
| `onboarding-caja-resultado-efectivo.png` | Resultado de efectivo con cambio |
| `onboarding-caja-resultado-fiado.png` | Banner falso “el efectivo sí se registró” |
| `onboarding-caja-digital-pendiente-sin-link.png` | “REGISTRADO” y falta cobrar |
| `onboarding-caja-digital-pendiente-con-link.png` | Link local, copiar oculto, sin “Nueva venta” |
| `onboarding-caja-regreso-con-pendiente.png` | Reanudación silenciosa del pendiente |
| `onboarding-caja-mixto-efectivo-digital-panel.png` | P0: “El dinero aún no se considera recibido” tras $60 |
| `onboarding-caja-mixto-efectivo-fiado-resultado.png` | P1: “Venta cobrada en efectivo (demo)” con $40 fiado |
| `onboarding-caja-resultado-demo.png` | Demo correcto: “Pago demo (simulado)” |
| `onboarding-caja-error-red.png` | Error incierto + “Reintentar venta” |
| `onboarding-caja-cambio-antes-recarga.png` / `-despues-recarga.png` | El cambio se pierde al recargar |
| `onboarding-caja-vacia-320.png`, `onboarding-caja-320-primer-viewport.png`, `onboarding-caja-320-scroll-alta.png` | Primer campo/alta en 320 |
| `onboarding-caja-390-primer-viewport.png`, `onboarding-caja-390-alta-oculta.png` | “Agregar” tapado por la barra |
| `onboarding-ventas-1448.png`, `-390.png`, `-320.png` | Ventas escritorio/móvil; primer viewport |
| `onboarding-ventas-pagina-2.png` | Paginación |
| `onboarding-ventas-fila-AEA7.png` | P0: “Efectivo” + “Falta $40” sin “Recibido $60” |
| `onboarding-ventas-fila-9E3D.png` | Demo + fiado sin badge de fiado |
| `onboarding-inicio-1448.png`, `-320.png` | Inicio; CTA y “Por cobrar” |
| `onboarding-ayuda-desde-caja.png` | Ayuda legacy con voz/IA |

Scripts reproducibles: `onboarding_probe*.py`, `onboarding_ventas_row.py` (en la misma carpeta). Corren contra `http://localhost:3100` en modo demo y crean ventas de prueba.

---

## 10. Límites y siguiente paso

- **No se modificó producto.** No hay commit; el único cambio es la carpeta de revisión sin trackear.
- **No hubo prueba humana.** Este informe no puede afirmar “6/6” ni “0 errores” de personas; solo propone el protocolo y documenta el recorrido del auditor.
- **No se probó pey real, QR real, lector de pantalla, iOS/Safari, teclado virtual ni base vacía.**
- **La base demo estaba contaminada** con filas de pruebas previas; los totales de las capturas no representan el producto.
- **No se revisó seguridad, contratos de pago ni idempotencia**; eso corresponde a otros carriles.

**Siguiente paso recomendado:** corregir **O-01** (P0) y los P1 O-02 a O-10 antes de presentar la Caja nueva a una persona primeriza como “flujo completo”. El efectivo simple puede probarse ya, con la salvedad de O-09 en móvil. Después, repetir este recorrido con 5 personas y las tareas de la sección 8; un caso no ejecutado se reporta `NOT RUN`, no `PASS`.
