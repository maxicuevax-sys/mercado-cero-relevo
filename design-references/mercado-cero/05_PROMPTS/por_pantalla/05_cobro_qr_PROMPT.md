# PROMPT: Solicitud de cobro digital / QR

**Para:** `@mc-ventas-pagos` · **Prioridad:** P0

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/03_Sistema_Diseno.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `05_cobro_qr.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Mostrar importes, referencia y estado de solicitud digital, sin falsas garantías.

## Implementación UX requerida

Encabezado Cobro digital; importe grande; QR real solo si provider devuelve payload; referencia opcional; estado textual «Esperando pago»; botón «Verificar estado»; alternativa si no hay internet.

## Política de datos/seguridad

QR dibujado = solicitud, no comprobante. Webhook firmado/verificado y/o consulta al proveedor; idempotencia; reconciliación y timeout; si no se integra pey, modo simulado con marca DEMO inequívoca.

## Casos límite y pruebas

QR expirado; pago rechazado; webhook repetido; consulta fallida; red inestable; pago verificado después del cierre; pago doble.

## Accesibilidad

Alt textual con referencia/cantidad y alternativa a escaneo; no depender de sonido; cambios de estado accesibles sin anuncios repetidos.

## Criterio de aceptación y devolución

Todos los escenarios pendientes/expirado/verificado/duplicado pasan pruebas; en demo se ve la etiqueta SIMULADO si aplica.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
