> **Documento histórico del primer piloto (09b4f8d), no del candidato Trangui.**
> Las notas siguientes sobre base 092cf84, pantallas excluidas y servicios pendientes
> describen aquel momento. Para ensamblar el candidato actual usar
> [TRANGUI-INTEGRATION-HANDOFF.md](TRANGUI-INTEGRATION-HANDOFF.md) y
> [trangui-setup-report.md](trangui-setup-report.md). Docker/Coolify ya operan en
> el VPS; Better Auth está preparado en fuentes, aún sin registro público.
# Mercado Cero — preparación del piloto VPS

Base visual restaurada, con Inicio/Caja y navegación existente.
Rama de preparación codex/vps-pilot, base 092cf84. La rama de rediseño
Cobrar/Movimientos/Ajustes queda fuera de este candidato.

## Estado comprobado el 7 de noviembre de 2026

Destino confirmado por el usuario, zicua-vps y mercado.zicua.com.
Inspección por SSH, AlmaLinux 9.7, Podman 5.8.2 y Node 22.22.3.
OpenLiteSpeed ocupa 80/443. Docker, Coolify y cloudflared no están instalados.
La consulta pública de mercado.zicua.com devuelve nombre sin resolución.
El servidor tiene unos 47 GB libres y swap casi completa. Se necesita un
build limitado en recursos o una imagen construida fuera del servidor.

La imagen propuesta usa Node 24 LTS y Next.js standalone. La aplicación
actual usa node:sqlite, WAL y busy_timeout de 5 segundos. El piloto debe
operar con una sola instancia escritora sobre disco local persistente.

## Alcance del paquete

Dockerfile en raíz, contexto en raíz, puerto interno 3000, usuario node.
El build exige BUILD_SHA explícito y conserva /api/health con esa identidad.
Datos en /data/mercado-cero.db, respaldos en /data/backups y volumen separado.
El código, las dependencias y los datos locales de desarrollo quedan fuera
del contexto de construcción mediante .dockerignore.

deploy/compose.yaml prepara la aplicación en modo demo, con puerto de host
solo en loopback. Los perfiles tunnel y replication son opcionales y
requieren configurar sus credenciales de forma privada.

deploy/snapshot.mjs produce una copia consistente con VACUUM INTO e
integrity_check. Incluye lo confirmado en WAL y rechaza sobreescribir un
archivo existente. Ejecución dentro del contenedor

```sh
node deploy/snapshot.mjs /data/backups/mercado-cero-FECHA.db
```

Una copia en el mismo volumen protege frente a errores de operación, pero
no acredita recuperación ante pérdida del VPS. Se debe restaurar una copia
en una base aparte y verificar filas antes de habilitar el piloto público.

## Construcción y comprobación local con Docker

```sh
cp deploy/pilot.env.example deploy/pilot.env
# Completar BUILD_SHA con git rev-parse HEAD y un DEMO_RESET_TOKEN privado.
docker compose --env-file deploy/pilot.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/pilot.env -f deploy/compose.yaml build web
docker compose --env-file deploy/pilot.env -f deploy/compose.yaml up -d web
curl --fail http://127.0.0.1:4590/api/health
```

Comprobar /inicio, /caja y /ventas en 390×693, 320×569 y escritorio. Crear
un pedido demo, reiniciar solo el contenedor, comprobar que persiste y que
su pago simulado no verifica como pago Pey. /api/health debe devolver el SHA
completo entregado. Registrar el ID de la imagen y los hashes de evidencias.

## Coolify y exposición

Coolify admite el Dockerfile con contexto raíz y ubicación /Dockerfile.
Definir BUILD_SHA como argumento de build, puerto 3000 y volumen /data.
Configurar health check /api/health. Desactivar escalado y despliegue rolling
con dos escritores compartiendo SQLite. El corte a una sola instancia debe
ser explícito.

El VPS confirmado tiene servicios en 80/443. La instalación automática de
Coolify en ese host no se ejecutó. La elección entre un piloto OCI aislado
en Podman y un VPS dedicado Docker/Coolify requiere la decisión del usuario.

Cloudflare Tunnel debe apuntar al servicio web:3000 dentro del Compose, o
al puerto loopback confirmado del origen. Crear primero una política
Cloudflare Access para las pantallas y API privadas del piloto. Verificar
que una sesión anónima no puede leer pedidos ni mutarlos. El token del túnel
se configura en el servidor o gestor de secretos, nunca en Git ni en chat.
La apertura del perfil tunnel requiere un túnel y DNS ya configurados.

## Stack de la selección y dependencias pendientes

| Parte | Situación |
| --- | --- |
| Next.js y sistema visual | Existentes; build standalone preparado |
| SQLite WAL | Existente; volumen y snapshot preparados |
| Docker/Coolify | Paquete preparado; destino sin esos servicios |
| Cloudflare Tunnel | Perfil preparado; faltan túnel, DNS y Access verificables |
| Better Auth | No está instalado ni integrado; la app no tiene sesión por comerciante |
| Pey y Standard Webhooks | Adaptador y firma existentes; piloto fuerza demo y llaves vacías |
| Litestream | Perfil 0.5.14 y configuración preparados; réplica externa sin configurar |
| restic | Pendiente repositorio externo cifrado, programación y prueba de restauración |
| Uptime Kuma | Pendiente identificar instancia, monitor privado y notificación |
| Playwright y axe-core | Harness y pruebas existentes; adjuntar evidencia del SHA final |

Better Auth requiere identidad, credenciales y autorización en el servidor.
El merchant actual es fijo y no existe aislamiento entre varios comerciantes.
Cloudflare Access puede proteger una revisión privada, pero no acredita ese
autorizador de producto. Un piloto con varios comercios requiere diseñarlo.

La activación de Pey real requiere llave rotada, cuenta CoDi activa y secreto
Standard Webhooks. El webhook debe ser alcanzable por Pey y validar firma,
monto, moneda y referencia. Su eventual excepción de Access debe limitarse
a /api/webhooks/pey y verificarse mediante pruebas de firma. La UI nunca
confirma dinero por la mera creación de un QR.

## Respaldo y rollback

Antes de cualquier cambio en el VPS, identificar la imagen/proceso previo,
el volumen y el SHA activo. Crear un snapshot consistente y comprobarlo.
Publicar la nueva instancia con una sola escritora y comprobar health, UI,
persistencia y acceso anónimo. Una reversión del código usa la imagen previa
y conserva el volumen. Si hubiera migración, detener la aplicación y probar
la restauración en un volumen distinto antes de sustituir datos. Este lote
no introduce una migración de esquema.

Conservar los respaldos fuera del VPS y un método independiente de recuperar
sus credenciales. Nunca usar docker compose down -v como rollback.

## Referencias verificadas

- https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- https://coolify.io/docs/applications/builds/dockerfile
- https://nodejs.org/en/about/previous-releases
- https://litestream.io/guides/docker/
- https://litestream.io/reference/config/
- https://better-auth.com/docs/installation
- https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html
