# Trangui: integración selectiva del PR de Diego

Base: `ab5732a`. Revisión entrante: `diego/onboarding`, `36db0d2`, PR #6.
La rama entrante tiene cuatro commits propios y no incluye veinte commits de main.
No se importaron archivos completos ni se modificó la rama de Diego.

## Incluido

- Ideas de `9845ed6`: montos de $20/$50/$100/$200 al borrador, un concepto editable
  por pulsación, sin crear pedidos; efectivo exacto explícito usando el ejecutor
  actual, validación, locks, límites e idempotencia. Caja inicial sigue vacía.
- El atajo solo puede operar en efectivo. No convierte Digital/Mixto ni reemplaza
  un efectivo introducido que requiera cambio. Conserva registro normal y descarte
  accesible; los estados demo no se presentan como confirmación bancaria.
- Adaptación de `f924214`: tolera el tick que acorta una sesión, manteniendo el
  límite superior de 24 horas. La autoría original está reconocida en el commit.
- Correcciones necesarias del ejecutor compartido: persistir efectivo exacto antes
  del envío; evitar bloqueo permanente en el retorno por resultado incierto de
  otra pestaña; mantener llave y borrador tras consulta 404; publicar comprobante
  compartido antes de limpiar una reconciliación exitosa. La siguiente venta
  legítima recibe una instancia nueva para permitir operaciones idénticas reales.

## Excluido por revisión

- `36db0d2`: endpoint de subcuentas sin contrato verificado, éxito/ID fabricado al
  fallar y metadata que no selecciona banco por comerciante. Los guardas demo y
  todo el código de proveedor, autenticación, aislamiento y API se conservan.
- Cash en el hub CoDi: generaba llave nueva por reintento y podía duplicar ventas.
- Etiquetas de Tarjeta/QR que ejecutaban efectivo y confirmar tras setState usando
  estado anterior. El atajo nuevo pasa el importe explícitamente al ejecutor.
- `e1483cf`: sustitución global de fuentes, shell universal y cambios de navegación
  que perderían las correcciones actuales de sidebar y composiciones móviles.

Revisión formal solicitando cambios:
https://github.com/maxicuevax-sys/mercado-cero-relevo/pull/6#pullrequestreview-5818590131
Integración segura revisable: PR #11.

## Evidencia

Implementación funcional `9c9f143`: static 5/5, seguridad 58/58, demo-pay 66/66,
identidad 9/9, B1 78/78. Los dos jobs de CI están en verde, incluido Playwright
completo 18/18; la corrida local focalizada de los seis escenarios nuevos también
pasó 6/6. Las aserciones existentes se conservaron. El helper de prueba móvil usa
el botón visible Más para abrir el formulario, como el recorrido real.

Se prueban: navegación de sidebar 1448/1280, monto editable sin POST, descarte,
doble clic y bloqueo durante envío, replay idempotente, prohibición en Digital y
Mixto, 320/390 con axe y controles >=44px, recibido100/cambio80, respuesta503 con
commit + recuperación + pestaña precargada, venta nueva idéntica válida y503 sin
commit + recarga + consulta404 + retry con payload/llave idénticos.

Revisión independiente de código y diez capturas: sin P1/P2 nuevo atribuible al
lote. Las capturas largas incluyen posiciones de elementos sticky/fijos y foco
que no deben confundirse con prueba de un sidebar redimensionado. Persiste la
estrechez preexistente de la fila de producto en320, fuera de estos cambios.
Son pruebas Chromium emuladas, no prueba física/Safari ni aprobación humana de UX.

Evidencia local: `harness/evidence/runs/diego-selective-integration/`.
El harness final debe verificar el SHA del HEAD entregado y el árbol limpio.

## Límites y reversión

No despliega en el VPS, no reinicia4582, no activa credenciales ni certifica un
pago real con Pey. Full23 sigue sin certificarse: sus suites legacy necesitan
migración. No se debe confundir CI demo verde con prueba bancaria productiva.
Rollback: revertir el lote conservando datos, pedidos y evidencia. No necesita
migraciones de base ni restaurar una base anterior sobre ventas nuevas.
