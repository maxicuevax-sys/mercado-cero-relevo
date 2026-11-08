# Trangui: cuentas de prueba, avance 1

Base: main `9712cafff96605876ae5e51160fe03e86b35d6f6`. Una rama para el lote: `codex/judge-demo-accounts`.

## Implementado y probado

Frontera interna de base de negocio por cuenta usando AsyncLocalStorage. Cada operación tiene conexión SQLite WAL propia y directorio derivado de un identificador de cuenta validado. Cierra la conexión al terminar, incluso ante error; las tareas asíncronas desprendidas no pueden seguir usando un contexto cerrado.

No usa variables globales para elegir la cuenta. El getDb heredado sigue funcionando cuando el modo de cuentas está apagado. Si `JUDGE_DEMO_ACCOUNTS=true`, una operación sin contexto de cuenta falla antes de acceder a la base del propietario. Respaldo, reset y retención se limitan al directorio de la cuenta.

Las cuentas solo permiten DEMO_MODE=true explícito, con Pey y OpenAI sin claves. Los identificadores no se convierten directamente en rutas y se rechazan enlaces simbólicos de almacenamiento.

Seis pruebas cubren ventas/fiados/auditoría entre dos contextos concurrentes, persistencia al reabrir, pagos demo, reset, retención de cinco backups sin tocar otra cuenta ni propietario, rechazo de proveedores activos, contexto ausente, cuenta inválida, ámbito anidado y cierre tras error/tarea desprendida. Contrato QR/abonos7/7 e identidad8/8 siguen pasando. Revisión independiente sin hallazgos bloqueantes; se añadieron pruebas para sus lagunas de cobertura.

## Todavía cerrado

Esta función NO autentica peticiones: accountId deberá proceder exclusivamente de una sesión verificada del servidor, nunca de query/cabeceras del cliente. Acceso/registro públicos siguen devolviendo503. No se activa el modo de cuentas ni se cambia el VPS. No hay cambios visuales ni de la Caja vacía aprobada.

## Trabajo restante antes de abrir el piloto

- Resolver sesión Better Auth y aprovisionar cuenta de forma atómica con cupo100.
- Vincular todas las páginas y API a su cuenta; endpoints públicos de comprador/webhook permanecen cerrados para el piloto multiusuario demo.
- Separar o limpiar borradores/localStorage al cambiar sesión para no mostrar datos de otra cuenta en la misma computadora.
- Probar dos navegadores/sesiones, IDs ajenos, expiración/revocación, cuotas y falta de credenciales.
- Respaldar/restaurar conjuntamente identidad y bases; migrar propietario sin copiar sus ventas a cuentas demo. Canary y verificación antes de apertura.

No presentar este avance como registro multiusuario terminado. Se conserva la dirección visual aprobada.
