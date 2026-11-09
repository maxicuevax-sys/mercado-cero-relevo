# Trangui: preparación de Sentry con privacidad y canary aislado

Base: `374cc5ba58febeafb3a5d5d75f3d1846cb49da9e`. Rama local: `codex/trangui-sentry-setup`, copia aislada `trangui-accessibility-audit`. Sin push, despliegue ni servidor Next iniciado en Windows.

## Qué cambia

SDK `@sentry/nextjs` fijado a **11.11.0**, compatible declarado con Next 16 y Node 24. Ninguna versión de paquete preexistente cambió al instalarlo. Se conserva Next 16.4.3, Turbopack, `cacheComponents`, standalone, BUILD_SHA, CSP `connect-src 'self'` y los contratos de auth/demo/pagos.

Inicialización en navegador/Node/Edge, error boundary global y captura de excepciones inesperadas en el helper central y los catches 503 de auth/500 de corte. Las validaciones 4xx no se reportan como fallos inesperados. Sin DSN no se inicializa ni se intenta enviar desde esos helpers: los contratos Node existentes continúan funcionando.

El único destino válido debe llegar mediante `NEXT_PUBLIC_SENTRY_DSN` en build y, opcionalmente, `SENTRY_DSN` en servidor. No hay DSN real ni token hardcodeados. El Lead acreditó organización `leadly-ld`, equipo `leadly`, proyecto **`mercado-cero-relevo`**; no asumir un proyecto llamado `trangui`.

## Datos y señales

- Errors y tracing: 5% en producción, 100% en desarrollo. Se usa el lifecycle estático documentado de SDK 11 para que `beforeSendTransaction` sea efectivo, junto a `withStaticSpan`; los spans streaming también tienen prueba directa de saneamiento.
- Se desactiva recolección de identidades, cookies, headers, cuerpos, query strings, contenido GenAI/MCP/GraphQL, consultas de base, colas, variables de stack y líneas de contexto.
- No Replay, profiling, logs ni métricas. Se descartan breadcrumbs; no se añade captura de consola ni se envía el dictado/audio.
- `beforeSend` usa allowlist de campos de protocolo/stack/release. Elimina mensajes libres, usuarios, requests, extras, adjuntos, tags no autorizados y datos de mecanismos/contextos. Conserva archivo de código sin query/usuario local y línea/columna para agrupación. El nombre de función se sustituye por uno técnico genérico; source maps podrán recuperar funciones del código cuando se habilite su subida.
- Se excluye BrowserSession automática; un hook independiente limpia `did`, IP y user-agent de la tubería de sesiones, que no pasa por `beforeSend`.
- Los únicos tags diagnósticos admitidos son `sentry_test=browser` o `server`, valores fijos sin datos del negocio.

## Túnel y diagnóstico

`/sentry-tunnel` utiliza el handler oficial `@sentry/nextjs/tunnel` en modo handler, no un rewrite que reenvíe cookies. Solo acepta el DSN configurado, valida origen, limita cuerpos a 64 KiB y aplica presupuesto exclusivo de telemetría de 60 solicitudes/IP/minuto. Responde 429 sin afectar acceso ni operaciones de negocio. Se recalcula `Content-Length` a partir de bytes UTF-8 del cuerpo acotado; no se confía en el del cliente ni se copian Cookie/Authorization. El límite usa el helper IP existente y no se presenta como garantía por persona.

`/ops/sentry-diagnostics` no tiene links de navegación y requiere simultáneamente:

1. `SENTRY_DIAGNOSTICS_ENABLED=true` en servidor;
2. `APP_URL=http://127.0.0.1:4599` exactamente;
3. sesión de cuenta demo mediante `withPilotPage`.

Si no cumple flag/origen, el Proxy devuelve HTTP 404 antes de cualquier redirección de auth. La página ofrece un único error sintético de navegador; el backend se puede verificar con el catch real de voz contra un STT ausente en el canary, sin cobrar ni usar datos reales. El control no requiere habilitar proveedores ni cambiar JUDGE_DEMO_ACCOUNTS.

El mismo build etiqueta el navegador como `canary` cuando el hostname es loopback; el sitio público usa `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (producción por defecto). El servidor admite `SENTRY_ENVIRONMENT=canary` solo en el contenedor de prueba. Los tags diagnósticos no exponen URL, usuario, audio ni importe.

## Build y secretos

Variables públicas de build: `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_ORG`, `SENTRY_PROJECT`. Se mantienen `BUILD_SHA` y `NEXT_PUBLIC_BUILD_SHA` existentes.

`SENTRY_AUTH_TOKEN` es exclusivamente un secreto de build para subir source maps. Dockerfile lo recibe con BuildKit `--mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN`; no se declara como ARG/ENV persistente ni se coloca en `nextConfig.env` o en el runner.

Sin token/org/proyecto: `sourcemaps.disable=true` y `productionBrowserSourceMaps=false`; el build no intenta subir mapas. Con los tres presentes: genera mapas, los sube y elimina los de cliente después. Se desactiva telemetría del propio build plugin. La subida real y la ausencia de mapas públicos deben comprobarse con el token acreditado; no se finge esa verificación.

## Pruebas y límites de entrega

- TDD observado: tres pruebas de privacidad y dos de túnel fallaron antes del comportamiento implementado; después pasaron.
- `npm run test:sentry`: diez contratos, con pipeline **real** del SDK y transporte solo en RAM. Incluyen excepciones, transacciones, sesiones, adjuntos, UTF-8, DSN ajeno, stripping de credenciales, body/origin/rate y Proxy diagnóstico. No hubo tráfico a Sentry durante esas pruebas.
- Invitados, identidad, registro y voz siguen probados en fixtures locales. No se arrancó un servidor de aplicación.
- `test:sentry` se incorpora al job CI existente. Las excepciones del inventario de rutas se limitan al túnel de telemetría y al diagnóstico condicionado.
- El cierre static se debe leer en `harness/evidence/latest-static.json` contra el SHA entregado y su verificador; no usar evidencia de otro commit.

Pendiente del Lead: configurar el DSN acreditado en build, levantar el contenedor Linux de canary, obtener dos eventos reales frontend/backend y verificar ambiente/release/ausencia de PII en Sentry. Sigue pendiente un auth token válido para subir source maps; esa limitación no impide recibir eventos. No se declara monitoreo productivo activo ni resolución de stack traces real por la sola instalación del SDK.

## Fuentes primarias

- [Sentry Next.js manual](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [Túnel handler y source maps](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build/)
- [Privacidad y opciones](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/)
- Fuentes y tipos locales de Next 16.4.3 (`web/node_modules/next/dist/docs/`) y SDK 11.11.0 (`web/node_modules/@sentry/`).
