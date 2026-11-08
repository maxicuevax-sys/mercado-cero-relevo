# Trangui: cuentas de prueba y recuperación

Base: main `9712cafff96605876ae5e51160fe03e86b35d6f6`. Una rama para el lote: `codex/judge-demo-accounts`.

## Implementado y probado

Frontera interna de base de negocio por cuenta usando AsyncLocalStorage. Cada operación tiene conexión SQLite WAL propia y directorio derivado de un identificador de cuenta validado. Cierra la conexión al terminar, incluso ante error; las tareas asíncronas desprendidas no pueden seguir usando un contexto cerrado.

No usa variables globales para elegir la cuenta. El getDb heredado sigue funcionando cuando el modo de cuentas está apagado. Si `JUDGE_DEMO_ACCOUNTS=true`, una operación sin contexto de cuenta falla antes de acceder a la base del propietario. Respaldo, reset y retención se limitan al directorio de la cuenta.

Las cuentas solo permiten DEMO_MODE=true explícito, con Pey y OpenAI sin claves. Los identificadores no se convierten directamente en rutas y se rechazan enlaces simbólicos de almacenamiento.

Ocho pruebas cubren ventas/fiados/auditoría entre dos contextos concurrentes, persistencia al reabrir, pagos demo, reset, retención de cinco backups sin tocar otra cuenta ni propietario, rechazo de proveedores activos, contexto ausente, cuenta inválida, ámbito anidado y cierre tras error/tarea desprendida. Contrato QR/abonos7/7 e identidad9/9 siguen pasando. Revisión independiente sin hallazgos bloqueantes; se añadieron pruebas para sus lagunas de cobertura.

## Avance 2: cupo atómico

Trigger SQLite BEFORE INSERT limita la tabla de usuarios a100, incluso con registros concurrentes y conexiones reabiertas. Una prueba con99 cuentas y dos registros reales reproduce dos éxitos antes de la corrección y exactamente uno después. La cuenta admitida conserva sesión; los rechazos no dejan una credencial huérfana. Esta guarda no abre el registro: la futura API deberá traducir cupo lleno a un mensaje controlado.

## Todavía cerrado

Esta función NO autentica peticiones: accountId deberá proceder exclusivamente de una sesión verificada del servidor, nunca de query/cabeceras del cliente. Con el modo apagado, acceso/registro siguen devolviendo503. El modo permanece apagado en VPS; la conexión nueva solo se habilita en la fixture aislada de pruebas. No hay cambios visuales ni de la Caja vacía aprobada.

## Trabajo restante antes de abrir el piloto

- [x] Resolver sesión Better Auth y aprovisionar cuenta con cupo100 atómico.
- [x] Vincular páginas y API a su cuenta; comprador/webhook siguen cerrados en el piloto demo.
- [x] Limpiar borradores locales y de sesión al cambiar cuenta, preservando otras aplicaciones.
- [x] Probar dos navegadores, IDs ajenos, cookies inválidas/revocación, cupo, proveedores desactivados y accesibilidad.
- [x] Herramienta local de snapshot/restauración conjunta con revocación de sesiones.
- [ ] Integrar esa recuperación en la programación real del VPS; aprovisionar la cuenta propietaria sin copiar sus ventas a las cuentas demo; canary y verificación antes de abrir Access.

No presentar este avance como registro multiusuario terminado. Se conserva la dirección visual aprobada.

## Avance 3: sesión y protección de rutas

Se conectan los formularios existentes con Better Auth solo al activar explícitamente JUDGE_DEMO_ACCOUNTS=true en un proceso demo sin credenciales Pey/OpenAI/webhook/operator. Requiere JUDGE_DATA_ROOT absoluto, APP_URL y PILOT_AUTH_SECRET server-only. Cada página/API obtiene el usuario de una cookie de sesión verificada en el servidor, nunca de IDs o cabeceras del cliente.

Todas las páginas privadas se fuerzan dinámicas y todas las operaciones API se envuelven en el contexto de base por cuenta. Checkout público, verify y webhook permanecen bloqueados en este modo demo; demo/pay sí permite simulaciones privadas dentro de la cuenta. Las respuestas privadas deshabilitan caché y validadores condicionales.

Login/registro/cierre eliminan únicamente claves mercado-cero:/trangui: de localStorage/sessionStorage y hacen navegación completa para descartar estado de otra cuenta. Cerrar sesión usa la API real y revoca la cookie anterior; el cuerpo de las respuestas no expone tokens de Better Auth.

Se conserva la UI y Caja vacía. La suite nueva prueba sesiones de dos navegadores, acceso con IDs ajenos, inventario de wrappers, revocación y limpieza de borradores. Resultado de ejecución se guarda en evidencia por SHA; no declarar aprobada antes de correrla.

Registro local funcional bajo flag no equivale a apertura pública: quedan recuperación conjunta, provisión del propietario, cuotas de uso/almacenamiento y canary antes de modificar Cloudflare/VPS.

## Correcciones verificadas durante el ensayo

El primer ensayo de navegador demostró registro/sesión y bloqueo de rutas, pero la venta autenticada devolvió503. Diagnóstico de producción: copiar la Request proxificada de Next lanzaba un error de campos privados antes de ejecutar la venta. Se conserva la Request original y se evita304 en cachedJson solamente dentro de un contexto de cuenta. La prueba de aislamiento/caché pasa; el legado conserva sus validadores.

El limitador nativo de Better Auth sigue activo.429 conserva Retry-After y se muestra su mensaje; las pruebas esperan ese intervalo, sin desactivar el límite. Los mensajes503 de registro cerrado solo se usan con sus códigos explícitos, distinguiendo cupo lleno o servicio no disponible. La prueba de dos sesiones también se añade a CI con Chromium, datos temporales y sin claves reales.

## Estado de verificación

El build `bc86102` pasó cuentas7/7, acceso legado8/8 y B172/72, con capturas390/320 inspeccionadas y árbol limpio. El bloqueo buyer404 se hace antes del render por Proxy porque notFound() en streaming puede responder200. No se cambia el flujo de comprador en modo legado.

Límites del siguiente incremento: 8MiB por base de negocio demo y32MiB para identidad, más cupo100; no se aplican a la base heredada del propietario. Ocho contratos de aislamiento/almacenamiento y nueve de identidad pasan. La guarda de almacenamiento usa max_page_count y rechaza bases ya mayores al cupo; WAL y respaldos se gestionan aparte. Fuente del mecanismo: [SQLite limits](https://sqlite.org/limits.html).

La nueva utilidad `deploy/judge-snapshot.mjs` conserva el catálogo de cuentas capturado primero, toma snapshots SQLite individuales consistentes con WAL y valida manifiesto/hashes/integridad. La restauración solo publica un directorio nuevo, revoca todas las sesiones y verifica cada copia contra el hash del manifiesto validado inicialmente, incluso si cambia transitoriamente el origen. Ver `docs/judge-recovery.md`. Resultado local:11 pruebas,10PASS y1skip explícito por privilegios Windows para symlink de archivo; la prueba de junction de directorio sí pasó. CI Linux ejecuta el conjunto completo.

El paquete de recuperación y las cuotas todavía no se han instalado en producción. El gate full23/23 no está certificado: no confundir CI/canary con un release público completo.

El Dockerfile incluye ahora ambas herramientas de snapshot en el runner. Esto prepara la imagen futura; no afirma que esté reconstruida o instalada en el VPS.

## Portabilidad de la verificación Linux

CI detectó una carrera en el propio contrato demo→real: enviaba SIGTERM sin esperar la salida y reutilizaba el puerto, por lo que su readiness podía observar el proceso anterior. Se reproducía como fetch failed en la fase FORCE, sin fallo del ledger. El cierre ahora espera exit, con límite y terminación forzada de respaldo, antes de copiar bases/reusar puertos. La regresión de proceso falló con el helper anterior y pasa con el nuevo. Se mantienen los32 checks de datos; la prueba POSIX del fallback corre en Linux y se omite explícitamente en Windows.
