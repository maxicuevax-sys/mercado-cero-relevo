# PROMPT: Reportes simples

**Para:** `@mc-modulos-negocio` · **Prioridad:** P2

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/23_Reportes_Simples.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `12_reportes.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Dar contexto para decidir, sin sobrecargar con gráficos ni comparar mal.

## Implementación UX requerida

Ventas registradas, cobros, deudas, gastos, utilidad solo si costos suficientes; periodo y filtros; explicación textual junto a gráfico y tabla.

## Política de datos/seguridad

No confundir ventas con efectivo; comparaciones solo con periodos equivalentes y cobertura de datos fiable.

## Casos límite y pruebas

Sin registros, registros incompletos, montos negativos, fechas fuera de zona horaria, importación parcial.

## Accesibilidad

Tabla alternativa con unidades, tooltip accesible, grafico no único portador de información.

## Criterio de aceptación y devolución

Mismas cifras en tabla y gráfico; ninguna recomendación financiera si datos insuficientes.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
