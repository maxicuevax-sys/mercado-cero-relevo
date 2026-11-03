# PROMPT: Fiado / clientes / abonos

**Para:** `@mc-fiado-corte` · **Prioridad:** P0

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/19_Libreta_Fiados_Movil.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `06_fiado.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Reemplazar una libreta de deudas sin perder el lenguaje familiar y sin confundir ventas pendientes con ingresos cobrados.

## Implementación UX requerida

Saldo total y clientes, barra buscar; cada cliente nombre + saldo + fecha de último movimiento; detalle con movimientos cronológicos; CTA Registrar fiado / Registrar abono separados.

## Política de datos/seguridad

Crear fiado es venta con saldo por cobrar; abono antiguo reduce deuda y puede aumentar cobrado del día sin crear venta nueva. Mantener registro auditado de correcciones.

## Casos límite y pruebas

Cliente homónimo, abono parcial, saldo cero, condonación, cancelación, fecha previa, offline, rol sin permiso.

## Accesibilidad

Saldos con texto y moneda, secuencia cronológica por lector de pantalla, acciones de edición explican consecuencias.

## Criterio de aceptación y devolución

Saldo no se vuelve negativo sin política definida; abono parcial correcto, rectificaciones con auditoría.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
