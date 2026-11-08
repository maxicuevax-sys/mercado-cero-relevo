# Trangui: integración de infraestructura del piloto

## Estado comprobado

No faltaba un paquete de producción demostrado. La diferencia principal era que
el origen público seguía en otro build y las cuentas solo estaban conectadas a un
ensayo temporal. Better Auth está incluido en el bundle standalone; comprobarlo
solo con `require.resolve()` desde la raíz de ese bundle daba una conclusión falsa.

| Componente | Estado y límite de la comprobación |
| --- | --- |
| Aplicación pública | `09b4f8d1aa63f40682e2e4082034fe952a1dd1e2`, puerto loopback 4590, sin cambio de origen, DNS ni Access. |
| Candidato persistente | Build `cb40d600f4e9a7c21eb189f00ab3865614ad0de7`, imagen `sha256:c2a9d4f0d9d9b94a9baadb96fc04aca0882744932efce103400abf57f823d238`, contenedor `mercado-cero-judge-release`, loopback 4596. |
| Runtime | Node 24, `node server.js`; filesystem de aplicación de solo lectura, UID 1000, datos persistentes propios y cache temporal acotada. |
| Recursos del candidato | 512 MiB RAM, 512 MiB RAM+swap, 0.5 CPU, 128 procesos, sin capacidades añadidas; reinicio `unless-stopped`. |
| Better Auth | Registro, inicio de sesión, consulta autenticada, rechazo de origen ajeno, logout y rechazo del replay probados en la imagen real. Sesión y SQLite sobreviven un reinicio controlado del contenedor. |
| Cookies | Flags Secure, HttpOnly y SameSite=Lax comprobados con origen configurado HTTPS. El transporte de esa prueba fue HTTP loopback: no certifica aún la cadena HTTPS del navegador público. |
| Datos | Identidad y negocio separados, integridad SQLite aprobada; no se creó la base legacy deshabilitada. Hay una cuenta ficticia de QA en este candidato privado. |
| Respaldos | El hook de cuentas apunta ahora al candidato persistente. El snapshot conjunto cifrado incluye su identidad, negocio y configuración de recuperación, además de la base pública y Coolify. La copia externa fue leída y restaurada; se conservó la cuenta de QA y se revocó una sesión restaurada. Los snapshots anteriores se conservaron. |
| Monitoreo | Readiness y watchdog usan el mismo contrato no secreto `runtime-target.json`. El objetivo activo permanece en el SHA público anterior, con cuentas desactivadas, hasta que se cambie explícitamente el origen público. Kuma conserva sus cuatro monitores y el ID del monitor de build. |
| Pruebas | 36 contratos de operación pasan en Linux: configuración de objetivo, watchdog, preflight de release y reconciliación Kuma. Playwright y axe permanecen en local/CI, sin instalar navegadores en la imagen pública. |

## Archivos y conexiones

- `deploy/ops/coolify/judge.compose.yml` es un ensayo privado durable; no sustituye
  el servicio público de Coolify. Su imagen es inmutable y su healthcheck exige el
  SHA exacto, DEMO y el endpoint de sesión anónima inicializado con HTTP 401.
- `deploy/judge.env.example` se copia a un archivo privado externo a Git. El
  preflight exige la configuración completa, un secreto no ficticio, almacenamiento
  privado de UID 1000 y permisos de propietario 0700. El resultado de Compose y el
  `docker inspect` pueden contener secretos: no imprimirlos ni subirlos a GitHub.
- `deploy/ops/validate-judge-release.py` valida tanto archivos como el contenedor
  efectivo y su readiness. Rechaza healthchecks desactivados, probes de mera
  liveness, SHA incorrecto, autenticación 503, redirecciones y almacenamiento no
  escribible. No ejecuta el motor de contenedores.
- `runtime_target.py` debe instalarse antes de sus consumidores Python. En VPS el
  objetivo está en `/opt/mercado-cero/pilot/runtime-target.json`; en Windows, junto
  a `watchdog.py`. Solo contiene versión, SHA y modo de cuentas, sin URLs libres
  ni secretos. Un archivo presente inválido falla cerrado; la ausencia del archivo
  predeterminado conserva el piloto legacy para compatibilidad.
- `configure-kuma.cjs --target <archivo>` reutiliza el cliente Socket.IO instalado
  en Kuma. Lee credenciales por stdin; actualiza únicamente el keyword del monitor
  de build administrado, conservando su ID y configuración. Un target explícito
  ausente se rechaza. No activa canales externos de notificación.
- B1, móvil 320 y venta esperan a que termine su servidor antes de retirar sus
  bases temporales. Esto corrige una carrera de limpieza, sin cambiar aserciones
  ni resultados del producto.

## Rollback del lote

Los scripts y la configuración anteriores del VPS se guardaron bajo
`/opt/mercado-cero/pilot/ops-rollouts/785e96d/previous`. El watchdog anterior de
Windows está en `Documents/MercadoCero-Backups/tools/rollback-ee7469a` del perfil
autorizado. Los marcadores `*.was-absent` identifican archivos nuevos.

Para retirar el candidato, detener únicamente `mercado-cero-judge-release`;
conservar su imagen, datos y snapshots. Antes de retirar su contenedor hay que
reponer el destino anterior de `judge-backup.env`, con el lock de backup tomado,
para no romper la captura programada. Los scripts anteriores se restauran desde
la copia, preservando los datos y el origen público. No se ejecutó rollback porque
las comprobaciones pasaron; este lote no prueba una restauración de todos los
servicios del servidor.

## Pendiente antes de abrir las cuentas del piloto

1. Promover la imagen y los mounts mediante el recurso público de Coolify, con
   rollback del origen y respaldo inmediato previos. Actualizar el puente systemd,
   el objetivo compartido y los monitores de acuerdo con el contenedor observado.
2. Verificar en navegador el registro, cookie, recarga y logout por el HTTPS real
   y Cloudflare Access. La prueba privada de flags no sustituye ese recorrido.
3. Definir el acceso de los jueces manteniendo el control de acceso autorizado;
   no se abrió registro público en Cloudflare ni se amplió la política de Access.
4. Completar la custodia independiente de recuperación y elegir un canal externo
   de alertas. Los respaldos en esta computadora requieren el perfil Windows y
   conectividad. No se contrató R2 ni otro servicio de pago.

Pey real continúa desactivado. No se generaron cobros bancarios ni se cambiaron
reglas de webhook. El gate completo de 23 pruebas de release no está certificado.
