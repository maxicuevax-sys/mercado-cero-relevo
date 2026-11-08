# Trangui — pantalla de acceso según referencia del usuario

Ruta nueva: `/acceso`. Fuente visual: imagen individual 941 × 1672 recibida
después de la propuesta de dos pantallas. Mantiene ilustración de tianguis,
toldo amarillo, hoja crema, marca verde, títulos serif, campos, CTA y pie demo.
La marca visible es Trangui por decisión del usuario. No se implementa la
pantalla de registro: el usuario enviará su referencia al terminar esta.

La imagen de referencia se conserva intacta; CSS muestra solamente su zona de
ilustración. Los controles y el texto son HTML accesible, no una captura con
zonas clicables. No se añade una barra de estado de teléfono ficticia.

Interacciones: mostrar/ocultar contraseña, validación de correo y longitud,
teclado, estado de envío y errores anunciados. Credenciales no van a URL,
almacenamiento local ni logs. El endpoint `/api/access/sign-in` falla cerrado
con 503 sin leer el cuerpo, abrir datos ni emitir una sesión, mientras falta
aislamiento de negocio. El CTA de registro anuncia que todavía no está abierto.
Esto es una implementación de pantalla, no activación de cuentas multiusuario.

La prueba inicial falló por ruta ausente (RED). La prueba en desarrollo detectó
recargas continuas de Fast Refresh; las pruebas finales usan build de producción.
Tras `npm run build` en un árbol limpio, `npm run test:access-ui` exige SHA
servido igual a HEAD y comprueba comportamiento y axe a 390×693, 320×569 y
1448×1086; conserva capturas en `harness/evidence/runs/trangui-access/`.
Su informe JSON queda en `web/test-results/access-results.json`.

Trabajo exclusivo de `codex/trangui-setup`: no modifica la rama de Diego, el
checkout/servidor 4580 de DSH ni el VPS. Sin merge. Estado definitivo y SHA en
la evidencia generada después del commit limpio.
