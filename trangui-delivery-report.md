# Trangui: cierre de entrega del 8 de noviembre

Base: c6fe036, PR12 integrado. La revisión visual detectó un problema previo en Caja a 320px: una columna reservada para una ilustración inexistente reducía demasiado el nombre de un producto manual. El parche elimina esa columna solo para filas sin ilustración a un ancho máximo de 360px. Conserva el reflujo de texto ampliado, los controles y las filas con imagen; no cambia lógica financiera ni otras pantallas.

Comprobación exigida: construir el SHA limpio, ejecutar los contratos existentes quick-sale y revisar sus capturas 320/390/1280/1448 antes de certificar el cambio. Los resultados exactos quedan en `harness/evidence/latest-static.json`, `web/test-results/judge-results.json` y `harness/evidence/runs/trangui-delivery/`. Una corrida anterior no prueba este parche.

El diagnóstico inicial confirmó que la preview4582, el origen público4590 y el candidato privado4596 servían versiones diferentes, todas anteriores al código integrado. No presentar el build de GitHub como si ya estuviera publicado. La publicación requiere imagen inmutable, respaldo conjunto, conservación de datos/secreto, comprobación externa y rollback al origen anterior. Los registros de esa operación se guardarán como evidencia, sin secretos.

Pagos reales con Pey e impacto social medido siguen sin validación. La demo no debe presentarlos como resultados. No añadir integraciones ni rediseños nuevos durante el cierre.
