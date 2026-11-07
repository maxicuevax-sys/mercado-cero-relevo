# Dirección · Amable y de barrio

> Contrato de dirección para la composición de mostrador. No es un catálogo de
> componentes: es el objeto físico que la app imita y la razón de cada decisión.

## Direction Contract

**THESIS.** La caja es el cuaderno de ventas de una comerciante, no un dashboard
de tarjetas. Se rechaza el shell sidebar + main + right rail + cards: la pantalla
es una hoja de mostrador con índice, calculadora y libro de cuentas en la misma
superficie.

**OWN-WORLD.** Papel cálido con mesh ColorFlow (`mesh-paper`), fibra de papel,
renglones cada 30 px, margen terracota, toldo azafrán, LCD verde, tinta de sello
y teclas de calculadora con relieve. Fraunces en títulos; Atkinson Hyperlegible
en toda la interfaz. Sin glass, sin blur decorativo, sin tarjetas idénticas.

**STORY.** La persona abre la libreta, dice o escribe la venta, ve el total en el
LCD, confirma con la tecla “Cobrar” y voltea a la página de cuentas para saber
cuánto lleva y quién le debe. El fiado se lee como una nota, no como un KPI.

**FIRST VIEWPORT.** Franja de toldo arriba (negocio, fecha, DEMO, ayuda). A la
izquierda, índice vertical de pestañas de papel (Caja, Fiado, Corte, Meta,
Tareas). La hoja se divide con una línea de margen roja: página izquierda =
display LCD “Tu venta”, micrófono protagonista, renglón “Escribe la venta”,
notas de ejemplo, renglones del borrador y tecla sólida “Cobrar”; página derecha
= “Cuánto llevo” y “Lo que me deben” con renglones, más la tira perforada de
cobros pendientes y la actividad.

**FORM.** Objeto físico de trabajo: libreta de mostrador + calculadora de teclas
+ puesto de tianguis. Posición 1 de la lista: el artefacto real de la escena, no
una metáfora decorativa. `seed: none (unavailable)`.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.

## Receta material

- **ColorFlow `mesh-paper`.** Traducción CSS del mesh, no una imagen: cuatro
  manchas radiales (azafrán, terracota, verde, crema) sobre un degradado cálido,
  estáticas y sin `background-attachment: fixed`. Se aplica al canvas, a la
  hoja y al recibo; nunca a botones ni a texto.
- **Luz de papel.** Radial blanco cálido arriba a la izquierda + sombra cálida
  abajo a la derecha, como hoja bajo lámpara de mercado.
- **Grano.** SVG `feTurbulence` inline en data URI, opacidad 0.03, repetido a
  180 px. Sin peso de imagen.
- **Renglones.** `repeating-linear-gradient` cada 30 px al 9 % en la hoja; las
  tablas de la libreta usan filas de 30 px para que el texto se siente en ellos.
- **Margen.** Línea terracota al 35 % a 52–56 px en escritorio; 8 px en móvil,
  solo en la página de venta.
- **Bordes.** `mask-image` de festón en el borde inferior de la hoja y
  perforación radial en los recibos; sombra offset de 5 px y borde 1.5 px.
- **Sellos.** DEMO, PAGADO y SIMULADO con doble borde irregular y tinta
  desgastada, rotados -1.5°; nunca en la ruta de pago salvo el aviso demo.
- **Teclas.** Relieve interno + borde inferior de 2 px; “Cobrar/Pagar” es la
  tecla grande de la calculadora.
- **Recibo.** Papel con perforación arriba/abajo, folio, renglones, total,
  sello y CTA; en success lleva una segunda hoja detrás rotada -0.6°.
