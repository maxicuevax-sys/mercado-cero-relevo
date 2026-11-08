# Producción Trangui — fix urgente 2026-11-08

- Producción: https://xn--hw9h.st
- Build anterior: e7a7805
- Build desplegado: 34c4329 (image sha256:b41a2967…)
- Rollback: /opt/mercado-cero/public-emoji/rollback-34c4329 y rollback-7d46645
- Backup de cuentas antes del deploy: 12 users / 20 sessions / 9 DB / 137 orders / 127 payments; sin cambios después.

## Arreglado y verificado
- Entrada sin cuenta: botón en /acceso; crea sesión demo aislada y va a /onboarding.
- Contraseña sin límite de UI; validación de servidor sin mínimo/máximo; Better Auth min 1/max 4096.
- Registro duplicado ahora explica “correo ya registrado o datos inválidos”.
- $0.01 en Cobro CoDi es monto demo seleccionable; input pasa a 0.01.
- Ilustración superior ya no desborda (right 376 < 390).
- Logout/sesión/cookies intactos; guest no toca datos de otras cuentas.
- Health HTTPS == 34c4329; relay/443/mail no tocados.
- Sin Cloudflare/LSCache; assets Next hashed; hard refresh.

## Pendiente
- Micrófono: el contenedor no tiene STT en 127.0.0.1:4097. Interpretar con texto sí funciona; el dictado requiere servicio local/sidecar.
- Overflow de otros navegadores/fotos reales no sustituido por WebKit emulado.
