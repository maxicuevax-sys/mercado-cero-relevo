# Trangui: cuentas de prueba, avance 1

Base: main `9712cafff96605876ae5e51160fe03e86b35d6f6`. Una rama para el lote: `codex/judge-demo-accounts`.

## Implementado y probado

Frontera interna de base de negocio por cuenta usando AsyncLocalStorage. Cada operación tiene conexión SQLite WAL propia y directorio derivado de un identificador de cuenta validado. Cierra la conexión al terminar, incluso ante error; las tareas asíncronas desprendidas no pueden seguir usando un contexto cerrado.

No usa variables globales para elegir la cuenta. El getDb heredado sigue funcionando cuando el modo de cuentas está apagado. Si `JUDGE_DEMO_ACCOUNTS=true`, una operación sin contexto de cuenta falla antes de acceder a la base del propietario. Respaldo, reset y retención se limitan al directorio de la cuenta.

Las cuentas solo permiten DEMO_MODE=true explícito, con Pey y OpenAI sin claves. Los identificadores no se convierten directamente en rutas y se rechazan enlaces simbólicos de almacenamiento.

Seis pruebas cubren ventas/fiados/auditoría entre dos contextos concurrentes, persistencia al reabrir, pagos demo, reset, retención de cinco backups sin tocar otra cuenta ni propietario, rechazo de proveedores activos, contexto ausente, cuenta inválida, ámbito anidado y cierre tras error/tarea desprendida. Contrato QR/abonos7/7 e identidad9/9 siguen pasando. Revisión independiente sin hallazgos bloqueantes; se añadieron pruebas para sus lagunas de cobertura.

## Avance 2: cupo atómico

Trigger SQLite BEFORE INSERT limita la tabla de usuarios a100, incluso con registros concurrentes y conexiones reabiertas. Una prueba con99 cuentas y dos registros reales reproduce dos éxitos antes de la corrección y exactamente uno después. La cuenta admitida conserva sesión; los rechazos no dejan una credencial huérfana. Esta guarda no abre el registro: la futura API deberá traducir cupo lleno a un mensaje controlado.

## Todavía cerrado

Esta función NO autentica peticiones: accountId deberá proceder exclusivamente de una sesión verificada del servidor, nunca de query/cabeceras del cliente. Con el modo apagado, acceso/registro siguen devolviendo503. El modo permanece apagado en VPS; la conexión nueva solo se habilita en la fixture aislada de pruebas. No hay cambios visuales ni de la Caja vacía aprobada.

## Trabajo restante antes de abrir el piloto

- Resolver sesión Better Auth y aprovisionar cuenta; el cupo100 ya tiene guarda atómica en SQLite.
- Vincular todas las páginas y API a su cuenta; endpoints públicos de comprador/webhook permanecen cerrados para el piloto multiusuario demo.
- Separar o limpiar borradores/localStorage al cambiar sesión para no mostrar datos de otra cuenta en la misma computadora.
- Probar dos navegadores/sesiones, IDs ajenos, expiración/revocación, cuotas y falta de credenciales.
- Respaldar/restaurar conjuntamente identidad y bases; migrar propietario sin copiar sus ventas a cuentas demo. Canary y verificación antes de apertura.

No presentar este avance como registro multiusuario terminado. Se conserva la dirección visual aprobada.

## Avance 3: sesión y protección de rutas

Se conectan los formularios existentes con Better Auth solo al activar explícitamente JUDGE_DEMO_ACCOUNTS=true en un proceso demo sin credenciales Pey/OpenAI/webhook/operator. Requiere JUDGE_DATA_ROOT absoluto, APP_URL y PILOT_AUTH_SECRET server-only. Cada página/API obtiene el usuario de una cookie de sesión verificada en el servidor, nunca de IDs o cabeceras del cliente.

Todas las páginas privadas se fuerzan dinámicas y todas las operaciones API se envuelven en el contexto de base por cuenta. Checkout público, verify y webhook permanecen bloqueados en este modo demo; demo/pay sí permite simulaciones privadas dentro de la cuenta. Las respuestas privadas deshabilitan caché y validadores condicionales.

Login/registro/cierre eliminan únicamente claves mercado-cero:/trangui: de localStorage/sessionStorage y hacen navegación completa para descartar estado de otra cuenta. Cerrar sesión usa la API real y revoca la cookie anterior; el cuerpo de las respuestas no expone tokens de Better Auth.

Se conserva la UI y Caja vacía. La suite nueva prueba sesiones de dos navegadores, acceso con IDs ajenos, inventario de wrappers, revocación y limpieza de borradores. Resultado de ejecución se guarda en evidencia por SHA; no declarar aprobada antes de correrla.

Registro local funcional bajo flag no equivale a apertura pública: quedan recuperación conjunta, provisión del propietario, cuotas de uso/almacenamiento y canary antes de modificar Cloudflare/VPS.
