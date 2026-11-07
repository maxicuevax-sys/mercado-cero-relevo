# PROMPT: Directorio de proveedores

**Para:** `@mc-modulos-negocio` · **Prioridad:** P2

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/21_Asistente_Opcional.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `10_proveedores.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Sacar fechas, pedidos y saldos de la memoria sin generar más alertas.

## Implementación UX requerida

Listado, contacto consentido, pedido programado, saldo con proveedor, historial, lista de compras, recordatorios opcionales.

## Política de datos/seguridad

No enviar WhatsApp ni revelar compras sin autorización; contacto no autoriza compartir datos.

## Casos límite y pruebas

Proveedor sin teléfono, sin fecha, pedido parcial, reprogramado, proveedor duplicado.

## Accesibilidad

Acciones con nombre visible, fecha local explicada, no notificar de noche por defecto.

## Criterio de aceptación y devolución

Se completa pedido/reprogramación sin bot; recordatorios se silencian en hora de cobro.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
