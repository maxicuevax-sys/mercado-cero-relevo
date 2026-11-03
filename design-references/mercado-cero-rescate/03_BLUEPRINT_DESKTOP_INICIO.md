# Blueprint visual / Inicio desktop

Referencia canónica: `00_REFERENCIA_CANONICA_INICIO_1448x1086.png`; todo lo que sigue son medidas iniciales aproximadas extraídas de imagen, no mediciones DOM. Ajustar tras captura visual al pixel.

## Canvas 1448×1086

| Zona | Rectángulo aproximado (x,y,w,h) | Regla |
|---|---|---|
| Sidebar | (0,0,236,1086) | Verde profundo, navegación estable y legible |
| Topbar | (236,0,1212,100) | Logo comercial, negocio/localidad, alertas, perfil |
| Área de contenido | (236,100,1212,986) | Fondo papel cálido; padding lateral ~24px |
| Saludo | (263,126,1117,112) | Ícono sol, serif prominente, fecha de apoyo |
| KPIs | (260,259,1129,196) | 4 cards IGUALES en 1 fila desktop |
| Acción nueva venta | (260,488,538,304) | Hero verde con ilustración registradora + CTA visible |
| Pendientes | (816,488,574,301) | Card crema con tareas, checkboxes y enlace Ver todos |
| Sugerencia | (260,814,1129,211) | Card a lo ancho con ilustración lateral y acción |

## Orden visual inamovible en desktop para esta fase

1. Sidebar: marca, Inicio activo, Ventas, Fiados, Productos, Proveedores, Caja, Reportes; abajo Ayuda y Ajustes.
2. Topbar: icono del negocio + nombre + localización, campana y avatar.
3. Saludo: `¡Buen día, Lupita!` es DEMO solamente; usar nombre real del negocio/persona si procede, o texto genérico accesible.
4. Primera fila cuatro métricas: Ventas hoy / Cobrado hoy / Por cobrar / Meta del mes.
5. Segunda fila: hero Nueva venta a la izquierda; Pendientes a la derecha.
6. Tercera fila: Sugerencia opcional, a lo ancho.

## Semántica financiera (no copiar números de la imagen)

- Ventas hoy = ventas registradas para el periodo y su criterio contable. No necesariamente monto liquidado.
- Cobrado hoy = cobros recibidos y verificados, separado por medio; no sumar solicitudes QR pendientes.
- Por cobrar = saldos pendientes existentes, no duplicar ventas.
- Meta del mes = progreso sobre objetivo configurado, no cuenta bancaria.
- En TEST visual se puede usar fixture ficticio para comparar contenido tipográfico, pero nunca en datos reales.

## Identidad

- Tinta verde sidebar: aproximado `#004d3d` / `#064b3e`, validar contraste.
- Papel: `#F9F6EE` aproximado. Las tarjetas no deben ser gris corporativo.
- Acento maíz `#F3AE25`, barro `#C04B2E`.
- Display serif con carácter (Fraunces, si ya está disponible), texto UI sans (Inter o la elección existente de calidad similar).
- Radios aproximados de tarjetas 20–26px; bordes cálidos de 1px y sombra muy sutil.
- Iconos consistentes 24px; no combinar 3 familias de stroke.
- Ilustraciones SOLO en zonas visualmente previstas: hero Nueva venta, sugerencia, sidebar inferior; papel picado en esquina superior derecha del contenido.
- Iconos y gráficos deben ser archivos separados y apropiados para raster/SVG reales. No incrustar screenshot de app.

## Lo que NO debe ocurrir

- KPI 2x2 incrustado en rail derecha.
- Sidebar con `Caja` seleccionado cuando se captura `Inicio`.
- Formulario completo `¿Qué vendiste?` en pantalla Inicio.
- "Tu venta $0.00" como centro del dashboard.
- Ilustración solitaria de puesto de mercado como sustituto de hero registradora y sugerencia.
- Falsos contrastes de estado: estado de cobro pendiente ≠ pago verificado.
- Animaciones que distraigan del monto.

## Responsive

Desktop >=1200px: 4 KPIs en una fila y 2 paneles inferiores. Tablet: 2x2 KPI y paneles apilables según espacio. Móvil: KPI priorizados y acción Nueva venta visible; navegación adaptada pero sin ocultar funciones. Al 200% zoom, reflow sin texto solapado. Estas decisiones no deben cambiar la captura de 1448px.
