# Goal de cierre — demo 7 nov 2026

> Estado de partida: master `71bc4ed` (datos + seguridad + harness + docs + ensayo).
> Falta integrar `p0/design-structure` y ejecutar la evidencia final.
> Este goal manda sobre los reportes de carril: nada se declara listo sin
> `verify:full` 23/23 y `verify:evidence` sobre el mismo SHA.

## Definición de terminado (DoD)

1. **Código:** master contiene diseño estructural “amable y de barrio”, datos
   demo/real, seguridad, ensayo, docs y harness v2. Árbol limpio.
2. **Build:** `npm run build` desde el HEAD final; `/api/health` devuelve
   `buildSha === HEAD`.
3. **Servidor correcto:** `next start -H 127.0.0.1 -p 3000`, DB demo reseteada.
4. **Full:** `npm run verify:full` → **23/23**, `ok:true`, `gitAtEnd.dirty:false`,
   `serverBuildSha === HEAD`. Sin `--skip` ni `--only`.
5. **Evidencia:** `npm run verify:evidence` → PASS, `latest.json` local atado al
   HEAD final; `latest-static.json` no lo pisa.
6. **Flujos:** `p0-venta` 65, `p0-fiado` 51, `p0-corte` 69, `p0-integracion` 51,
   `p0-dinero` 45+3 KNOWN, checkout 19, mobile 25, mobile-320 42, HIG 5
   viewports, motion 19, contrast 7, security 48, data 123, webhook 40,
   rehearsal 3/3/19, tunnel 8/8, preflight 18/18.
7. **Demo:** QR/PDF apuntan al túnel vivo; DB demo con $190/$70/$120/$50/$300;
   video/Stageshow regrabados con la UI final y corte $550; runbook/status con
   SHA, URL, fecha y límites honestos.
8. **Computer use:** pasada final sobre el build del HEAD (Caja, fiado, corte,
   meta, pendientes, checkout, success, reset, teclado) sin P0/P1.
9. **Límites declarados:** sin auth de sesión, pago real $0.01 bloqueado,
   TalkBack/VoiceOver/teléfono físico y 6–8 comerciantes pendientes. No se
   afirman como verdes.
10. **Carga cognitiva:** “Antes de cerrar” con pendientes de hoy/mañana y
    cobros por confirmar; venta manual con `/api/voice/parse` caído; borrador
    recuperable; pendientes completar/posponer/eliminar; copy sin diagnóstico
    ni culpa. Gates nuevos PASS. No se afirma reducción de estrés sin estudio.

## Fases y orden

### Fase 1 — Integrar diseño estructural
- [ ] Revisar commit de `p0/design-structure` (sin mergear).
- [ ] Mergear en master resolviendo P0: CTA “Anotar pendiente” visible,
      “Cuánto llevo” sin sumar por cobrar, success demo sin “banco”,
      las 4 pestañas en hoja/libreta, tecla “Fiar”, demo “sin banco”,
      mesh/fibra en hoja/recibo, margen 52–56, 200 % editor (precio/CTA),
      forced-colors, p0-shell SSR, 404 checkout HTTP 404.
- [ ] Rebuild + `test:harness` 58/58 + `checkout-gate` 19/19.

### Fase 2.5 — Carga cognitiva y acompañamiento
> Contrato: `GOAL-ACOMPANAMIENTO.md` + `docs/CARGA-COGNITIVA.md`.
> La auditoría histórica `AUDITORIA-COGNITIVA.md` es un snapshot del 1 nov;
> no se usa como estado actual sin verificar el código.
- [ ] Informe `AUDITORIA-CARGA-COGNITIVA.md` con Implementado/Parcial/Falta y
      evidencia `archivo:línea` del build actual.
- [ ] Integrar `p0/cierre-cognitivo`: “Antes de cerrar” con pendientes de hoy,
      vencidos y mañana + cobros por confirmar; completar, posponer y “Ahora no”
      sin borrar datos ni ocultar avisos de dinero.
- [ ] Integrar `p0/sin-ia`: venta manual de 2 ítems con `/api/voice/parse` en
      500, sin bloquear el cobro; borrador recuperable con decidir.
- [ ] Preferencias “¿Cómo quieres que te ayude?” (sugerencias, recordatorios,
      explicaciones y voz); apagar sugerencias no oculta avisos críticos.
- [ ] Copy sin diagnóstico emocional ni culpa; separar verificado / manual /
      sugerencia; no confundir venta con ganancia.
- [ ] Gates nuevos: `closing-checklist-e2e.py`, `sin-ia-e2e.py`, recuperación
      de borrador, completar/posponer/eliminar pendiente y copy.
- [ ] Declarar límites: no se afirma reducción de estrés o carga sin estudio
      con comerciantes.

Carriles y orden de integración:
1. `p0/cognitive-audit` (`42d8f3f`) — informe, sin código.
2. `p0/verdad-pago` — demo no entregable, estados canónicos, cifras y success.
3. `p0/sin-ia` — venta manual con parser 500 y consultas locales.
4. `p0/cierre-cognitivo` — “Antes de cerrar”.
5. `p0/preferencias` — “¿Cómo quieres que te ayude?”.
6. `p0/design-structure` → master; después master → build/full.


### Fase 2 — Video/Stageshow final
- [ ] Actualizar `record-demo.py`/`film-check.py` si el diseño cambió labels.
- [ ] Grabar MP4 final, verificar Caja “¿Qué vendiste?”, corte $550, duración.
- [ ] Generar Stageshow/contact/motion sheets; commitear video y artefactos
      versionados antes del build final.

### Fase 3 — Docs y operación final
- [ ] Actualizar `demo/STATUS.md`/`RUNBOOK-DEMO.md`/`README.md` con SHA final,
      URL del túnel, stats reales del video y límites.
- [ ] Reset demo, `preflight` 18/18, QR/PDF apuntando al túnel.
- [ ] Reapuntar preview `techno-committees…` al build final (mismo link).
- [ ] Commit de docs (último cambio de fuente).

### Fase 4 — Evidencia final
- [ ] `npm run build` desde HEAD final; reiniciar `-H 127.0.0.1`.
- [ ] Reset demo + `preflight`.
- [ ] `npm run verify:full` 23/23.
- [ ] `npm run verify:evidence` PASS.
- [ ] `npm run harness:report` y actualizar STATE/STATUS **antes** del full si
      cambia el SHA; después no tocar código.

### Fase 5 — Verificación humana y preview
- [ ] Computer use final sobre el HEAD, sin P0/P1.
- [ ] Preview actualizada en el mismo link; captura 320/360/1280/200 %.
- [ ] Declaración honesta de límites.

## Bloqueos conocidos / no ejecutables
- Pago real $0.01: BBVA/CoDi bloqueado; demo `demo_paid`.
- Auth de sesión: no existe; CSRF no es auth.
- TalkBack/VoiceOver/teléfono físico y 6–8 comerciantes: pendientes.
- Quick tunnel efímero: si muere, relanzar y regenerar QR/PDF.
- Multi-instancia link/QR y rate limit en memoria: KNOWN.

## Reglas
- Ningún merge sin tests; ningún “listo” sin full 23/23.
- Un gate no ejecutado no está verde.
- `latest.json` es local; el SHA del full es el SHA entregado.
- Si el host está cargado, no se mide performance como veredicto: esperar host
  limpio y mediana de 3.
