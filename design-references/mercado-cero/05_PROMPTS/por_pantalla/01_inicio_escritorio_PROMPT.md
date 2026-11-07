# PROMPT: Resumen del negocio (escritorio)

**Para:** `@mc-shell-responsive` · **Prioridad:** P1

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/02_Dashboard_Desktop.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `01_inicio_escritorio.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Mostrar situación operativa del día, 1 acción primaria, tareas urgentes y condiciones verificadas; NO reproducir todos los módulos como tarjetas aleatorias.

## Implementación UX requerida

Topbar con negocio y sesión; sidebar con etiquetas; saludo opcional; cuatro KPIs con explicaciones; acción principal Nueva venta; tareas de hoy; sugerencia contextual que pueda cerrarse; acceso a cierre y reportes.

## Política de datos/seguridad

Métricas: venta registrada, cobrado confirmado, por cobrar, meta virtual. Cifras en enteros menores, periodo explícito, comparación solo con datos suficientes. La suma de ventas no debe sustituir dinero disponible.

## Casos límite y pruebas

Sin ventas: CTA «Registrar primera venta»; sin conexión: banner sobrio; sin costos: utilidad no calculable; datos discrepantes: estado de revisión. No usar ilustración de resultados financieros como prueba de pago.

## Accesibilidad

Lectura por teclado orden natural de título→métricas→acción→tareas; indicadores con label y unidad, gráficos con alternativa textual y tabla.

## Criterio de aceptación y devolución

En viewport de 375px la acción principal es visible y no hay scroll horizontal; 200% zoom conserva datos; pantalla de inicio no obliga a usar IA.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
