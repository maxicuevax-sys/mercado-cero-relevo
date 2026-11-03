# PROMPT: Corte de caja

**Para:** `@mc-fiado-corte` · **Prioridad:** P0

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/20_Corte_Caja_Movil.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `07_corte_caja.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Cerrar turno o día con suma de efectivo esperado, contado por billetes/monedas, gastos y retiros, sin mezclar digital.

## Implementación UX requerida

Fecha/turno; efectivo esperado; digital confirmado por separado; gastos y retiros; entrada por denominación; resultado coincide/sobra/falta; explicación; CTA Cerrar caja con confirmación.

## Política de datos/seguridad

Los billetes y monedas son denominaciones MXN configurables; digital verificado no es efectivo de cajón; abonos en efectivo alteran efectivo pero no ventas nuevas; salidas de caja separadas de gastos.

## Casos límite y pruebas

Cambio inicial, corte parcial, retiro de caja, gasto, fiado cobrado, pagos pendientes, discrepancia, sesión ajena.

## Accesibilidad

Tabla textual con denominación y cantidad, campo numérico accesible, errores precisos, confirmación de cierre reversible solo con política explícita.

## Criterio de aceptación y devolución

Tres escenarios de conciliación sin diferencia y con sobrante/faltante; cifras rastreables a movimientos.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
