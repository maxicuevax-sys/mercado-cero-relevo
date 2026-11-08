# Trangui: onboarding por giro

## Cambio

Registro → una pantalla con cuatro giros → Inicio. La elección persiste en SQLite
por cuenta, se recupera al iniciar sesión y se cambia desde Ajustes → Mi negocio →
Cambiar giro. Inicio solicita el giro pendiente solo en modo cuentas demo; el flujo
legacy conserva su navegación. La selección adapta chips y ejemplos de captura en
Caja, sin añadir líneas ni registrar ventas. Los importes sugeridos son ejemplos
editables, no precios de catálogo. No se crean subcuentas de Pey ni se conectan
cuentas bancarias.

Se reemplazó el onboarding anterior de cuatro pasos y su venta de ejemplo obligatoria.
Se conservan marca, papel crema, paleta e ilustración del bundle. Texto grande,
alto contraste, controles nativos y reflujo se probaron sobre la nueva pantalla.

## Verificación

- Contratos de perfil: 6/6 PASS con sesiones reales, dos cuentas, reapertura,
  validación estricta, rechazo de origen y ausencia de nuevas operaciones financieras.
- Playwright completo: 12/12 PASS en `9d30515` (incluye shell, cuentas y onboarding).
- Ajuste final de distribución: 3/3 onboarding PASS en `7434dd7`; mismas aserciones,
  más las capturas renovadas. Build/static 5/5 en ese SHA.
- Seguridad 58/58; demo-pay 66/66; B1 78/78. B1 ejecutado sobre `9d30515`; el ajuste
  posterior solo cambia CSS de onboarding.
- Capturas inspeccionadas en 390×693, 320×569 y 1448×1086; texto 200% y preferencias
  reales xlarge/high. Son pruebas con Chromium y emulación de viewport/texto,
  no pruebas de Safari, lector de pantalla ni teléfono físico.
- Los pedidos de ejemplo preexistentes de la demo se conservaron: se comparan
  todos sus identificadores y total antes/después; la selección no agrega pedidos.

Evidencia local ignorada por Git: `harness/evidence/runs/onboarding-giro/`.
El harness final y su verificador deben corresponder al HEAD entregado.

## Límites y recuperación

Este lote no despliega en el VPS ni activa pagos reales. Las suites legacy
mobile-320/p0-venta siguen pendientes de migración, como se documentó en el lote
anterior; no se declara full release. El antiguo helper local onboarding-profile
ya no gobierna el flujo nuevo; no se migra una elección de navegador ajena a una
cuenta autenticada.

Rollback de código: revertir el lote conservando las bases de datos; la tabla
business_profile es aditiva. No restaurar una base anterior sobre ventas nuevas.
