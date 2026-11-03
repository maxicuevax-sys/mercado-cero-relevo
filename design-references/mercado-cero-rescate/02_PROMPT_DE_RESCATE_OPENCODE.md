# CORRECCIÓN OBLIGATORIA — MERCADO CERO / PARIDAD VISUAL DE INICIO

Orquestador: detén la propagación del rediseño actual, sin descartar ni sobrescribir trabajo no confirmado. Trata este encargo como corrección de dirección de producto. NO empieces reescribiendo CSS global.

## Evidencia y fallo de partida

- Archivo canónico: `00_REFERENCIA_CANONICA_INICIO_1448x1086.png`.
- Comparación fallida: `01_DIAGNOSTICO_RECIBIDO_COMPARACION.png`.
- IZQUIERDA: pantalla `Inicio`, dashboard de negocio.
- DERECHA: pantalla `Caja`, entrada de venta.
- El screenshot NO representa una prueba de paridad: rutas diferentes y alturas de viewport diferentes.
- Debes preservar la funcionalidad real de `Caja` e implementar o corregir `Inicio` como pantalla separada.

## FASE 0 — auditoría de ruta (NO editar antes)

Devuelve en máximo 1 página:
1. ruta real actual de Inicio y la de Caja; componentes montados en cada una;
2. qué archivo controla shell/sidebar, navegación, contenido y estilos;
3. imagen de Inicio real tomada a 1448x1086 con datos DEMO controlados; screenshot de Caja aparte;
4. riesgos de cambiar rutas, stores, suscripciones y datos;
5. branch de respaldo / git status sin pisar cambios de usuario.

Si Inicio no existe, indícalo; plantea un componente nuevo que reutilice fuentes de datos, no una copia/renombrado de Caja.

## FASE 1 — inicio desktop: geometría primero

Implementa el blueprint `03_BLUEPRINT_DESKTOP_INICIO.md`. En 1448×1086 y zoom 100%, la nueva pantalla debe reproducir la COMPOSICIÓN del archivo canónico: navegación lateral verde, header horizontal, saludo, 4 KPIs en una fila, bloque principal de nueva venta + pendientes en dos columnas, sugerencia inferior. NO se permite una rail derecha con 2×2 KPIs ni colocar el formulario completo de Caja en Inicio.

Primero crea layout con cajas y datos demo claramente marcados; exige screenshot. Solo después integra tipografía, iconografía, colores e ilustraciones como elementos independientes, sin incrustar toda la referencia.

## FASE 2 — función real sin deformar diseño

Los KPIs deben conectarse a SELECTORES y datos reales, sin hardcodear los importes del mockup en producción. La prueba visual puede usar un fixture demo aislado. Cada KPI mostrará periodo y fuente, con estados vacíos y no verificados.

CTA `Nueva venta` navega al flujo de Caja/venta; no duplica lógica. `Pendientes` usa el modelo actual o estado vacío. `Sugerencia` opcional descartable sin IA obligatoria.

## FASE 3 — verificación visual

Crear capturas comparables con viewport idéntico **1448x1086**, zoom 100%, misma pantalla Inicio, fuente cargada, fecha/demo controlada. Mostrar comparación de cuatro regiones:
- sidebar+topbar,
- saludo+cuatro KPIs,
- bloque nueva venta+pendientes,
- sugerencia inferior.

No aceptar el argumento "inspiración conceptual" para justificar cambios de layout en esta ruta. Se admite diferencia por accesibilidad, tamaño real de texto o reglas financieras, pero cada diferencia debe registrarse y explicarse.

## Compromiso de calidad

- `Inicio` sigue seleccionado en sidebar durante la captura.
- `Caja` permanece como ruta separada y pasa pruebas previas.
- No modificar `PaymentProvider`, webhooks, saldos, transacciones ni conciliaciones por razones cosméticas.
- Nada de screenshots pegadas como background; UI en HTML/CSS/componentes reales.
- No inventar pagos ni datos verificados.
- Reusar activos gráficos reales si existen; si faltan, levantar lista EXACTA (no inventar sustitutos genéricos sin avisar).
- Sin edición simultánea de archivos compartidos por nueve agentes.

## Coordinación de subagentes

Una persona/agente integra el shell. Agentes especializados pueden avanzar en paralelo SOLO en tareas de lectura, evaluación, creación de SVG independientes o tests separados. El verificador NO edita. Revisión GO/NO-GO por fases.

## Entregable, sin excusas

1. diagnóstico de por qué comparaste Inicio vs Caja;
2. rutas y archivos concretos;
3. screenshots Inicio antes/Inicio después en 1448×1086;
4. checklist 0-10 de estructura, proporción, tipografía, iconos, ilustraciones y accesibilidad;
5. tests ejecutados y regresiones;
6. diferencias aceptadas por justificación documentada.

**No declaro éxito con un screenshot cuya navegación dice `Caja`, aunque tenga los colores correctos.**
