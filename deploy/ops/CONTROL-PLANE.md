# Docker y Coolify activos para Mercado Cero

Aplicación: build `09b4f8d1aa63f40682e2e4082034fe952a1dd1e2`, Node 24.22.2.
Docker Engine 29.9.3, Compose 5.7.0, Coolify 4.6.0. Instalación manual con
paquetes oficiales y firma Docker verificada. No se quitó ni actualizó Podman.

## Estado activo

- `mercado.zicua.com` continúa protegido por Access, solo para el correo autorizado.
- La aplicación ya es desplegada por Coolify, servicio `jmkt3zjnd560s3g0vhqw97db`.
  Contenedor `mercado-cero-pilot-jmkt3zjnd560s3g0vhqw97db`, loopback `4590`.
- Proyecto `Mercado Cero`, entorno `production`. Proxy **NONE**. Sin dominio de
  Coolify, sin Traefik/Caddy, ni listeners nuevos públicos.
- Panel `127.0.0.1:4592`; websocket `4593`; terminal `4594`. Desde esta computadora,
  túnel SSH local en `24592/24593/24594`. Registro cerrado, único administrador,
  API y MCP desactivados, actualización automática del panel desactivada.
- PostgreSQL y Redis son exclusivos de Coolify, en su red `172.31.0.0/24`.
  No publican puertos del host. Imágenes fijadas por digest en el override.
- Coolify 4.6 arranca su componente interno Sentinel. No publica puertos y tiene
  acceso al socket Docker; el panel es una herramienta administrativa con acceso
  root al host, no una frontera de aislamiento entre proyectos.
- La clave SSH dedicada se acepta solo desde `172.31.0.0/24`, sin agent forwarding,
  X11 ni port forwarding. Clave del host comprobada antes de conectar.

Docker usa `/opt/mercado-cero/docker`; la red por defecto es `172.30.0.0/24`.
`ip-forward-no-drop=true` preserva la política FORWARD ACCEPT. Se comprobó que
no se retiraron reglas anteriores de firewall ni listeners anteriores.
Las cadenas nuevas son las propias de Docker. No se alteraron otros proyectos.

## Datos y convivencia

La aplicación Docker conserva la misma base, en el volumen persistente
`mercado-cero-pilot-data`, mediante bind de su ubicación física. No hay dos
procesos de aplicación escribiendo esa base: Podman se detuvo antes del cambio.
Litestream y Kuma continúan en sus unidades Podman existentes. No borrar ese
volumen ni sus archivos aunque la aplicación ya use Docker.

El puente systemd `mercado-cero-pilot.service` espera a la salud del build antes de
permitir el arranque del túnel. Docker reinicia el contenedor si sale; una salud
`unhealthy` genera alerta, no implica por sí sola un reinicio automático.
Coolify administra los despliegues. Su panel puede reiniciarse sin parar la app.

`app-runtime.env` selecciona Docker o Podman para el snapshot horario.
El backup cifrado incluye SQLite, configuración, dump PostgreSQL de Coolify,
su `.env` con APP_KEY y claves SSH. Se verificó una restauración de PostgreSQL
en base temporal desde una copia restaurada en esta computadora.

## Prueba previa y cambio

Primero se desplegó un ensayo privado en `4595`, con copia SQLite independiente.
Pasó 15 checks: flujo demo, QR pendiente, demo_paid, verify falso y nueve capturas
Inicio/Caja/Ventas a 390/320/1448. Se inspeccionó el render. No se certifica paridad
pixel exacta ni pruebas en dispositivos físicos. El nav de Pendientes conserva
su salto de línea a 320: este lote no cambia CSS.

Después se trasladó el origen real a `4590`. Los 16 pedidos y 15 pagos, incluida
la orden demo original, coinciden antes y después. La imagen importada en Docker
tiene otro config ID, pero las capas del filesystem son idénticas a la de Podman.
El ensayo anterior se detuvo y su metadato se conservó excluido del estado global.
La copia de su base permanece como evidencia; no es la base activa.

## Monitoreo desde la computadora

`Mercado Cero - vigilancia externa` ejecuta `watchdog.py` cada cinco minutos y al
iniciar sesión. Verifica redirección Access exacta, salud por SSH y antigüedad real
del snapshot externo/restauración. Dos fallos consecutivos disparan aviso local;
no repite en cada poll, recuerda una vez por hora y avisa recuperación.
Depende de que esta computadora esté encendida, conectada y con sesión iniciada.
No sustituye un monitor geográfico permanente ni envía correo/Telegram.
Se ejecutó una prueba del aviso sin error; la recepción visual del aviso por el
usuario no se ha confirmado. Ocho pruebas cubren debounce, recuperación y snapshot
antiguo/futuro. La tarea programada terminó con código 0 en comprobación real.

## Rollback preparado

`rollback-to-podman.sh`, validado sintácticamente, no ejecutado en producción.
Solo debe usarse sin despliegue Coolify en curso. Detiene aplicación Docker y
dependencias Mercado Cero, repone su Quadlet y arranca Podman sobre la **misma base
actual**. No restaura una base antigua ni descarta nuevas ventas.
La ubicación de la unidad original se registra en `migration.json` del VPS.
No detener todo Docker mientras el origen siga en Docker.

Para desactivar solo el monitor externo, deshabilitar la tarea Windows indicada.
No hay que quitar DNS, Access ni respaldos para revertir el runtime de la app.

## Pendiente

El usuario decidió varias cuentas demo para jueces, con datos separados. Better
Auth y ese aislamiento se implementarán antes de abrir el registro. La app actual
todavía tiene comerciante fijo y no se habilitó registro multicomerciante.
Pey real sigue desactivado. Access continúa protegiendo también el webhook: su
exposición firmada se debe preparar antes de pagos reales. Falta custodiar clave
de recuperación en un segundo medio independiente. R2 no se activó.
