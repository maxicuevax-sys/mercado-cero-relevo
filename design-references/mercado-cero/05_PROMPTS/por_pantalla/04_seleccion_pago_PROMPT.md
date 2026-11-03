# PROMPT: Seleccionar forma de pago

**Para:** `@mc-ventas-pagos` · **Prioridad:** P0

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/18_Nueva_Venta_Movil.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `04_seleccion_pago.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Distinguir claramente efectivo, digital, fiado y pagos mixtos si el modelo financiero existente los soporta.

## Implementación UX requerida

Resumen no editable de total arriba; opciones con icono + descripción («entra a caja», «esperando banco», «queda por cobrar»); CTA que cambie según método.

## Política de datos/seguridad

Si es fiado se registra cuenta por cobrar; si es efectivo se confirma recibido/entregado; si es digital QR no equivale a pago verificado. Pagos parciales: saldo y sumatoria explícitos.

## Casos límite y pruebas

Pagos mixtos con suma distinta del total; moneda MXN; cancelación durante solicitud; usuario desconectado.

## Accesibilidad

Radio-group nativo o equivalente ARIA, labels completos; sin controles seleccionados solo por color.

## Criterio de aceptación y devolución

El usuario puede explicar la diferencia entre pago pendiente y verificado sin ayuda; no se marca un pago digital como recibido por elegir método.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
