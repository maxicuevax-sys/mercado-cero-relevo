# PROMPT: Productos e inventario

**Para:** `@mc-modulos-negocio` · **Prioridad:** P1

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/23_Reportes_Simples.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `09_inventario.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Reducir memorización de existencias, facilitar venta por producto, alinear compras.

## Implementación UX requerida

Buscar productos, categorías simples, disponibilidad, unidad, precio, costo opcional, alerta por bajo inventario configurable, nuevo producto.

## Política de datos/seguridad

Descuento de stock vinculado a venta registrada según reglas; no asumir inventario preciso para puestos que no lo registran; venta por importe libre permanece disponible.

## Casos límite y pruebas

Productos sin stock, unidades mixtas, vender sin inventario, corrección manual, duplicado, compras con proveedores.

## Accesibilidad

Búsqueda tolerante, lectura de unidades, controles +/-, soporte de teclado y una mano.

## Criterio de aceptación y devolución

No obliga a catalogar para cobrar; inventario nunca muestra certeza cuando falta registro.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
