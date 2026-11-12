# Operación del piloto Mercado Cero

Estos archivos operan el piloto sin cambiar la UI ni la lógica de pagos.
Aplicación servida: `09b4f8d`, ahora desplegada en Docker por Coolify.
Estado, migración y rollback actual: [CONTROL-PLANE.md](CONTROL-PLANE.md).

## Instalado

- Litestream 0.5.14, imagen fijada por digest, réplica local en volumen propio,
  sin red, bajo UID 1000. Esa réplica comparte VPS: no es respaldo externo.
- Snapshot consistente SQLite cada hora mediante `mercado-cero-backup.timer`.
  Restic 0.19.1 cifra la base y la configuración privada en un repositorio propio.
- Copia incremental del repositorio a la computadora autorizada cada cuatro
  horas y al iniciar sesión. Windows Task Scheduler: `Mercado Cero - respaldo cifrado`.
  Requiere esta sesión de Windows y conectividad SSH al VPS. `StartWhenAvailable`
  recupera ejecuciones perdidas. La tarea no despierta una computadora apagada.
- Cada copia comprueba todos los datos y restaura la última instantánea aparte:
  SHA-256 de base, `integrity_check`, consulta de pedidos y orden demo si existe.
- Uptime Kuma 2.5.9 en `127.0.0.1:4591`, volumen propio, sin socket de contenedores.
  Monitores de SHA de aplicación, túnel, redirección anónima Access y respaldo
  reciente. No hay notificaciones externas configuradas.
- Watchdog de producción cada 2 minutos (`mercado-cero-watchdog.timer`): comprueba
  contenedor, health local, health público, STT y espacio en disco. Reinicia el
  contenedor o el STT solo tras dos fallos consecutivos; el resto solo alerta.

Los servicios nuevos tienen límites de CPU y memoria. No se modifican puertos
80/443, servicios de otros proyectos ni el inventario de navegación. Docker añade
sus propias cadenas de firewall; las reglas anteriores se conservaron.

## Credenciales y recuperación

En VPS, contraseña restic y administrador Kuma en archivos `0600` bajo
`/opt/mercado-cero/pilot`. Las copias de configuración se cifran antes de salir.
En esta computadora: `Documents/MercadoCero-Backups`, ACL del usuario actual,
repositorio cifrado y contraseña protegida con DPAPI CurrentUser.
La restauración de prueba deja datos descifrados dentro de esa carpeta privada.
DPAPI depende del perfil Windows: aún falta custodiar la clave en un segundo
medio independiente antes de considerar completa la recuperación ante pérdida
simultánea del VPS y del perfil de esta computadora.

No se programó borrado/prune. El repositorio del servidor se detiene al alcanzar
1 GiB para pedir revisión de retención. La evidencia distingue copia reciente
de respaldo externo reciente; Kuma dentro del VPS no detecta su propia caída.

## Uso

Desde esta computadora, abrir el panel por túnel SSH:

```powershell
ssh -N -L 127.0.0.1:24591:127.0.0.1:4591 zicua-vps
# Panel: http://127.0.0.1:24591
powershell -NoProfile -File "$env:USERPROFILE\Documents\MercadoCero-Backups\backup-windows.ps1" -VerifyRestore
```

`configure-kuma.cjs` usa la API Socket.IO de la imagen fijada, recibe credenciales
por stdin, crea solo monitores inexistentes y no imprime contraseña ni sesión.
No es una API pública estable: revisar contra el código de Kuma al actualizar.
Si cambia la imagen de aplicación, actualizar el SHA esperado de su monitor.

## Watchdog de producción

`mercado-cero-watchdog.py` se instala en `/usr/local/sbin/mercado-cero-watchdog`
junto con `.service` y `.timer`. Cada corrida verifica:

- estado y health del contenedor `trangui-public-emoji`;
- `/api/health` local comparando `buildSha` contra `deployment.json`;
- `/api/health` público por HTTPS;
- `/health` del STT local en `172.30.0.1:4097`;
- espacio libre en disco (alerta bajo 3 GB).

Dos fallos consecutivos del contenedor disparan `docker restart` únicamente de
ese contenedor. Dos fallos del STT disparan `systemctl restart
trangui-local-stt.service`. Nunca toca otros contenedores, volúmenes ni puertos.
Estado en `/var/lib/mercado-cero-watchdog/state.json`; bitácora acotada en
`/var/log/mercado-cero-watchdog.log` (rota a 5 MB).

```bash
install -m 0755 mercado-cero-watchdog.py /usr/local/sbin/mercado-cero-watchdog
install -m 0644 mercado-cero-watchdog.service mercado-cero-watchdog.timer /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now mercado-cero-watchdog.timer
systemctl start mercado-cero-watchdog.service   # verificación inmediata
```

## Rollback

Deshabilitar `mercado-cero-backup.timer`, detener únicamente
`mercado-cero-{kuma,litestream}.service` y deshabilitar la tarea Windows indicada.
Conservar los volúmenes, repositorios y claves. Para retirar arranque de Quadlet,
guardar y retirar solo sus dos archivos `.container`, seguido de daemon-reload.
La aplicación y el túnel existentes no requieren rollback por este lote.

## Aún pendiente

- Docker + Coolify ya instalados y origen migrado; ver CONTROL-PLANE.md.
- Better Auth y aislamiento por comerciante integrados; instancia privada de prueba,
  todavía sin sustituir la aplicación pública.
- Pey real + endpoint de webhook firmado: continúan desactivados en DEMO.
- Canal de alertas permanente fuera de esta computadora; hay vigilancia externa
  desde Windows con avisos locales configurados, no correo/Telegram.
- R2 no activado: el usuario eligió computadora si no se garantiza costo cero.

## Respaldo de cuentas demo

`backup-judges.sh` añade al mismo respaldo cifrado un corte de identidad y las bases
de los comerciantes de ese catálogo. Conserva el respaldo anterior de la aplicación
pública y Coolify. Configuración opcional, privada y tratada como datos en
`/opt/mercado-cero/pilot/judge-backup.env`:

```text
JUDGE_BACKUP_ENGINE=docker
JUDGE_BACKUP_CONTAINER=mercado-cero-judge-canary
JUDGE_BACKUP_DATA_ROOT=/data/judges
```

El contenedor debe estar activo, en DEMO, con cuentas habilitadas y sin claves de
proveedores. El hook verifica el corte copiado con la imagen inmutable de ese
contenedor; configura límites y red deshabilitada para su validador temporal.
Incluye configuración de recuperación privada dentro de restic: nunca publicar
`runtime-env.json`, bases, manifiesto de usuarios ni claves en GitHub.

Después de activarlo, perder la configuración deja el gate rojo; no se considera
un corte viejo como respaldo reciente. El lock principal se conserva durante
captura y cifrado; una ejecución independiente del hook comparte ese lock.

Instalar en la carpeta privada de respaldos Windows el verificador Python y el
helper Node revisados, y crear el marcador `judge-backup-required`. Ese marcador
exige restauración en cada ejecución, aunque falte `-VerifyRestore`. Node 24 o
superior es necesario. El helper local debe coincidir con el de la imagen capturada
(solo se normalizan finales de línea CRLF/LF; se conservan los hashes de bytes);
un cambio de versión requiere revisión e instalación explícita antes de restaurar.
Nunca se ejecuta código descargado del repositorio de respaldos.

La copia externa verifica frescura (corte a no más de 15 minutos del snapshot),
hashes, SQLite y restauración a una raíz inactiva nueva. Compara todos los registros
de identidad y negocio y exige cero sesiones restauradas. No cambia los mounts de
la aplicación. Ver [contrato de recuperación](../../docs/judge-recovery.md) para los
cortes individuales y sus límites: no existe una transacción global entre bases.
Las carpetas de verificación usan `snap-` y 12 caracteres del ID para evitar
MAX_PATH con las rutas de comerciantes en Windows. Un marcador con el ID completo
impide reutilizar por colisión o aceptar una extracción incompleta.

Rollback de este lote: conservar repositorios y datos; restaurar las versiones
guardadas de los scripts y retirar únicamente la configuración/marcador añadidos,
con el servicio de respaldo detenido. No retirar la protección de cuentas para
ocultar un fallo ni declarar éxito con un corte viejo.

Fuentes de instalación: documentación oficial de Litestream, restic y releases
de louislam/uptime-kuma. Ver evidencia operativa en el run de `vps-pilot`.
