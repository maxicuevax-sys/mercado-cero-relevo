# PROMPT: Nueva venta / composición de ticket

**Para:** `@mc-ventas-pagos` · **Prioridad:** P0

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/18_Nueva_Venta_Movil.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `03_nueva_venta.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Registrar una venta rápidamente por catálogo o descripción manual, con dictado solo si está autorizado y disponible.

## Implementación UX requerida

Título Nueva venta; campo «¿Qué vendiste?»; catálogo reciente opcional; lista de ítems editable; total tabular visible; CTA seleccionar cómo pagar; indicador de borrador si interrumpida.

## Política de datos/seguridad

El importe/total se calcula una vez en lógica de negocio; registrar venta NO significa haber recibido dinero. La IA propone interpretación y el usuario CONFIRMA productos, cantidades y precios.

## Casos límite y pruebas

Input vacío, producto inexistente, dictado erróneo, sin conexión, borrador recuperado, IVA según configuración del comercio, retorno desde llamada.

## Accesibilidad

Labels visibles, inputmode decimal adecuado MXN, botones +/- accesibles, errores conectados con aria-describedby, sin texto incrustado en ilustraciones.

## Criterio de aceptación y devolución

Registrar y corregir venta con una mano; confirmar cambios; no duplica folio tras reintento; test de importes mayores y decimales.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
