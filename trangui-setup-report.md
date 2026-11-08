# Trangui — setup sobre DSH

Base real: `f2980e7a37f193f4b39e389badf4d3557a4f4b3e`, verificada en 4580.
Rama candidata: `codex/trangui-setup`. No se modificó el checkout/servidor de DSH.

El candidato conserva el código funcional de DSH y cambia el nombre público a
Trangui. Se trasladaron únicamente los archivos de despliegue/recuperación,
identidad cerrada por defecto y tooling probado del setup `86be89a`. Se mantienen
ZXing y las cabeceras privadas de Movimientos. Los nombres técnicos de bases,
servicios, dominios y almacenamiento local permanecen para evitar migraciones
accidentales. Se excluyeron secretos y trazas del contexto Docker.

No se incorporó completa la rama `diego/onboarding`: su SHA consultado es
`5fe09f2`, tiene historia independiente y cambios de estilo/pagos además de
onboarding. El handoff detalla los límites y la procedencia de cada parte.

Pruebas antes del commit: identidad 8/8; Chromium/axe 1/1; snapshot WAL 1/1.
La identidad sigue sin montarse públicamente; no prueba aislamiento de ventas.
El VPS continúa sirviendo `09b4f8d` y no recibió este candidato.

La evidencia final de build/gates, comprobaciones de dinero y capturas se genera
contra el SHA limpio de este candidato en
`harness/evidence/runs/trangui-base/` y `harness/evidence/latest-static.json`.
No reutilizar como prueba actual los gates del setup anterior.

Para Diego/Lead: consultar `TRANGUI-INTEGRATION-HANDOFF.md`, tomar esta rama
candidata, verificar sus gates y revisar los cambios faltantes de Diego sobre
DSH. El despliegue requiere revisión del candidato y rollback. Sin merge a main.
