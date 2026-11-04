# Auditoría de diseño — Oleada B (`/inicio`, `/caja`, `/ventas`)

> **Rol:** `mc-sistema-diseno` · **Modo:** solo lectura. No se editó producto, no se hicieron commits.
> **Repo:** `mercado-cero` · **HEAD:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02` · **Servidor:** `http://localhost:3100`, build `4130e71...`, `/api/health` → `ok:true`.
> **Fecha:** 4 de noviembre de 2026 · **Viewports:** 1448×1086, 1366×768, 1280×800, 768×1024, 390×844, 320×640. **200%:** 724×543 con DPR 2 (reflujo equivalente a 200% de 1448×1086). **Alto contraste:** preferencia local.
> **Evidencia:** `quality-reports/oleada-b-review/EVIDENCIAS/design-capturas/` y `.../design-metricas/`.
> **Datos:** las capturas actuales de `/ventas` contienen pedidos de pruebas previas (`AUDRES…`, `Auditoria shell`); el reset demo está bloqueado por 4 pagos firmados de pey y **no se forzó**. Para composición con datos limpios se conservan `design-ventas-*-datos-limpios.png` de la entrega de Oleada B. Se crearon ventas demo para recorrer los estados; no se editó producto ni se borraron pagos reales.

---

## 0. Veredicto

> ## **NO-GO de diseño**
>
> **P0 = 0 · P1 = 4 · P2 = 7 · P3 = 7.**
>
> La Oleada B **sí construyó pantallas reales** y **sí migró el shell, la tipografía y el encuadre editorial** de Inicio. No es “el shell antiguo con colores nuevos”: el shell es el de Inicio, la navegación y el topbar son los nuevos, y Caja/Ventas no reutilizan el layout legacy.
>
> Pero la migración es **parcial en lo material y en la verdad visual**: en escritorio desaparecen los importes de línea, en 1366×768 y 1280×800 desaparece la acción principal, el resultado de fiado afirma que se registró efectivo cuando no hubo efectivo, y la sugerencia de Inicio se rompe en 768×1024. Esos cuatro defectos impiden cerrar la ola como calidad de diseño suficiente, aunque la funcionalidad y los gates automáticos puedan estar en verde.

**Diagnóstico en una frase:** el producto tiene **shell nuevo + template operativo genérico**; la identidad entró por la marca, la tipografía y el marco, pero no por las superficies, los estados, la iconografía ni la navegación profunda.

---

## 1. Método y alcance

Se inspeccionó el DOM y el CSS computado con Chromium/Playwright, no solo HTTP 200. Se midieron:

- `getBoundingClientRect()` de H1, page header, total, summary, CTA, nav móvil, filas, stats y acciones del resultado.
- `getComputedStyle()` de fondos, familias tipográficas, tamaños, `font-variant-numeric`, `clip`, `position` y `overflow`.
- Muestras de píxel de las capturas para verificar fondos y la frontera de la banda de 1448.
- Estados: Caja vacía, con conceptos, efectivo con cambio, método digital, cobro digital pendiente, fiado, resultado en efectivo, resultado fiado; Ventas con datos; alto contraste; 200%.
- Comparación con la identidad aprobada de Inicio (`AUDITORIA_SISTEMA_VISUAL.md`, `DISENO_CAJA.md`, `PARIDAD-REFERENCIAS.md`) y con las referencias de Fase 1.

No se ejecutó axe ni un lector de pantalla en esta pasada; el foco es visual, de sistema y de arquitectura. Los gates existentes no cubren estos defectos: el smoke comprueba que la pantalla responde, no que el importe de línea sea visible.

---

## 2. Identidad: qué migró de verdad y qué no

### 2.1 Lo que sí es migración real

| Elemento | Evidencia |
|---|---|
| Shell de Inicio | Sidebar verde, marca, topbar, sello DEMO, avatar, nav activa crema, mobile nav de 5 slots. Idéntico al de `/inicio`. |
| Tipografía editorial | Hearth en H1/H2; Alder en cuerpo, labels, botones e importes. H1 43.4 px en Caja/Ventas vs 52 px en Inicio; mismas familias reales. |
| Paleta de marca | Verde profundo, crema, terracota y azafrán; los estados usan `--color-attention`, `--color-info`, `--color-green-soft`, etc. |
| Jerarquía de tarea | Caja no es un dashboard: no hay KPIs, hero ni gráficas; una tarea, un total, un método. Eso cumple el contrato de “Caja de una pasada”. |
| Verdad del dinero (casi) | Pendiente digital, demo, fiado y efectivo tienen etiquetas explícitas; no hay “pagado” por captura. El defecto P1-03 es de copy, no de motor. |
| Targets base | 48 px en métodos, botones y campos; foco visible; sin overflow horizontal en ninguno de los seis viewports. |

### 2.2 Lo que no migró

| Brecha | Diferencia medible |
|---|---|
| **Dos cremas** | Inicio: shell `#fbf3e7`, superficie `#fdf3e4`, topbar `#fbefe2`. Caja/Ventas: `main` `#f9f6ee`, tarjetas `#fffdf7`. En 1448×1086 la frontera se ve como banda horizontal en `y≈937`. |
| **Materialidad** | Las tarjetas de Caja/Ventas son blancas, planas y de 16–22 px; las de Inicio son melocotón, con borde cálido, sombra suave y bloques de icono. No hay papel, borde de ticket ni ilustración operativa. |
| **Iconografía** | Inicio usa stickers SVG propios; Caja/Ventas usa **texto** (`+`, `×`) y estados solo texto. Ventas no tiene ningún icono de estado. |
| **Ilustración** | Inicio tiene registradora, Lupita, papel picado y arte de sidebar. Caja/Ventas no tienen ninguna ilustración, ni siquiera un vacío ilustrado de 64 px. |
| **Navegación profunda** | Fiados, Corte, Metas, Pendientes y Ayuda/Ajustes siguen abriendo el **shell legacy** (`/?tab=…`), con otro sidebar, otro topbar y otro lenguaje visual. La migración se rompe al cuarto clic. |
| **Estados** | Los estados de Ventas son píldoras de texto de 11 px; no usan el sistema icono + texto + forma que el contrato de Caja exige para el dinero. |

### 2.3 Diagnóstico: no es “shell antiguo”, pero tampoco es Inicio

- **No** es el shell viejo recoloreado: el `AppShell`, la sidebar, el topbar, el `PageHeader` y el nav móvil son los de Inicio.
- **Sí** es un **template operativo genérico** dentro de ese shell: dos cards, un formulario, una tabla de filas y tres stat cards. La identidad se concentra en la tipografía y el color; la composición y la materialidad podrían pertenecer a cualquier SaaS.
- La dependencia técnica confirma la brecha: Caja y Ventas **importan `inicio.css`** solo para que el shell se vea bien (`caja-screen.tsx:29`, `ventas/page.tsx:25`), mientras el contenido pinta con `--color-*`. Eso produce las dos paletas y la banda de 1448. El shell aprobado sigue sin ser portable de forma autónoma.

---

## 3. Matriz por dimensión

| Dimensión | Inicio aprobado | Caja | Ventas | Resultado |
|---|---|---|---|---|
| **Arquitectura de información** | Inicio-first, KPIs, hero, pendientes, sugerencia | Una tarea: conceptos → cobro → resultado | Historial paginado, resumen + lista | Caja correcta; Ventas móvil entierra la lista |
| **Jerarquía** | H1 52, KPIs 4×1, hero | H1 43, total 40, card de cobro | H1 43, 3 stat cards, lista | Buena en desktop; el total se duplica |
| **Acción principal** | “Registrar” visible | “Confirmar venta” ausente del primer viewport en 1366/1280/768 | “Nueva venta” clara | **P1** |
| **Tipografía** | Hearth/Alder, 17 px cuerpo | Correcta; H2 de card en Hearth (el contrato pedía Alder para card) | Correcta; estados 11 px | Casi; detalles P3 |
| **Importes** | Tabulares, grandes, legibles | Total correcto; **importe de línea invisible >760** | Totales correctos; importe móvil después del detalle | **P1** |
| **Densidad** | Rica, editorial | Vacío excesivo en 1448; CTA lejos | Resumen móvil 334 px antes de la lista | P2 |
| **Espacio negativo** | Intencional | 150 px de banda/fondo muerto en 1448 | Correcto en desktop; lista móvil bajo el pliegue | P2 |
| **Iconos** | Stickers propios, coherentes | Sin iconos; `+` y `×` tipográficos | Sin iconos de estado | P2/P3 |
| **Ilustraciones** | 4 piezas integradas | Ninguna; vacío de texto | Ninguna | P2 |
| **Responsive** | 320/390/1366/1448 probados; 768 roto | Sin scroll horizontal; CTA fuera de vista | Sin scroll horizontal; lista bajo el pliegue | **P1 en Inicio 768; P2 en Ventas móvil** |
| **Estados** | Demo/real visibles | Efectivo, digital, fiado, demo y resultado claros | Demo/pendiente/fiado con texto; sin icono | P1 en copy de fiado; P2 en iconos |
| **Navegación** | 7 destinos + foot | Activa correcta; shell compartido | Activa correcta; shell compartido | P2: 5 destinos escapan al legacy |
| **Originalidad** | Alta: papel, mercado, ilustración | Media-baja: formulario de dos columnas | Media-baja: KPIs + lista | Migración material incompleta |

---

## 4. Hallazgos

### P1 — Bloquean el cierre de diseño

#### P1-01 · El importe de cada línea desaparece en escritorio y tablet

**Qué se ve:** la cabecera de la tabla dice `CONCEPTO · CANTIDAD · PRECIO · IMPORTE`, pero la celda de importe queda vacía. Solo aparece en ≤760 px. En 768×1024 también está vacía.

**Evidencia:** `design-capturas/design-caja-conceptos-1448x1086.png`, `...-1366x768.png`, `...-1280x800.png`, `...-768x1024.png`; recorte `design-caja-importe-vacio-crop.png`. Medición: el `span` del importe mide **1×1 px** con `clip: rect(0,0,0,0)` en 1448/1366/1280/768; en 390 mide 96×22.6 y es visible.

**Causa:** `web/src/components/caja/caja.css:177-184` oculta **todos** los `span` hijos de `.mc-caja-line__total`, incluido el `CurrencyAmount`; la excepción de móvil está en `caja.css:950-957`. El markup está en `sale-line-items.tsx:148-151`.

**Por qué es P1:** en la pantalla donde el comerciante verifica una venta, no puede comprobar `cantidad × precio`; el total global no sustituye la lectura por línea.

**Recomendación:** ocultar solo la etiqueta (`> span:first-child`) y dejar visible el `span.tabular-nums`; añadir regresión visual en 1448, 1366, 1280 y 768. Si se quiere un `sr-only`, usar una clase explícita, no un selector de todos los spans.

---

#### P1-02 · “Confirmar venta” no está en el primer viewport en 1366×768 ni 1280×800

**Qué se ve:** al agregar el primer concepto, la columna de cobro crece y el CTA cae por debajo del pliegue. En 1366×768 el botón empieza en `y=775.9` (viewport 768); en 1280×800, en `y=807` (viewport 800). Con efectivo y cambio, el botón llega a `y=728-784` y queda recortado 16 px; con fiado, `y=738-794`. En 768×1024 el CTA está en `y=1305`.

**Evidencia:** `design-caja-conceptos-1366x768.png` (no se ve el CTA), `design-caja-efectivo-cambio-1366x768.png` (solo el borde superior), `design-caja-fiado-1366x768.png` (CTA fuera), `design-caja-conceptos-1280x800.png`. El contrato `DISENO_CAJA.md` §0 exige total, método y confirmación en el primer viewport en 1448, 1366, 390 y 320.

**Causa:** la columna `position: sticky` (`caja.css:336-339`) no ayuda cuando el contenido de la card supera el alto del viewport; el orden total → nota → métodos → campo → errores → CTA (`sale-summary.tsx:84-112, 218-229`) es demasiado alto. El header añade un chip de total duplicado (`caja-screen.tsx:423-450`).

**Por qué es P1:** es la acción principal de la pantalla y falla en el tamaño de laptop más común; obliga a hacer scroll de 270 px para confirmar. No es P0 porque la acción existe y es alcanzable.

**Recomendación:** compactar el rail (nota y ayudas debajo del CTA; métodos en una fila de 4 si caben; menos padding) o fijar un footer de la card con el CTA siempre visible. En 1366/1280 priorizar la visibilidad del botón sobre la nota explicativa. Eliminar el chip de total del header o usarlo solo en móvil.

---

#### P1-03 · El resultado de fiado afirma que se registró efectivo cuando no hubo efectivo

**Qué se ve:** en una venta 100% fiada, el resultado dice:

> “Quedó anotado en Fiado. Solo el fiado es deuda; **el efectivo sí se registró en la caja**.”

No hubo efectivo. La nota superior sí dice correctamente que la parte fiada es deuda y no dinero recibido, pero el banner se contradice.

**Evidencia:** `design-capturas/design-caja-fiado-resultado-390x844.png` y `...-1448x1086.png`.

**Causa:** `web/src/components/caja/sale-result.tsx:133-136` muestra el banner siempre que `openCredit`, con texto fijo que menciona efectivo. La condición no distingue fiado puro de mixto.

**Por qué es P1:** es una afirmación falsa sobre dinero recibido en la pantalla de confirmación. Aunque el ledger esté correcto, el comerciante puede creer que entró efectivo. Debe corregirse antes de cualquier demo.

**Recomendación:** copy condicional:
- `cashPaidCents > 0`: “Quedó anotado en Fiado. El efectivo registrado es X; el saldo fiado es deuda.”
- fiado puro: “Quedó anotado en Fiado. No se registró efectivo; todo el importe es deuda.”
Añadir una prueba de copy para fiado puro y mixto.

---

#### P1-04 · Inicio se rompe en 768×1024: CTA clipeado y papel picado sobre el H1

**Qué se ve:** a 768×1024 Inicio conserva la sidebar de 210 px y el contenido de 510 px. La tarjeta “Tu negocio, en orden.” queda con una columna de texto de ~100 px (“Tu / negocio / en / orden.”), el CTA “Ir a ventas” sale del lienzo (se lee “Ir a vent…”) y el papel picado se superpone al H1 “¡Buen día, Lupita!”.

**Evidencia:** `design-capturas/design-inicio-768x1024.png`, `design-inicio-768x1024-full.png`, `design-inicio-768-sugerencia.png`, `design-inicio-768-clip-crop.png`, `design-inicio-768-h1-picado-crop.png`. Medición: CTA `x=629 → right=829`, contenido `right=744`, viewport 768: **85 px clipeados**; H1 `x=314 → 740.4`; papel picado `x=281 → 744`.

**Causa:** `inicio.css:649` mantiene la sugerencia en `330px minmax(0,1fr) auto` con CTA `min-width:200px` (`inicio.css:698-702`); el breakpoint que colapsa es 760 (`inicio.css:792`), pero el shell ya cambió a sidebar de 210 en 1340 (`inicio.css:762-779`). El hueco 761–900 no tiene layout intermedio. El `overflow:hidden` de la tarjeta oculta el CTA en vez de permitir scroll.

**Por qué es P1:** 768×1024 es un viewport de revisión explícito y un iPad portrait típico; la pantalla de entrada queda visualmente rota. Es deuda de Inicio, pero afecta la identidad que Caja/Ventas heredan.

**Recomendación:** mover el colapso de la sugerencia (y del arte/papel picado) a ~900 px, o cambiar la plantilla a `112px minmax(0,1fr)` en tablet; ocultar el papel picado cuando el contenido mida menos de ~700 px. Añadir 768×1024 al gate visual de Inicio.

---

### P2 — Importantes, no bloquean por sí solos

#### P2-01 · Dos paletas y una banda de fondo visible en 1448×1086

**Qué se ve:** el contenido de Caja es `#f9f6ee` y el shell que queda debajo es `#fbf3e7`. En 1448×1086, al terminar el contenido, aparece una banda horizontal cálida de ~150 px a partir de `y≈937`; se lee como un footer accidental. En el resultado y en Ventas ocurre el mismo desajuste, aunque el documento largo lo esconde.

**Evidencia:** `design-caja-vacia-1448x1086.png`, `design-caja-1448-seam-crop.png`, muestra de píxel: `main rgb(249,246,238)` → `shell rgb(251,243,231)` en `y=937`. `design-caja-fiado-resultado-1448x1086.png`.

**Causa:** `.mc-caja` pinta `background: var(--color-canvas)` (`caja.css:3-8`), `.mc-ventas` hace lo mismo (`ventas.css:1-8`); el shell usa `--inicio-paper #fbf3e7` (`inicio.css:5,20`) y `--inicio-surface #fdf3e4` (`inicio.css:357`). `--color-canvas` es `#f9f6ee` (`globals.css:6`). Caja/Ventas importan `inicio.css` solo por el shell (`caja-screen.tsx:29`, `ventas/page.tsx:25`).

**Recomendación:** una sola fuente para el papel: `main { background: transparent }` y que el shell pinte el papel; o alinear `--color-canvas`/`--color-surface` con `--inicio-paper`/`--inicio-surface`. Añadir `min-height` al main para que no quede banda. Esto es también la deuda de portabilidad del `AppShell`.

---

#### P2-02 · Ventas móvil: el resumen ocupa el primer viewport y deja la lista debajo del pliegue

**Qué se ve:** a 390×844 las tres stat cards miden 333.9 px; “Ventas registradas” empieza en `y=626`, la primera fila en `y=705` y la nav en `y=779`. No se ve ninguna fila completa: solo el folio y parte de la fecha. A 320×640 la lista ni siquiera empieza antes de la nav (`y=609` vs nav `575`). El usuario entra a “Ventas” y no ve ventas.

**Evidencia:** `design-ventas-390x844-datos-limpios.png`, `design-ventas-320x640-datos-limpios.png`, `design-ventas-390-pliegue-crop.png`; métricas en `design-hallazgos.json`.

**Causa:** `ventas.css:36-48` usa 3 columnas en desktop y `ventas.css:280-282` las apila en móvil; cada tarjeta conserva 14–16 px de padding y dos o tres líneas de nota. La lista se construye después (`ventas/page.tsx:85-116`).

**Recomendación:** en móvil, un resumen compacto de una sola fila (tres importes con label abreviado) o un `<details>` “Resumen”; que “Ventas registradas” y la primera fila queden visibles en 390. No copiar el dashboard de Inicio: la tarea es leer el libro.

---

#### P2-03 · La navegación principal escapa al shell legacy en Fiados/Corte/Metas/Pendientes

**Qué se ve:** desde la sidebar nueva, “Fiados” y “Corte” abren `/?tab=fiado` y `/?tab=corte` con **otro** shell: logo “La caja que habla”, sidebar Caja/Fiado/Corte/Meta/Pendientes, topbar con iconos de audio/ayuda y otra escala. “Metas”, “Pendientes”, “Ayuda” y “Ajustes” siguen el mismo camino. El usuario cree estar en un producto y aterriza en otro.

**Evidencia:** `design-capturas/design-legacy-fiados-1448x1086.png`, `design-legacy-corte-1448x1086.png`. `nav.ts:29-53` publica esos destinos; las rutas son 307 a `/?tab=` (documentado en `ENTREGA_OLEADA_B.md`).

**Recomendación:** hasta que se migren, ocultarlas del nav nuevo o marcarlas explícitamente como “Clásico”/“Beta” y abrir en una sección claramente separada. No presentar como equivalentes cinco destinos que cambian de sistema visual. La migración real debe incluir la navegación, no solo las tres rutas nuevas.

---

#### P2-04 · En el resultado fiado de 390, la nav tapa el CTA y las acciones secundarias

**Qué se ve:** la card de resultado mide 728 px; “Nueva venta” va de `y=739.5` a `795.5`, pero la nav empieza en `779`: **16.5 px del CTA primario quedan debajo**. “Ver ventas” y “Volver a Caja” quedan completamente cubiertos. A 320, todas las acciones están bajo el pliegue.

**Evidencia:** `design-caja-fiado-resultado-390x844.png`, recorte `design-caja-resultado-nav-overlap-crop.png`; métricas en `design-hallazgos.json`. En el resultado en efectivo el CTA primario sí cabe, pero “Ver ventas” ya queda tapado.

**Recomendación:** una barra de acciones fija sobre la nav (con el primario y un “más”) o reducir la card (facts en 2 columnas, banner más corto) para que las tres acciones queden sobre `779`. Comprobar 320 y 390.

---

#### P2-05 · “Volver a Caja” es un CTA muerto y duplica “Nueva venta”

**Qué se ve:** en el resultado, “Nueva venta” resetea correctamente; “Volver a Caja” (un `<Link href="/caja">`) no cambia de estado: se probó el clic y la pantalla siguió en “Venta registrada”. Es un tercer botón que no hace lo que promete y compite con el primario.

**Evidencia:** prueba de clic documentada en `design-hallazgos.json`; `sale-result.tsx:144-153`.

**Recomendación:** eliminar “Volver a Caja” o conectarlo a `resetSale` con copy “Empezar otra venta”; dejar dos acciones claras (Nueva venta / Ver ventas). Si se conserva, no debe ser un `<Link>` a la misma ruta.

---

#### P2-06 · Ventas no agrupa por día ni ofrece filtros; el “libro” es una lista plana

**Qué se ve:** la página 1 muestra 25 filas con fechas repetidas (“Hoy 10:10 a.m.”, “Hoy 11:20 a.m.”); no hay encabezados de día, búsqueda, filtro por estado/método ni salto a cliente. El contrato de diseño define Ventas como “libro operativo… por día”; aquí es una lista global paginada.

**Evidencia:** `design-ventas-1448x1086-datos-limpios.png`, `design-ventas-390x844-datos-limpios.png`; `ventas/page.tsx:135-220`; `DISENO_CAJA.md` §0 y §5.

**Recomendación:** agrupar por fecha con un header pegajoso (“Hoy”, “Ayer”, fecha), y añadir al menos un filtro compacto (Hoy/Semana/Todos) o búsqueda por folio/cliente. No requiere gráficas ni reportes: es lectura.

---

#### P2-07 · La materialidad de Inicio no cruzó a Caja/Ventas; las cards son genéricas

**Qué se ve:** Inicio tiene tarjetas melocotón con iconos en cuadro de color, sombra suave y arte. Caja/Ventas tienen tarjetas blancas `#fffdf7`, sin icono, sin borde de papel; las tres stat cards de Ventas son tres rectángulos blancos idénticos. El vacío de Caja es un cuadro dashed de texto, sin la ilustración de 64 px que el contrato permitía.

**Evidencia:** comparar `design-inicio-1448x1086.png` con `design-caja-vacia-1448x1086.png` y `design-ventas-1448x1086-datos-limpios.png`; `inicio.css:348-358` vs `caja.css:63-70` y `ventas.css:43-48`.

**Recomendación:** definir una variante “papel operativo” para Caja/Ventas: superficie cálida, borde/sombra de Inicio y un bloque de icono de 32–44 px en las stat cards. Añadir una ilustración pequeña solo al vacío y al resultado, nunca como decoración que compita con el cobro. No convertir Caja en dashboard.

---

### P3 — Acabado y consistencia

#### P3-01 · Totales y CTA duplicados

El total aparece en el chip del header, en la card de cobro y, en móvil con conceptos, en la paybar. “Ver cobro” (header) y “Revisar cobro” (paybar) compiten. En 1448 se leen dos `$90.00` separados por 400 px; en 390, tres. **Refs:** `caja-screen.tsx:423-450, 569-583`; `caja.css:22-52`. **Recomendación:** un solo total por breakpoint; en desktop eliminar el chip o convertirlo en un ancla discreta.

#### P3-02 · Estados de 11 px

`mc-ventas-status` usa `font-size: 0.6875rem` (11 px), por debajo del mínimo 12 px del sistema para texto esencial; los badges “DEMO”, “PENDIENTE” y “Saldo vivo” son la información de estado. **Ref:** `ventas.css:128-140`. **Recomendación:** 12 px mínimo y, si se mantiene el uppercase, tracking 0.06em.

#### P3-03 · Targets de 44 px

`mc-ventas-pager a/span`, `mc-ventas-row__details summary` y `mc-caja-clear` usan 44 px, no los 48 px de la casa. **Refs:** `ventas.css:218, 252`; `caja.css:493`. **Recomendación:** 48 px o justificar la excepción; no bajar el target por densidad.

#### P3-04 · El “quitar” es una × tipográfica, no un icono

El botón de quitar línea usa `<span>×</span>` (`sale-line-items.tsx:159`); se ve como un carácter diminuto sin affordance, mientras el resto del sistema usa SVG/Lucide. **Ref:** `caja.css:233-259`. **Recomendación:** `Trash2` de Lucide a 18 px dentro del target de 44/48, o un icono propio consistente.

#### P3-05 · Hex literales en las hojas nuevas

`caja.css:309,407` y `ventas.css:27` usan `#fffdf7`; `caja.css:604` usa `#fff` para el QR. El contrato pedía cero hex en Caja/Ventas. El `#fff` del QR es funcional (contraste de escaneo), pero debe documentarse o tokenizarse como `--color-qr-surface`. **Recomendación:** reemplazar `#fffdf7` por `var(--color-surface)` y dejar el QR como excepción explícita.

#### P3-06 · El topbar a 320 parte el nombre del comercio en dos líneas

“Antojitos de Lupita” se parte y el topbar queda muy justo entre logo, DEMO y avatar; no hay overflow, pero la marca pierde presencia. **Evidencia:** `design-caja-vacia-320x640.png`, `design-ventas-320x640-datos-limpios.png`; `inicio.css:894-900`. **Recomendación:** reducir el nombre a 0.875rem en ≤360 o truncar con ellipsis y mantener una línea.

#### P3-07 · “Caja” vs “Nueva venta”: dos nombres para la misma pantalla

La nav y el `<title>` dicen “Caja”; el H1 dice “Nueva venta”, y en el resultado pasa a “Venta registrada” y “Cobrar venta”. El eyebrow “CAJA” queda pequeño y no resuelve la orientación. **Refs:** `caja-screen.tsx:423-433`; `caja/page.tsx` metadata. **Recomendación:** decidir si la pantalla se llama “Caja” (con “Nueva venta” como tarea) o “Nueva venta” (con “Caja” como sección); no usar dos jerarquías simultáneas.

---

## 5. Caja/Ventas frente a Inicio: qué comparar y qué no

**No exigir que Caja copie el dashboard.** Caja hace bien en no tener KPIs, hero ni sugerencia; su composición de mostrador es la decisión correcta. Ventas también debe ser un libro, no un dashboard.

**Lo que sí debe compartirse:**

1. **Una sola paleta y un solo papel.** Caja/Ventas no deben verse como otra app dentro del mismo shell.
2. **La materialidad de las tarjetas.** Inicio tiene superficies cálidas y bloques de icono; Caja/Ventas pueden ser más sobrias, pero no blancas genéricas.
3. **La iconografía de estado.** El dinero no debería depender solo de una píldora de color/texto; el contrato ya definió icono + texto + forma.
4. **La navegación completa.** Un shell nuevo con destinos que llevan al shell viejo no es una migración terminada.
5. **La verdad del copy.** El resultado de fiado es el ejemplo más grave: la estética no puede contradecir el ledger.

**Diferencias válidas:** Caja no necesita ilustración de hero, ni KPI, ni papel picado. Ventas no necesita la composición editorial de Inicio; necesita densidad y escaneo. El error no es diferenciarse, es **no compartir el sistema material**.

---

## 6. Prioridad de corrección

**Antes de cerrar Oleada B (P1):**

1. Hacer visible el importe de línea en >760 (P1-01).
2. Garantizar el CTA de confirmación en el primer viewport de 1366×768 y 1280×800, y un acceso equivalente en 768×1024 (P1-02).
3. Corregir el banner de fiado puro (P1-03).
4. Reparar la sugerencia de Inicio en 768×1024 y el choque del papel picado (P1-04).

**Después, antes de la demo pública (P2):**

5. Unificar papel/fondo y eliminar la banda de 1448.
6. Compactar el resumen de Ventas en móvil.
7. Sacar del nav nuevo los destinos legacy o marcarlos.
8. Resolver la superposición de acciones del resultado con la nav móvil.
9. Eliminar o cablear “Volver a Caja”.
10. Agrupar Ventas por día y añadir un filtro mínimo.
11. Definir la variante material “papel operativo” y los iconos de estado.

**Acabado (P3):** duplicación de totales, 11 px, targets 44, icono de borrar, hex, topbar 320 y nomenclatura.

---

## 7. Evidencia

### Capturas principales

- Inicio: `design-inicio-1448x1086.png`, `-1366x768.png`, `-1280x800.png`, `-768x1024.png`, `-768x1024-full.png`, `-768-sugerencia.png`, `-390x844.png`, `-320x640.png`.
- Caja vacía: `design-caja-vacia-{1448x1086,1366x768,1280x800,768x1024,390x844,320x640}.png`.
- Caja con conceptos: `design-caja-conceptos-{1448x1086,1366x768,1280x800,768x1024,390x844,320x640}.png`.
- Caja efectivo/cambio: `design-caja-efectivo-cambio-{1366x768,390x844,320x640}.png`.
- Caja método digital: `design-caja-metodo-digital-{1448x1086,390x844}.png`.
- Caja digital pendiente: `design-caja-digital-cobrar-1448x1086.png`, `design-caja-digital-pendiente-{1448x1086,390x844}.png`.
- Caja fiado: `design-caja-fiado-{1366x768,390x844}.png`; resultado `design-caja-fiado-resultado-{1448x1086,390x844,320x640}.png`.
- Caja efectivo resultado: `design-caja-efectivo-resultado-{1448x1086,390x844}.png`.
- Ventas: `design-ventas-{1448x1086,1366x768,1280x800,768x1024,390x844,320x640}.png`; composición limpia `design-ventas-{1448x1086,390x844,320x640}-datos-limpios.png`.
- 200%: `design-caja-zoom200-1448.png`, `design-ventas-zoom200-1448.png`.
- Alto contraste: `design-caja-alto-contraste-1448x1086.png`, `design-ventas-alto-contraste-1448x1086.png`.
- Legacy alcanzable: `design-legacy-fiados-1448x1086.png`, `design-legacy-corte-1448x1086.png`.
- Recortes de hallazgo: `design-caja-1448-seam-crop.png`, `design-caja-importe-vacio-crop.png`, `design-caja-resultado-nav-overlap-crop.png`, `design-inicio-768-clip-crop.png`, `design-inicio-768-h1-picado-crop.png`.

### Métricas

- `design-metricas/design-summary.json`: 45 estados, geometría, estilos computados, overflow y textos.
- `design-metricas/design-hallazgos.json`: resumen de mediciones y conteo.

### Lo que sí pasa

- **Sin mojibake renderizado:** los acentos y signos se ven correctamente en las capturas y el DOM devuelve `Coyoacán`, `miércoles`, `cómo`; no hay U+FFFD. La `×` de borrar es un carácter intencional, no corrupción.
- **Sin scroll horizontal** en 1448/1366/1280/768/390/320; el problema de 768 es recorte por `overflow:hidden`, no scroll.
- **Sin imágenes rotas** ni fondos transparentes incompatibles en las ilustraciones de Inicio.
- **Tipografía y cifras tabulares** correctas en totales y filas; la jerarquía H1 → total → sección funciona en 1448.
- **Estados de dinero** bien diferenciados por texto en Caja y Ventas; el defecto es la falta de icono y el copy de fiado, no la ausencia de etiquetas.
- **Alto contraste** mantiene legibilidad y no introduce texto blanco sobre blanco en las rutas revisadas.
- **200%** no produce overflow horizontal; el problema es de densidad, no de reflujo.

---

## 8. Límites de esta auditoría

- El 200% se emuló con viewport mitad + DPR 2, no con el zoom real del navegador; el reflujo es equivalente, pero no sustituye una prueba manual de zoom.
- La base demo está contaminada por pruebas previas y el reset está bloqueado por pagos firmados de pey; no se forzó ni se borró nada. Las conclusiones de composición usan la geometría actual y las capturas limpias de la entrega.
- No se ejecutó axe ni un lector de pantalla en esta pasada; los P1 son visuales/semánticos, no se presentan como fallos WCAG automáticos.
- No se editó producto ni se hicieron commits. `git status` solo muestra `quality-reports/oleada-b-review/` como no versionado.
