# Mercado Cero — Manual de identidad visual (propuesta de trabajo)

## Concepto central

**Comercio vivo + tecnología silenciosa + memoria operativa.** Mercado Cero es una herramienta para realizar transacciones reales, no una demostración de IA ni una startup financiera abstracta. La estética debe dar confianza y personalidad; en la interfaz de cobro, el trabajo operativo tiene prioridad absoluta.

## Pilares

1. **Editorial mexicano contemporáneo:** tipografía con carácter, composición intencional, espacios y ritmos sobrios.
2. **Metáfora comercial, no nostalgia literal:** referencias a toldos, libretas, etiquetas, tickets, papel picado y productos donde agreguen sentido. NUNCA rayar toda la pantalla.
3. **Finanzas legibles:** cantidades grandes, monedas claras, pagos verificados inequívocos, no prometer utilidad neta con datos incompletos.
4. **Autonomía:** IA opcional, sin oscuridad de patrones, datos exportables, proveedores reemplazables.
5. **Accesibilidad real:** tipografía adaptable, patrones textuales redundantes, botones de 44–48 px, lector de pantalla, teclado, contraste y reflow.

## Paleta

| Token | HEX | Uso recomendado | Uso no recomendado |
|---|---|---|---|
| Verde Mercado | `#0F3D36` | Brand, navegación, principal | Mensajes de éxito exclusivamente por color |
| Verde acción | `#115846` | Botones primarios | Fondo de texto pequeño sin validar |
| Papel | `#F9F6EE` | Canvas | Textura repetida detrás de inputs |
| Superficie | `#FFFDF7` | Tarjetas y campos | Botones inactivos indistinguibles |
| Barro | `#C1492E` | Acentos ilustrativos, decoración | Texto diminuto en papel sin medir contraste |
| Barro para texto | `#8F2D1C` | Texto de riesgo/desviación con etiqueta | Confundirlo con fallo de pago por sí solo |
| Maíz | `#F2C768` | Resaltados y elementos narrativos | Base para todos los CTA |
| Menta | `#DDEADF` | Selecciones y estados positivos | Sustituir texto de estado |
| Tinta | `#1F2622` | Texto principal | Reemplazarlo por gris de bajo contraste |

**Regla:** cada combinación de texto/fondo debe superar 4.5:1 en cuerpo normal; 3:1 para texto grande y componentes gráficos donde aplica WCAG. El archivo `tokens/CONTRASTE_MEDIDO.csv` incluye combinaciones probadas matemáticamente; las demás requieren evaluación.

## Tipografía

- **Fraunces:** solo título editorial, encabezados expresivos, logotipo en la propuesta. No en importes críticos, inputs ni etiquetas largas.
- **Inter:** botones, navegación, contenido, lectura, montos, tablas, formas de pago y estados.
- **Numerales:** Inter + `font-variant-numeric: tabular-nums lining-nums` cuando cambian cantidades, balances o tablas.
- El tamaño de fuente debe responder a zoom y escala preferida: usar `rem`, no tamaños fijos como única fuente de verdad.
- Jerarquía: H1 `clamp(2rem, 3vw, 2.5rem)`, H2 `1.5rem`, secciones `1.125rem`, cuerpo `1rem`, detalle `0.875rem` solo si resulta legible.

## Layout

**Escritorio:** sidebar ~232 px, topbar compacta, content máximo de ~1440 px, zonas densas solo en gestión. Dashboard de 12 columnas con KPIs legibles y módulos ordenables. **No convertir la pantalla de venta en un dashboard.**

**Tablet:** navegación compacta y paneles apilados. Formularios de ancho cómodo; no dejar espacio vacío enorme ni crear dos scrolls verticales superpuestos.

**Móvil:** una tarea dominante, jerarquía fuerte y CTAs cerca de alcance del pulgar sin ocultar foco o teclado. Barra inferior de 4–5 destinos máximo; el resto en «Más». Labels permanentes.

## Componentes

Tokens reutilizables, no CSS en cada módulo. Base: `AppShell`, `Sidebar`, `BottomNav`, `Topbar`, `KPI`, `BalanceRow`, `MoneyAmount`, `StatusBadge`, `PaymentStatus`, `OrderDraft`, `QuickAction`, `TaskItem`, `PersonDebt`, `GoalProgress`, `CashDenomination`, `ErrorRecovery`, `EmptyState`, `PracticeBanner`, `GuidedStep`, `AccessibilityPreferences`.

### Profundidad y textura

- La mayoría de paneles son superficies planas con borde 1px, sombra muy tenue o ninguna.
- NO gradientes excesivos, glassmorphism, blur de fondo, pulsos decorativos, tarjetas apiladas innecesarias.
- Ticket rasgado, papel picado o toldo: solo onboarding, branding, pantallas vacías o decoración de landing.
- Ilustraciones: suficientes para narrar, pocas para operar. Una imagen de quesadilla no debe competir con el botón de cobrar.

## Tono y microcopy

- «Registrar venta» en lugar de «Procesar transacción».
- «Pendiente de confirmación» en lugar de «Parece pagado».
- «No hay suficientes datos para calcular ganancia» en lugar de adivinar.
- «Revisa estos movimientos» en lugar de «Algo salió mal».
- «Puedes hacerlo después» en lugar de «¡No abandones tu racha!».
- Ejemplos mexicanos cotidianos sin infantilizar: abarrotes, fondas, tianguis, puestos de comida, papelerías.

## Adaptabilidad

Nunca utilizar animaciones que impidan cobrar; respetar `prefers-reduced-motion`, el modo ahorro de datos y el contraste forzado. Asegurar que **el contenido esencial no depende de audio, voz, red, gesto o color**.

## Estados financieros

1. `draft`: venta aún no registrada.
2. `recorded`: venta reconocida en libro, **no necesariamente pagada**.
3. `payment_requested`: QR o solicitud creada, no prueba de pago.
4. `payment_pending`: esperando verificación del proveedor.
5. `verified`: verificación auténtica de PSP o banco con referencia.
6. `failed/cancelled/expired`: acción específica, sin simular cobro.
7. `offline_unverified`: registro local/pendiente, nunca confirmar dinero bancario.

Estas son etiquetas conceptuales; mapearlas contra la máquina de estados existente. Ninguna imagen puede redefinir cálculos.
