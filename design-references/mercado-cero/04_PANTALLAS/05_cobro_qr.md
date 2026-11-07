# Solicitud de cobro digital / QR

**Prioridad:** P0 · **Agente dueño:** `mc-ventas-pagos` · **Referencia:** `01_REFERENCIAS/recortes/03_Sistema_Diseno.png`

## Problema humano y tarea

Mostrar importes, referencia y estado de solicitud digital, sin falsas garantías.

## Jerarquía y componentes propuestos

Encabezado Cobro digital; importe grande; QR real solo si provider devuelve payload; referencia opcional; estado textual «Esperando pago»; botón «Verificar estado»; alternativa si no hay internet.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

QR dibujado = solicitud, no comprobante. Webhook firmado/verificado y/o consulta al proveedor; idempotencia; reconciliación y timeout; si no se integra pey, modo simulado con marca DEMO inequívoca.

## Estados y situaciones de prueba

QR expirado; pago rechazado; webhook repetido; consulta fallida; red inestable; pago verificado después del cierre; pago doble.

## Accesibilidad

Alt textual con referencia/cantidad y alternativa a escaneo; no depender de sonido; cambios de estado accesibles sin anuncios repetidos.

## Definition of Done

Todos los escenarios pendientes/expirado/verificado/duplicado pasan pruebas; en demo se ve la etiqueta SIMULADO si aplica.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
