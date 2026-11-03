# Verificador final — GO/NO-GO

Inspecciona diff contra baseline, archivos afectados, test runner real y referencias visuales. **No edites código.** Comprueba:

A) Venta de $70 efectivo cobrada con $100: cambio $30, entrada de caja $70 y venta $70 una sola vez.
B) Venta de $120 a fiado: venta registrada $120; efectivo 0; por cobrar +$120.
C) Abono posterior $50 en efectivo al fiado: por cobrar -$50, efectivo +$50; ventas nuevas 0.
D) QR emitido pero no confirmado: cobrado digital 0; estado PENDIENTE.
E) Dos webhooks idénticos válidos: un solo efecto en libro.
F) QR expirado/offline: jamás estado «pago verificado».
G) Cierre: efectivo esperado ≠ digital verificado; gasto y retiro de caja diferenciados.
H) Meta virtual: no aparece como saldo bancario custodiado.
I) Sin AI, micrófono denegado o conexión: registrar venta manual sigue disponible.
J) Accesibilidad: teclado, foco, TalkBack/NVDA manual si disponible, zoom, contraste, etiquetas visibles.
K) Demo: datos ficticios segregados y claramente marcados.
L) Modelo/seguridad: sin secretos o tokens PSP en bundle frontend ni logs.

**Resultado:** tabla de gates con evidencia de prueba, severidad, archivos y decisión GO, GO CON RIESGOS o NO-GO. No declarar test aprobado si no corriste el escenario. Devuelve instrucciones de reparación por módulo.
