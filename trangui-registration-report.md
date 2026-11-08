# Trangui — registro según segunda referencia

Ruta `/registro`, enlazada desde el acceso y con regreso real a `/acceso`.
Referencia individual del usuario 1024×1535: toldo rojo, taquero, papel crema,
campos con iconos y botón verde. **El título «Crea tu cuenta» es negro** por
decisión expresa del usuario; no hereda el verde de la imagen.

La ilustración usa la imagen fuente intacta con recorte/máscara CSS; todos los
controles y textos son HTML. Validación de nombre, correo y contraseña 12–128,
mostrar/ocultar, navegación con teclado y errores anunciados. El endpoint
permanece cerrado (503 sin leer cuerpo, guardar credenciales ni emitir sesión)
hasta terminar el aislamiento de negocio y su recuperación. No se presenta
la cuenta como creada ni se habilitan cobros reales.

Pruebas: `test:register-validation` (RED por módulo ausente antes de implementar)
y ampliación de `test:access-ui` para ambos flujos, título negro, axe y capturas
390/320/1448. Evidencia final vinculada al SHA limpio de integración.

Integración autorizada por el usuario, sin sobrescribir la rama de Diego.
PR #3 recibió cambios solicitados: moneda ausente aceptada, paid fuera del
webhook firmado y paleta Slate contraria a la base elegida. Revisión:
https://github.com/maxicuevax-sys/mercado-cero-relevo/pull/3#pullrequestreview-5816239002
