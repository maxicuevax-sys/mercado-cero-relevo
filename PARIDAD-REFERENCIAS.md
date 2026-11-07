# Paridad con las referencias · auditoría de 5 subagentes

> **Build auditado:** `794aa06` · 3 nov 2026
> **App:** `http://localhost:3100` · móvil 390×844 · escritorio 1440×1000
> **Método:** 5 subagentes en paralelo, sólo lectura. Compararon las imágenes del usuario, los 16 specs del kit, capturas reales y medidas con `getBoundingClientRect()`.
> **Regla:** no se usaron las cifras de los mockups como verdad, no se llamó `/api/demo/reset` y no se guardaron ventas/abonos/cortes.

## Referencias correctas (confirmadas)

| Archivo | Contenido |
|---|---|
| `…06_52_02 a.m-1.png` | Dashboard de escritorio 1448×1086 |
| `…06_52_03 a.m-2.png` | Inicio móvil |
| `…06_52_04 a.m-3.png` | Nueva venta |
| `…06_52_05 a.m-4.png` | Método de pago |
| `…06_52_06 a.m-5.png` | Pago QR |
| `…06_52_07 a.m-6.png` | Fiados |
| `…06_52_08 a.m-7.png` | Corte de caja |
| `…06_52_08 a.m-8.png` | Metas |
| `…06_52_10 a.m-9.png` | Hoja de 12 iconos |
| `…06_52_11 a.m-10.png` | Hoja de 6 ilustraciones |

> La confusión inicial entre `-1` y `-10` quedó resuelta: `-1` es el dashboard; `-10` es la hoja de ilustraciones. La app usa recortes exactos de `-10` y `-9`, no los SVG reconstruidos del kit.

## Veredicto en una frase

**Los gráficos son los correctos y la verdad financiera es sólida; lo que no coincide es la arquitectura de producto y la jerarquía visual.** La app es “Caja primero”; las referencias son “Inicio primero”. Varias pantallas de la referencia no existen como pantalla: son hojas o secciones dentro de Caja.

## Paridad por dimensión

| Dimensión | Veredicto | Detalle |
|---|---|---|
| **Gráficos** | **Media-alta** | Las 6 ilustraciones y 14 iconos son recortes exactos del usuario. El problema es el alfa derivado no documentado, el tamaño/posición y la mezcla con iconos Lucide. |
| **Funcionamiento** | **Media** | Los flujos críticos de venta, fiado, corte y verdad de pago son sólidos. Faltan pantallas/pasos de la referencia: Inicio, método de pago, QR como pantalla, historial de fiado, nueva meta. |
| **Posiciones** | **Baja** | El dashboard vive en un riel de 425 px; KPIs 2×2 de 116 px de alto; CTA de 88 px. La referencia tiene 4 KPIs en fila, CTA grande y dashboard a ancho completo. |
| **Navegación** | **Baja** | App: Caja/Fiado/Corte/Meta/Tareas. Referencia: Inicio/Ventas/Fiados/Caja/Metas o Inicio/Ventas/+/Gastos/Más. No coincide con ninguna de las dos variantes. |
| **Móvil 320/390** | **Baja-media** | El CTA de Caja queda bajo el fold; en 320 el título de Tareas se solapa con “Anotar pendiente”. Ya se corrigieron dos bugs críticos de CSS en esta pasada. |
| **Tokens/color** | **Alta** | 19 colores exactos, Fraunces+Inter, cifras tabulares y targets de 48 px. |

## Brechas P0

| ID | Brecha | Evidencia | Dueño |
|---|---|---|---|
| PAR-01 | **Inicio no es el inicio.** La app abre en Caja con el composer; el home aparece a 1,383 px de scroll. | `caja-app.tsx:2469-2676`; hoja móvil “Inicio” | `mc-shell-responsive` + producto |
| PAR-02 | **“Anotar pendiente” era invisible** (texto blanco sobre fondo blanco) y el H1 de Tareas se solapaba a 320. | `.screen-heading__action button`; reporte de posiciones | `mc-sistema-diseno` — **corregido en esta pasada** |
| PAR-03 | **`.caja-panel` no tenía padding** por conflicto de especificidad: título y total tocaban el borde. | `barrio.css:326` vs `:where(...)`; reporte de posiciones | `mc-sistema-diseno` — **corregido en esta pasada** |
| PAR-04 | **No existe pantalla “Método de pago”.** La app usa Fiar/Cobrar y una hoja posterior de link/QR. | `CajaPanel` 3560; `PaymentPanel` 4242 | `mc-ventas-pagos` |
| PAR-05 | **Pago QR no es pantalla:** es un sheet sobre Caja, sin tabs Pago QR/Escanear, sin tarjeta Total/Por cobrar ni Compartir QR. | `PaymentPanel` 4343-4428 | `mc-ventas-pagos` |
| PAR-06 | **“Nueva venta” no es pantalla:** no tiene título/back, catálogo, fotos ni unidades; el CTA sólo hace scroll. | `CajaPanel` 3249; `startNewSale` 2362 | `mc-ventas-pagos` |

## Brechas P1

| ID | Brecha | Evidencia | Dueño |
|---|---|---|---|
| PAR-07 | Dashboard miniaturizado: KPIs 2×2 de 209×116 con importe 17.6 px; referencia 4×1 de ~284×202 con importe ~40 px. | `.home-kpis`, `.home-kpi` | `mc-sistema-diseno` |
| PAR-08 | Sidebar con 5 destinos y orden distinto a la referencia; faltan Inicio/Ventas/Productos/Proveedores/Reportes. | `TABS` 7355; `AppSidebar` | `mc-shell-responsive` |
| PAR-09 | Header móvil distinto: sin wordmark, campana ni avatar; merchant truncado; DEMO cuadrado. | `TopBar` 7450 | `mc-shell-responsive` |
| PAR-10 | Accesos rápidos engañosos: “Cobrar” y “Producto” enfocan la misma venta; “Gasto” y “Reporte” llevan al mismo Corte. | `caja-app.tsx:3127-3143` | `mc-ventas-pagos` |
| PAR-11 | Fiado sin tabs Saldos/Historial, sin búsqueda, sin “Nuevo fiado” ni detalle por cliente. | `CreditList` 6586 | `mc-fiado-corte` |
| PAR-12 | Metas sólo muestra `goals[0]`, sin resumen “Ahorrado/Metas activas”, sin “Nueva meta” y sin varias tarjetas. El `POST /api/goals` existe. | `GoalCard` 6032/6055 | `mc-modulos-negocio` |
| PAR-13 | Corte sin fecha/turno visible, sin tarjeta “Saldo del día” y con el CTA “Guardar corte” a 1,607 px. | `CashCloseCard` 4970; CTA 5810 | `mc-fiado-corte` |
| PAR-14 | Probado: el CTA de Caja queda en y=839 en 390 y y=912 en 320; no entra en el primer viewport. | reporte de posiciones | `mc-shell-responsive` |
| PAR-15 | Ilustraciones con alfa derivado no documentado; `manifest.json` apunta a `web/public/brand` y dice “sin alpha”, pero la app usa `src/assets/brand/transparent`. | `manifest.json`, `README.md` | `mc-sistema-diseno` |
| PAR-16 | El QR decorativo de Ayuda se oculta <640 px; no es un QR real, pero comparte espacio con copy de cobro. | `help-qr` | `mc-sistema-diseno` |

## Brechas P2

- Iconos Lucide en nav frente a los stickers del usuario (`meta`, `libreta`, `lista`, `ayuda`, `microfono`).
- “Gasto” y “Reporte” sin destino propio; “Reporte” abre Corte.
- Fechas de fiado: muestra creación, no último movimiento.
- QR sin estado de expiración real, sin escaneo y sin “Compartir QR”.
- Corte sin selector de fecha/turno.
- Pendientes sin filtros Hoy/Semana/Todos.
- Campana/avatar/sugerencia no existen; requieren backend/datos.
- `--text-sm` 17 px, radios 14/18 vs 16, sidebar 248 vs 232, sombras y `border` ligeramente distintos.

## Lo que ya coincide y no debe rehacerse

- **Verdad financiera:** venta registrada ≠ cobrado ≠ fiado; QR solicitado ≠ verificado; demo etiquetado; corte separa efectivo/digital/fiado; meta no es custodia.
- **Gráficos exactos:** Lupita, puesto, QR, ahorro, bot y tacos son recortes reales de la hoja `-10`; los iconos son de `-9`.
- **Paleta y tipografía:** 19 colores exactos, Fraunces + Inter, cifras tabulares.
- **Componentes clave:** tarjetas de papel, CTA verde, pills de estado, bottom nav de 5, targets de 48 px, skip link, foco atrapado en hojas.
- **Flujos maduros:** venta manual sin IA, venta mixta, abono parcial, corte por denominaciones, preview del servidor, corrección con motivo, idempotencia y borradores.
- **Accesibilidad:** HIG 5 viewports, mobile 25/25, mobile-320 60/0, contraste 7/7, p0 51/0, 69/0, 66/0, 73/0.

## Diferencias válidas: NO copiar del mockup

- **No mostrar “Confirmar pago”** como botón de comerciante: sólo el webhook firmado de pey marca pagado.
- **No sembrar 5 clientes, 2 metas o $1,125**: son datos de maqueta.
- **No inventar catálogo, fotos, unidades, proveedores, campana, avatar, sugerencia o selector de comercio**: no hay backend/datos.
- **No usar la ilustración QR como QR de cobro**: el QR real viene de `QrImage`/`order.qrImage`.
- **No cambiar “Guardar corte” por “Finalizar corte”** sin revisar la política de corrección versionada.
- **No eliminar DEMO, avisos de no custodia ni “fiado no es dinero recibido”** para parecerse más a la imagen.

## Evidencia visual

- Hoja móvil lado a lado (7 pantallas):  
  `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\parity-mobile\contact-sheet-7-pantallas.png`
- Hoja Inicio (primer viewport vs home a 1,383 px):  
  `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\parity-mobile\contact-sheet-inicio-orden.png`
- Hoja escritorio referencia vs app:  
  `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\parity-desktop\00_lado_a_lado_referencia_vs_app.png`
- Métricas de escritorio:  
  `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\parity-desktop\metrics-full.json`

## Decisión necesaria antes de la siguiente ola

La brecha más grande no es CSS: es **Inicio-first vs Caja-first**. Hay dos caminos:

1. **Paridad de producto:** agregar `Inicio` como destino principal y mover la captura de venta a `Ventas`, rehaciendo la bottom nav. Implica tocar `TABS`, los E2E de 5 tabs y el shell. Es la opción más fiel a las referencias.
2. **Paridad contenida:** mantener los 5 tabs actuales, pero llevar el dashboard de Inicio al primer viewport dentro de Caja y corregir KPIs/CTA/posiciones. No rompe los gates, pero no será idéntico a la referencia.

Mi recomendación: **2 primero** (coherencia y bajo riesgo), y decidir 1 como fase separada con actualización de tests. No conviene mezclar ambas en un solo cambio.
