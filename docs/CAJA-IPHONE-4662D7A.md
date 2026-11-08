# Caja en iPhone: continuidad y evidencia

Producción comprobada el 8 de noviembre de 2026: `4662d7a99e2a4d46fba0b9dc7fc4e018687e6f82`. Esta revisión parte de `5e0b307` y conserva sus correcciones de acceso, centavo demo, ilustración, Pendientes y servicio STT.

## Cambios y prueba

- Caja tenía dos manejadores de errores que volvían a acceder a localStorage después de que el navegador lo rechazara. El primero impedía habilitar los controles. Ahora la limpieza fallida no interrumpe la hidratación.
- El cambio de cuenta tolera el getter de almacenamiento denegado, pero sigue rechazando un almacenamiento legible que no se puede limpiar: no se oculta el riesgo de reutilizar estado anterior.
- Interpretar reconoce unidades y nombres de varias palabras en todas las frases que ofrece BUSINESS_PRESETS. Conserva el parser de catálogo y los abonos.
- Parser, deuda y almacenamiento: 37/37 PASS. Gate fast: 3/3 PASS en árbol limpio de 4662d7a, evidencia local `harness/evidence/runs/2026-11-08T23-39-40-931Z-fast.json`.
- Docker build de producción: PASS, BUILD_SHA completo. Imagen `sha256:5db2d141d292986c6ee169d44b837ef5712da862cc5e992ef48370e9459fd477`.
- Canary aislado 4599: Chromium y WebKit, 390 px, almacenamiento denegado: campo editable, interpretación con endpoint real, error de micrófono explícito, ninguna creación automática de orden. WebKit emulado, no iPhone físico. La primera prueba en dev fue inestable; la evidencia afirmada corresponde al bundle de producción del canary.
- HTTP/API canary y sitio público: dos invitados aislados, tres frases interpretadas, QR de un centavo demo, pago `demo_paid`, diez rutas HTTP 200. Esto no acredita todos sus controles ni todos sus flujos.
- Health público devuelve el SHA entregado; STT sigue activo. No se ejecutaron pagos reales.

## Despliegue y recuperación

Se cambió solamente imagen/SHA del compose existente; se conservaron montaje de datos, configuración STT y resto de entorno. Respaldo previo y rollback: `/opt/mercado-cero/public-emoji/rollback-access-4662d7a99e2a-20261108T234510Z`. El verificador confirmó que se conservaron los registros anteriores. Rollback no ejecutado.

Los chunks de Next llevan hash. El build público se comprobó después del cambio; no se purgaron cachés ajenas ni se alteró DNS.

## CI y alcance pendiente

CI encontró pruebas heredadas que todavía exigían contraseñas de 12 a 128 caracteres, aunque esa política ya había cambiado en 5e0b307. Esta revisión documental actualiza esas pruebas: aceptan 1, 129 y 1024 caracteres, conservan las pruebas de origen ajeno y el límite de cuentas; el grupo local actualizado pasa 13/13. El esquema upstream sigue requiriendo una credencial no vacía; existe entrada invitada separada. No se declara acceso registrado con contraseña vacía.

La revisión completa solicitada de todas las secciones y flujos en escritorio y celular sigue pendiente. No hay certificación de Safari/iPhone físico, full/static completo, todos los escenarios de recuperación ni pago real. Los cambios posteriores de este informe y tests no modifican la aplicación del build 4662d7a.
