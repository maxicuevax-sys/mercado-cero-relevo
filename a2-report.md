# Lane report — A, ronda 2

## Objetivo

- Cerrar gaps reales de Inicio, Pendientes, Corte y Metas a 390×693 desde
  las referencias DEFINITIVE, conservando accesibilidad y verdad financiera.
- Fuera: B/Caja/Ventas/Ayuda/Ajustes, Fiados, módulos sin ruta, merge y push.

## Cambios

- Alcance y comparación: [PARITY-A2.md](PARITY-A2.md).
- UI: cuatro rutas A, componentes de tareas/conteo y shell condicionado a A.
- Arte: recortes de ilustraciones definitivas; cifras y controles siguen vivos.
- Riesgos/residuales: enlaces deshabilitados por módulos inexistentes, estado
  del candidato sin segunda meta/cinco tareas, mayor altura de Corte y arranque
  4497 rechazado por revisión automática.

## Evidencia

- `verify:fast`: guard/lint/tipos ejecutados; primera corrida diagnóstica con
  árbol sucio, no válida como handoff. Static vuelve a ejecutar esos tres gates.
- `verify:static` y `verify:evidence -- --static`: ejecutar sobre el HEAD final
  limpio de `../mercado-cero-a2-verify`; artefacto `harness/evidence/latest-static.json`.
- Seguridad, demo-pay, B.1, UI y flujos: resultados definitivos en
  [final-validation.json](harness/evidence/exact-parity/a2/final-validation.json).
- `verify:full` y `test:harness`: no ejecutados; no se cambiaron los gates del
  harness. Timebox local, sin certificación pública o de paridad exacta.

## Verificación manual

- Capturas reales inspeccionadas a 390, Inicio desktop a 1448; reflujo 320/200%
  y axe registrados por el script. Prueba Chromium, no dispositivo físico.
- Vacío real de tareas y una meta guardada conservados. Errores/red denegada
  no se certifican exhaustivamente en esta ronda.
- Sin secretos en los commits. No se añadió ningún camino a `paid`.

## Pendientes

- Recuperar y verificar 4497 cuando su arranque sea permitido.
- Aceptación visual humana y cierre de los residuales detallados en PARITY-A2.
- Sin merge ni push.
