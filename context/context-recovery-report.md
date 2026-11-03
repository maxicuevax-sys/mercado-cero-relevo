# Context recovery report — Mercado Cero

> **Worktree:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-context`
> **Rama:** `p0/context-recovery`
> **Base:** `b7154caaa2185b2cafb44a02a6bf5f8b69bef045`
> **Snapshot:** 2 de noviembre de 2026, 21:43; **actualizado:** 21:56 (America/Mexico_City).
> **Alcance:** recuperación documental desde fuentes primarias; sin cambios de código, app, puertos ni preview.

---

## 1 · Hash y estado

| Elemento | Valor |
|---|---|
| HEAD de producto | `b7154caaa2185b2cafb44a02a6bf5f8b69bef045` |
| HEAD de la rama de contexto | `65c9b4fd79cb41ce97c772dc2a9f1ea4e385d98e` (primer commit de `context/`) |
| `master` | `a85d903936af607e3c209fedceb2a40d8410a66e` (21:54) |
| `p0/final-cognitive` | `2a786f14184567744b15b211993a4da30436e8a0` (código `b7154ca` + doc de bloqueo) |
| Merge-base | `a85d903936af607e3c209fedceb2a40d8410a66e` |
| Adelanto de la final | 24 commits |
| Merge | **BLOQUEADO** por `master` hasta corregir 2 P0 adversarios |
| Árbol | limpio al inicio y antes de crear `context/` |
| `latest.json` | ausente |
| `latest-static.json` | ausente |
| Preview | `397039d212452b2950935d745cd8a1781040923e` |
| `:3000` | caído al observar |
| Túnel de demo | DNS no resuelve |
| MP4 | 39.760 s, 1,704,744 B, SHA-256 `C605F810D7B884C33A20C51110261B5B40F250B5E0268D52B24BD0A7A3403424` |
| QR PDF | SHA-256 `65DB5D445F3981938EEA5A68BBF8EA7CAF3D9062EF1AA2EF019AA9DA18015684` |
| QR PNG | SHA-256 `E37B334819DF2F98299988CDFBB7BB9CD04BF0D5464FC73D0AFB0D7557E51976` |
| Evidencia companion | SHA-256 `A7A80C87ABBFF7737F17747F23267E221484EC08602BCE2684418497D494C44D` |

**Commit de contexto:** este informe forma parte del commit que se crea después de escribir `context/`. El hash final se reporta en la respuesta y se puede confirmar con:

```powershell
git log -1 --format='%H %s' -- context/
```

---

## 2 · Método

1. Leí Git completo: `log --all --graph --decorate`, `branch -vv`, `worktree list --porcelain`, `stash list`, `tag -n`, `remote -v`, `reflog --all`, merge-bases, ancestros y diffs.
2. Leí el código de `web/src/app`, `web/src/components`, `web/src/lib`, `web/scripts`, `web/package.json`, `web/next.config.ts`, `.env.example` (sin leer `.env.local`).
3. Leí los documentos de contrato, handoff, demo, HIG, carga cognitiva, reportes P0 y auditorías.
4. Revisé la evidencia versionada: `harness/evidence/`, `demo/`, `demo/hig-before/`, `demo/stageshow/`, `demo/STATUS.md`, `demo/feedback.md`.
5. Hice observaciones de solo lectura: `/api/health` de `:3230` y de la preview pública; `GET` de un checkout inexistente; `ffprobe` del MP4; hashes de archivos; estado de `:3000`.
6. No ejecuté build, gates, E2E ni instalación de dependencias. No toqué `:3000`, `:3230`, la preview, el túnel ni otros worktrees.

---

## 3 · Archivos revisados (principales)

### Git y configuración

- `.gitignore`
- `AGENTS.md`
- `web/AGENTS.md`
- `web/package.json`
- `web/next.config.ts`
- `web/.env.example` (solo claves, sin secretos)
- `web/.gitignore`

### Documentos de contrato / estado

- `README.md`
- `GOAL.md`
- `GOAL-HIG.md`
- `GOAL-ACOMPANAMIENTO.md`
- `GOAL-CIERRE-DEMO.md`
- `HANDOFF-CIERRE.md`
- `HARNESS.md`
- `RUNBOOK-DEMO.md`
- `demo/STATUS.md`
- `HIG-DESIGN.md`
- `DESIGN-BARRIO.md`
- `ACCESIBILIDAD.md`
- `SECURITY.md`
- `PITCH.md`
- `PLAN-8-DIAS.md`

### Auditorías y reportes

- `AUDITORIA-CARGA-COGNITIVA.md`
- `AUDITORIA-COGNITIVA.md`
- `cierre-cognitivo-report.md`
- `cognitive-audit-report.md`
- `sin-ia-report.md`
- `verdad-pago-report.md`
- `preferencias-report.md`
- `P0-VENTA-REPORT.md`
- `P0-FIADO-REPORT.md`
- `P0-DINERO-REPORT.md`
- `P0-D-CORTE-REPORT.md`
- `P0-INTEGRACION-REPORT.md`
- `P0-SHELL-REPORT.md`
- `P0-FIX-DATOS-REPORT.md`
- `P0-PERF-UI-REPORT.md`
- `P0-PERF-CORE-REPORT.md`
- `P0-FIX-DISENO-REPORT.md`
- `P0-FIX-MOBILE-QA-REPORT.md`
- `harness/STATE.md`
- `harness/EVALS.md`
- `SWARM/board.md`
- `AUDITORIA-ADVERSARIA.md` (en `p0/adversarial`, leído vía `git show`)
- `adversarial-report.md` / `adversarial.json` (en `p0/adversarial`)

### Código

- `web/src/app/page.tsx`
- `web/src/app/layout.tsx`
- `web/src/app/api/orders/route.ts`
- `web/src/app/api/orders/[id]/route.ts`
- `web/src/app/api/orders/[id]/pay/route.ts`
- `web/src/app/api/demo/pay/route.ts`
- `web/src/app/api/demo/reset/route.ts`
- `web/src/app/api/credits/route.ts`
- `web/src/app/api/credits/[id]/pay/route.ts`
- `web/src/app/api/cash/route.ts`
- `web/src/app/api/cash/preview/route.ts`
- `web/src/app/api/cash/close/route.ts`
- `web/src/app/api/goals/route.ts`
- `web/src/app/api/goals/[id]/contribute/route.ts`
- `web/src/app/api/tasks/route.ts`
- `web/src/app/api/tasks/[id]/route.ts`
- `web/src/app/api/checkout/[id]/route.ts`
- `web/src/app/api/verify/route.ts`
- `web/src/app/api/webhooks/pey/route.ts`
- `web/src/app/api/health/route.ts`
- `web/src/app/pay/[id]/page.tsx`
- `web/src/app/pay/[id]/checkout-client.tsx`
- `web/src/app/pay/[id]/success/success-client.tsx`
- `web/src/app/pay/[id]/not-found.tsx`
- `web/src/components/caja-app.tsx`
- `web/src/components/closing-checklist.tsx`
- `web/src/components/companion-preferences.tsx`
- `web/src/components/pending-payments.tsx`
- `web/src/components/pending-tasks.tsx`
- `web/src/lib/db.ts`
- `web/src/lib/orders.ts`
- `web/src/lib/pey-events.ts`
- `web/src/lib/pey.ts`
- `web/src/lib/checkout.ts`
- `web/src/lib/cash.ts`
- `web/src/lib/tasks.ts`
- `web/src/lib/goals.ts`
- `web/src/lib/voice.ts`
- `web/src/lib/speech.ts`
- `web/src/lib/payment-labels.ts`
- `web/src/lib/payment-rules.ts`
- `web/src/lib/types.ts`
- `web/src/lib/config.ts`
- `web/src/proxy.ts`
- `web/src/app/globals.css`
- `web/src/app/barrio.css`
- `web/src/app/checkout.css`

### Scripts y evidencia

- `web/scripts/harness-gate.mjs`
- `web/scripts/preflight.mjs`
- `web/scripts/webhook-contract.mjs`
- `web/scripts/checkout-audit.py`
- `web/scripts/p0-venta-e2e.py`
- `web/scripts/p0-fiado-e2e.py`
- `web/scripts/p0-corte-e2e.py`
- `web/scripts/p0-integracion-e2e.py`
- `web/scripts/p0-dinero-e2e.py`
- `web/scripts/payment-truth-e2e.py`
- `web/scripts/sin-ia-e2e.py`
- `web/scripts/closing-checklist-e2e.py`
- `web/scripts/companion-preferences-e2e.py`
- `web/scripts/record-demo.py` (HEAD)
- `web/scripts/film-check.py` (HEAD)
- `harness/evidence/companion-preferences-e2e.json`
- `harness/evidence/README.md`
- `demo/feedback.md`
- `demo/hig-before/audit.json`
- `demo/hig-before/lighthouse-*.json`
- `demo/mercado-cero-demo.mp4`
- `demo/stageshow/01…08`
- `demo/qr-demo.html` / `.pdf` / `.png`

También revisé ramas no integradas vía `git show`, sin hacer checkout: `p0/fix-video`, `p0/design-final`, `p0/perf-data`, `p0/cognitive-integration`.

---

## 4 · Límites

1. **No hay `node_modules`** en este worktree; no se pudo construir ni ejecutar tests sin instalar dependencias. El carril es de recuperación documental y se pidió no instalar si no era necesario.
2. **No hay `.env.local`** en este worktree; no se leyó ni se copió ningún secreto. El `.env.example` se leyó solo para claves.
3. **No hay DB** `web/data/mercado-cero.db` en este worktree; no se probaron migraciones ni datos.
4. **No hay `:3000`**; no se pudo correr `preflight`, `webhook`, `mobile`, `checkout`, `full` ni `verify:evidence`.
5. **La preview `:3230`/pública sirve `397039d`, no `b7154ca`.** Las observaciones de UI/HTTP son de ese build; se marcan como tales.
6. **No se ejecutaron los E2E** de payment-truth, sin-ia, closing, companion, p0, mobile, checkout, HIG, motion, contraste ni rehearsal.
7. **No se probó el pago real** ni el webhook real; no hay credenciales/portal.
8. **No se probaron TalkBack/VoiceOver, teléfono físico ni personas**; no hay dispositivo/participantes.
9. **No se inspeccionaron los otros 47 worktrees**; no se sabe si tienen cambios sin commitear. No se borró nada.
10. **No se leyó el contenido del MP4 completo**; se verificaron duración/size/codec y tres frames (10 s, 22 s, 30 s). El juicio “Mostrador claro” se basa en esos frames y en el diseño del código.

---

## 5 · Diez hallazgos

### H1 · `master` no contiene la rama final

- `master` = `a85d903`; `p0/final-cognitive` = `2a786f1` (código `b7154ca`); 24 commits de diferencia; `master` es ancestro y el fast-forward es técnicamente posible, pero **está prohibido** por el bloqueo de merge.
- Riesgo: un deploy/grabación desde `master` pierde el diseño barrio y los carriles cognitivos.
- Evidencia: `git rev-list --count master..p0/final-cognitive` = 24; `HANDOFF-CIERRE.md` en `master` dice “NO MERGEAR TODAVÍA”.
- Archivo: `context/01-ESTADO-GIT.md` §2.2.

### H2 · No hay evidencia `full` del HEAD final

- `harness/evidence/latest.json` y `latest-static.json` **no existen**.
- Los documentos repiten 23/23, 40/40, 25/25, 19/19, etc., pero no hay JSON de corrida atado a `b7154ca`.
- El único JSON versionado es `companion-preferences-e2e.json`, con `dirty:true` y base `e6f3107`.
- Evidencia: `harness/evidence/`; `companion-preferences-e2e.json:7-15`; `demo/STATUS.md:3`.
- Archivo: `context/05-EVIDENCIA.md` §5.

### H3 · El reporte de preferencias contradice su propio JSON

- `preferencias-report.md:60` dice `gitAtStart.dirty: false`.
- `harness/evidence/companion-preferences-e2e.json:7-11` dice `dirty: true` y `sha: e6f3107`.
- Bajo `HARNESS.md:135`, esa evidencia no vale como handoff.
- Archivo: `context/06-RIESGOS-Y-DUDAS.md` C3.

### H4 · El 404 del checkout sigue siendo HTTP 200

- `web/src/app/pay/[id]/page.tsx:13-14` pretende un 404 real.
- En la preview `397039d`, `GET /pay/no-existe-404-check` devuelve **200** con la UI “No encontramos este cobro”.
- La API `GET /api/checkout/no-existe-404-check` sí devuelve **404**.
- `checkout-audit.py:290-333` prueba la UI y la consola, no el status; por eso 19/19 puede pasar con 200.
- `HANDOFF-CIERRE.md:127-128` ya lo reconoce como P0.
- Archivo: `context/05-EVIDENCIA.md` O11/O12; `context/06` C4.

### H5 · El túnel de demo está muerto y el QR apunta ahí

- `demo/qr-demo.html:57` apunta a `https://timing-brought-lamp-aberdeen.trycloudflare.com`.
- El host no resuelve; el QR/PDF impreso no sirve.
- La preview pública que sí responde es otra URL (`involve-picking-wellness-retreat...`) y sirve `397039d`.
- Archivo: `context/05-EVIDENCIA.md` O13; `context/06` C5.

### H6 · La preview no es el build final; el video es de una UI anterior

- Preview `397039d`: diseño barrio, pero sin los merges cognitivos finales (`e6f3107`, `fe97c00`, `b7154ca`).
- MP4 `demo/mercado-cero-demo.mp4`: 39.76 s, 1,704,744 B, “Mostrador claro” (sidebar), $570, meta $325; no es la libreta barrio.
- Los frames `demo/stageshow/01…08` también son “Mostrador claro”.
- Archivo: `context/05-EVIDENCIA.md` §6.3–6.4.

### H7 · La documentación tiene contradicciones internas

- `HIG-DESIGN.md:600` / `demo/STATUS.md:58` / `harness/STATE.md:79` dicen **Manrope**; `layout.tsx:21-26` usa **Atkinson Hyperlegible**.
- `DESIGN-BARRIO.md:13` / `HIG-DESIGN.md:625-632` describen **mesh ColorFlow**; `barrio.css:9-10` y el commit `72d405f` usan **papel plano**.
- `GOAL-HIG.md:3` dice “F3+ PARKED”; `README.md:8` dice F3 implementado/desplegado.
- `README.md:177` / `RUNBOOK-DEMO.md:177` dicen `speechSynthesis`; `caja-app.tsx:1294-1300` y `:1336-1339` no tienen fallback al navegador.
- Archivo: `context/06` C7–C10.

### H8 · El cierre real es demo, no pago real

- No hay transacción, portal ni webhook productivo en el repo.
- README, runbook, demo/STATUS y SWARM dicen que no hubo pago real; BBVA/CoDi bloqueado; `demo_paid`.
- Las pruebas humanas están en 0/6–8; `demo/feedback.md` vacío.
- No se puede afirmar usabilidad ni accesibilidad real.
- Archivo: `context/05` §5; `context/06` P0-6/P0-8.

### H9 · Hay deuda de merge en cuatro ramas, una de ellas crítica para el video

- `p0/fix-video` (`c395e3e`): scripts nuevos de video, **no** en `HEAD`; la final no tiene `demo_ui.py`.
- `p0/design-final` (`dd3e3c9`): dirección visual alternativa, **no** integrada; no hay documento de descarte.
- `p0/perf-data` (`87ebd0c`): reporte/evidencia; **versiona `latest.json`**, contra la regla.
- `p0/cognitive-integration` (`ddd87dc`): obsoleta según `HANDOFF-CIERRE.md:122-123`.
- Archivo: `context/01` §3.3; `context/03` D20.

### H10 · 49 worktrees y ningún remoto: el estado es local y frágil

- 49 worktrees, 48 ramas, 0 remotos, 0 stashes.
- Muchos worktrees apuntan a SHAs antiguos; hay listeners en `:3211` y `:3230`, y `:3000` caído.
- Borrar worktrees sin revisar puede destruir cambios no commiteados; `p0/design-preview` está detached en `572847d`.
- No hay respaldo remoto: si se pierde el disco, se pierde el repo.
- Archivo: `context/01` §4.

---

## 5.1 · Addendum 21:50–21:56: la auditoría adversaria cambia el cierre

Después del snapshot inicial, aparecieron tres commits que no estaban en `b7154ca`:

- `3939133` (`p0/adversarial`): auditoría adversaria de `b7154ca` con build, servidor aislado `:3317`, webhook 40/40, security 48/48 y mock de pey.
- `ca3f95c` (`p0/supervisor`): auditoría del handoff.
- `a85d903` (`master`) y `2a786f1` (`p0/final-cognitive`): documentación de bloqueo de merge.

**Hallazgos nuevos que cambian la conclusión:**

1. **P0-1: reset de demo borra un pago firmado de pey.** `recordPayment` marca `demo=1` si `isDemoMode()` incluso con `provider='pey'` (`orders.ts:591`); `resetDemoData` borra `payments WHERE demo=1` (`db.ts:1973`) y reporta `preservedRealPayments` antes del borrado (`db.ts:2005`, `:2012`). El audit lo reprodujo y `master` bloqueó el merge.
2. **P0-2: `/` SSR con datos privados y caché pública.** `page.tsx:10-18` renderiza `getDashboardData`; `next.config.ts:190-195` declara `Cache-Control: public, max-age=0, s-maxage=60`. El HTML puede contener nombres, saldos, fiado y URLs de cobro.
3. **P1-1: webhook firmado en demo produce `paid` y permite entregar.** `recordPayment` pone `paid` si `provider='pey'` (`orders.ts:677-683`); `fulfillOrder` solo rechaza `demo_paid` (`:968-974`). El audit lo reprodujo.
4. **P1-3: `/api/verify` acepta PAID sin referencias si el monto coincide.** `hasReferenceMismatch` solo compara si el payload trae referencias (`verify/route.ts:212-245`).
5. **P1-5: totales de cobros/fiado truncados a 50/100 filas.** `pagination.ts:13-16`; `dashboard.ts:97-102`; `pending-payments.tsx:99-103`; `caja-app.tsx:3035-3040`.

**Consecuencia:** el `full` 23/23 **no cubre** P0-1/P0-2/P1-1/P1-3/P1-5. El bloqueo de `master` es correcto: no se debe mergear hasta corregirlos y probarlos. La rama `p0/fix-adversarial` existe pero no tiene commits propios al snapshot.

---

## 6 · Qué cambiaría estas conclusiones

- Correcciones probadas de P0-1 (reset no borra pago pey), P0-2 (home sin caché pública/PII), P1-1 (demo no produce `paid`), P1-3 (verify exige referencias) y P1-5 (totales completos).
- Un `harness/evidence/latest.json` con `gitAtStart.sha` igual al HEAD corregido, `dirty:false`, `buildSha` igual, `complete:true`, `ok:true` y artefactos con hash.
- Un `verify:evidence` PASS contra ese HEAD.
- Un servidor `:3000` desde ese HEAD con `/api/health.buildSha` igual.
- Un túnel vivo y un `tunnel-smoke` 8/8 contra la URL del QR.
- Una prueba HTTP que muestre 404 real en `/pay/[id]` inexistente (o una decisión explícita de aceptar 200).
- Un MP4/Stageshow de la libreta barrio, con la UI del HEAD y corte $550.
- Pruebas humanas 6–8 y TalkBack/VoiceOver/teléfono físico.
- Un merge/revisión de `p0/fix-video` y una decisión sobre `p0/design-final`.

---

## 7 · Entregables

- `context/00-INDEX.md`
- `context/01-ESTADO-GIT.md`
- `context/02-PRODUCTO.md`
- `context/03-DECISIONES.md`
- `context/04-CRONOLOGIA.md`
- `context/05-EVIDENCIA.md`
- `context/06-RIESGOS-Y-DUDAS.md`
- `context/07-GLOSARIO.md`
- `context/state.json`
- `context/context-recovery-report.md`

No se modificó ningún archivo existente. No se hizo merge. No se tocó la app, `:3000`, `:3230`, la preview, el túnel ni otros worktrees.

---

## 8 · Conclusión

La recuperación confirma que **hay un producto coherente y un candidato final claro (`2a786f1`, código `b7154ca`)**, pero **no hay evidencia de cierre y hay 2 P0 confirmados**. La frase correcta sigue siendo la de `demo/STATUS.md:3`: **“No declarar el cierre.”** Y ahora se suma la de `master`: **“NO MERGEAR TODAVÍA.”**

Lo que falta no es más documentación: es corregir P0-1/P0-2, ejecutar el cierre desde el HEAD correcto, con túnel vivo, evidencia `full` y video de la UI final.
