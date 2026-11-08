# Mercado Cero — base técnica de identidad y pruebas

## Alcance entregado

Better Auth 1.7.18, Playwright 1.65.0, axe-core/Playwright 4.14.0 y Chromium
158.0.8127.18 instalados con versiones fijadas. Factory server-only de identidad
SQLite WAL independiente, migraciones oficiales antes de inicializar el servicio,
registro cerrado por defecto, contraseña 12–128, sesión máxima de 24 horas sin
renovación ni caché de sesión, cookies HttpOnly/Secure/SameSite Lax para HTTPS.
No acepta cabeceras IP del cliente; hasta integrar el proxy confiable, usa el
bucket conservador compartido del proveedor. No hay ruta pública montada.

La maqueta anterior fue rechazada por el usuario. No se implementó: el usuario
prepara sus pantallas. Los archivos docs/previews se conservan como historial,
no son la dirección visual aprobada. Ninguna pantalla de producto cambió.

## Pruebas ejecutadas

- Identidad: 8/8 PASS en Windows Node 25.7.0 y Linux Node 24.22.2 del VPS.
- Chromium real de pruebas: registro con teclado, cookie, sesión, cierre y axe
  WCAG A/AA PASS. Es una fixture temporal, no QA visual del producto final.
- TypeScript y lint de los archivos nuevos: PASS.
- Revisión independiente de código: sin hallazgos accionables; se corrigió la
  descripción de la fixture para indicar sus escrituras de identidad temporales.
- npm audit de producción: 0 vulnerabilidades. El árbol de herramientas de lint
  mantiene 8 avisos moderados indirectos relacionados con minimatch/TypeScript
  ESLint; no se aplicó el downgrade de Next que propone audit --force.
- Seguridad existente: 58/58 PASS. Demo-pay requiere build/árbol del commit final;
  la primera ejecución diagnóstica detectó el build antiguo, por lo que no cuenta
  como PASS. El resultado final se registra en la evidencia de este lote.

Linux se probó en contenedores temporales con recursos acotados, sin puertos,
sin volumen de negocio y con network none durante las pruebas. Se conservan
fuentes/dependencias de reproducción bajo
/opt/mercado-cero/pilot/setup-check/auth-foundation-20261108.
Los contenedores de instalación/prueba se retiran con --rm al finalizar.

## Estado del VPS y límites

La aplicación publicada sigue en 09b4f8d, gestionada por Docker/Coolify; Tunnel,
Litestream y Kuma activos. Access sigue limitado al propietario. Respaldo externo
cifrado y restauración verificados. No se desplegó una imagen nueva por instalar
una biblioteca todavía no conectada. Pey real y OpenAI permanecen desactivados.

Esta base NO demuestra aislamiento de ventas entre cuentas: antes de abrir
registro faltan resolución de base por usuario validado, inventario y protección
de páginas/API, cuotas, propietario inicial, respaldo conjunto identidad/negocio,
restauración multiusuario, diseños del usuario, prueba canary y corte público.
No se requiere rollback del VPS en este lote. Para revertir las nuevas fuentes,
revertir su commit; no ejecutar migraciones de identidad sobre la base de negocio.

## Evidencia

`harness/evidence/runs/vps-pilot/auth-setup/`: salida Linux y manifiesto final.
`web/test-results/pilot-results.json`: prueba Chromium/axe.
`harness/evidence/latest-static.json`: build y gates del commit final cuando cierre.
`npm run verify:evidence -- --static` valida su identidad. Sin merge; avances
publicados en github/codex/vps-pilot después de las comprobaciones.
