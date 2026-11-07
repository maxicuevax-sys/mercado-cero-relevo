# A3 — P0 navegación móvil

Base: da29e8a. Candidato local: 4497. Sin merge, push ni autoaprobación.

## Cambio acotado

- MobileNav conserva Fiados como enlace real en todas las variantes. Se elimina la sustitución por Gastos deshabilitado; Más conserva Corte, Metas, Pendientes, Ayuda y Ajustes.
- Inicio conserva cuatro accesos y su composición, con rutas reales: Cobrar (Caja), Ventas, Fiados y Corte. Diferencia intencional con el arte: Producto/Gasto/Reporte no existen como módulos y no se representan como acciones falsas.
- Fiados móvil: campana y regreso de 48×48 px; pestañas de 48 px de alto, independientes de la escala decorativa.
- Sin cambios a Caja ni al motor financiero.

## Evidencia y validación

Capturas antes/después: `harness/evidence/exact-parity/a3-nav/`, 320/390/941, Inicio/Corte/Metas/Pendientes/Fiados. Script reproducible: `cd web; python scripts/a3-mobile-nav.py` (BASE_URL y A3_OUT opcionales). Incluye navegación real, Más por teclado, Escape y retorno de foco, entrada a Fiados con foco al main, pestañas y targets.

`verify:fast`: guard/lint/types 3/3 verdes en la comprobación previa; evidencia inválida por árbol con cambios ajenos preexistentes. El cierre formal static se ejecuta sobre el mismo commit en worktree limpio de validación; consultar `harness/evidence/latest-static.json` y `npm run verify:evidence -- --static` allí. Los resultados finales de security/demo-pay/B1/build y del navegador se entregan con sus logs, sin inferir aprobación visual ni full.

Evidencia ajena preservada fuera del commit: quality-reports/definitive-a y oleada-b1-regression.json preexistentes. No se ejecuta full público (túnel/preflight fuera del alcance). Esto no certifica accesibilidad con dispositivo/lector real.

Rollback: revertir únicamente el commit A3, reconstruir y reiniciar el candidato local. No hay migración ni cambio de datos.
