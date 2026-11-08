# Trangui: cierre de entrega del 8 de noviembre

Base: c6fe036, PR12 integrado. La revisión visual detectó un problema previo en Caja a 320px: una columna reservada para una ilustración inexistente reducía demasiado el nombre de un producto manual. El parche elimina esa columna solo para filas sin ilustración a un ancho máximo de 360px. Conserva el reflujo de texto ampliado, los controles y las filas con imagen; no cambia lógica financiera ni otras pantallas.

Comprobación exigida: construir el SHA limpio, ejecutar los contratos existentes quick-sale y revisar sus capturas 320/390/1280/1448 antes de certificar el cambio. Los resultados exactos quedan en `harness/evidence/latest-static.json`, `web/test-results/judge-results.json` y `harness/evidence/runs/trangui-delivery/`. Una corrida anterior no prueba este parche.

El diagnóstico inicial confirmó que la preview4582, el origen público4590 y el candidato privado4596 servían versiones diferentes, todas anteriores al código integrado. No presentar el build de GitHub como si ya estuviera publicado. La publicación requiere imagen inmutable, respaldo conjunto, conservación de datos/secreto, comprobación externa y rollback al origen anterior. Los registros de esa operación se guardarán como evidencia, sin secretos.

Pagos reales con Pey e impacto social medido siguen sin validación. La demo no debe presentarlos como resultados. No añadir integraciones ni rediseños nuevos durante el cierre.

## Preparación operativa posterior

El producto 56684e1 pasó estático 5/5 y navegador 18/18, con revisión visual independiente de Caja320/390/1448. El PR13 quedó integrado como 2d0d405 con el mismo árbol de producto. La imagen Linux de ese producto es `sha256:33541404847d81d9e6904c653c16a0077ac472e4a5276ee6c2f8963b3d389e77`; el primer build con 2GiB agotó el tiempo en tipos, y el segundo con 4GiB, swap total igual a RAM y 1.5CPU terminó sin omitir checks.

La actualización privada de 4596 conservó exactamente 1 usuario, 1 sesión, 1 base de negocio, 15 pedidos y 14 pagos. Validador de configuración/imagen/persistencia y sesión anónima401 aprobados. Configuración e imagen anteriores conservadas para rollback. Esto todavía no acredita publicación externa.

El cierre encontró tres dependencias operativas: el script Windows reinterpretaba fechas tipadas de PowerShell7 según idioma; el backup principal suponía una base legacy activa; los monitores esperaban redirección de CloudflareAccess. Se corrigieron sin cambiar el producto: 37 contratos en cada PowerShell5/7 y 27 contratos Linux de archivo legacy/watchdog/Kuma. Revisión independiente sin P1/P2. La restauración externa real pasó tras instalar el fix Windows, con la cuenta y negocio restaurados y una sesión revocada.

El archivo legacy se conserva como snapshot SQLite independiente e inmutable verificado por hash, permisos e integridad; nunca se monta en la app web nueva. El modo público exige además el respaldo conjunto de cuentas. Kuma reutiliza el ID y configuración del monitor, y el watchdog exige salud HTTPS del SHA objetivo y sesión anónima401. El propietario autorizó publicar la demo para jueces; no se abrirá Access mientras el origen siga siendo legacy. Para revertir al piloto09, restablecer primero la barrera Access y después la configuración anterior.

La activación pública y sus resultados se registran aparte bajo `harness/evidence/runs/trangui-delivery/`; este informe no presenta una acción preparada como si ya hubiera ocurrido. El SHA del producto servido puede ser 56684e1, contenido en los merges posteriores que solo añaden operación y evidencia; comprobar siempre `/api/health` contra el objetivo explícito del despliegue.
