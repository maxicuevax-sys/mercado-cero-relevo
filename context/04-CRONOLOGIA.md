# 04 · Cronología

> **Fuente:** `git log --all --format='%h|%ad|%an|%s' --date=iso-strict`, `git reflog --all --date=iso`, y fechas explícitas en documentos. Todas las horas son `-06:00` (America/Mexico_City) salvo que se indique UTC.
> **Autor:** los 246 commits del repo son de **`Mercado Cero <dev@mercado-cero.local>`**. No hay autores individuales en Git; no se inventan nombres.
> **Rango de commits:** 31 de octubre de 2026 15:20 → 2 de noviembre de 2026 21:54 (incluye la documentación de bloqueo de merge).

---

## 1 · Antes del primer commit (documentos)

| Fecha | Hecho | Fuente | Vigencia |
|---|---|---|---|
| 30 oct 2026 | Plan de 8 días: hackathon 7 nov, entrega 8 nov; estado inicial con scaffold, demo, webhook 27 aserciones, dashboard, corte y “Mi camino” | `PLAN-8-DIAS.md:3-9` | **HISTÓRICO** |
| 30 oct 2026 | `GOAL.md` reformulado; fases F0–F13 y prioridades P0/P1/P2 | `GOAL.md:107-134` | **VIGENTE en invariantes**, histórico en estado |
| 31 oct 2026 | `GOAL-HIG.md`: baseline y auditoría HIG; F2 escrito; F3+ “PARKED” | `GOAL-HIG.md:1-7`, `:227-240` | **CONTRADICTORIO** con el estado posterior |

---

## 2 · 31 de octubre: baseline, HIG y primer rediseño

| Hora | Commit | Hecho | Fuente |
|---|---|---|---|
| 15:20 | `4d33a46` | Baseline “Mercado de papel” antes de HIG; tag `pre-hig` | `git show -s 4d33a46`; tag |
| 15:43 | `7f107f9` | Auditoría base HIG y skill fijada (F0–F1); tag `hig-baseline` | commit/tag |
| 15:44 | `5d1c219` | Marca F0–F1 completos | commit |
| 16:00 | `74730e1` | Contrato de diseño HIG (F2); tag `pre-hig-merge` | commit/tag |
| 18:48 | `efb8145` | Implementa F3 y repara bloqueadores de verificación | commit |
| 19:41 | `e2ebdf1`, `a13270f` | Cierra verdad cash/demo, focus trap y 200 %; registra verificación independiente | commits |
| 20:20 | `36064d4`, `0355307` | Cierra pago mixto, entrega en actividad y 200 %; segunda verificación | commits |
| 21:09 | `ea43436`, `803df67` | Escala texto grande y nombres largos al 200 %; tercera verificación | commits |
| 22:03 | `504e824`, `7aa250b` | Envuelve descripciones y mejora copy de dinero/error al 200 %; cuarta verificación | commits |
| 22:51 | `82aa986` | Cierra F3 con veredicto independiente **LISTO** | commit; rama `hig-redesign` |
| 22:51 | `3cf4444` | Merge “HIG Mostrador claro” (F3 aprobado) | commit |

**Lectura:** el 31 de octubre se construyó y verificó “Mostrador claro”. No es la dirección “barrio” actual; es la base sobre la que se siguió iterando.

---

## 3 · 1 de noviembre: voz, accesibilidad, harness y P0 de producto

| Hora | Commit | Hecho | Fuente |
|---|---|---|---|
| 07:47 | `15c9584`, `5169f29` | Detiene speech synthesis repetido; permite HIG contra producción | commits |
| 08:05 | `229e209` | Voz Kokoro open-source para frases fijas | commit |
| 08:30 | `86bbaec`, `fcfb1bd`, `396556f` | Confirmación de fiado en transcript; regenera video/QR/auditorías; actualiza status/runbook | commits |
| 08:31 | `672031b` | Ignora video crudo de Playwright | commit |
| 08:34 | `a140b98` | Actualiza pitch y test de usuario | commit |
| 09:33 | `05562c2` | Kokoro `em_santa` + Piper para voz dinámica | commit |
| 09:34 | `79ddb1a` | Refresca auditorías tras voz | commit |
| 10:03 | `a737747`, `556b0c8`, `1a59581` | Controles de texto/contraste/voz; docs de accesibilidad; auditorías | commits |
| 10:04 | `1f2b095` | Graba video con UI accesible | commit |
| 10:52 | `9895902` | Ajusta copy a11y, cues de voz y assets TTS | commit |
| 10:58 | `e8df1cb` | Arnés swarm verificado end-to-end | commit |
| 11:07 | `8c76cc4` | Packs de skills por carril (11 vendorizadas); ramas `swarm/*` | commit |
| 13:36 | `2c52a82`, `3c889bc` | Aplica revisión de stageshow; separa pagos demo; refresca video/auditorías | commits |
| 13:41 | `d78597b` | Añade `GOAL-ACOMPANAMIENTO.md` (carga cognitiva) | commit |
| 13:59 | `999848f` | Añade harness: router de contexto, gates deterministas, evidencia | commit |
| 14:03 | `3c9a287` | Registra evidencia full y auditorías refrescadas | commit |
| 14:04 | `26d06ce` | Ata evidencia al commit de código | commit |
| 15:39 | `fabae3c` | Vender sin IA, cambio y borrador durable | commit |
| 15:40 | `3589860` | Evidencia static de P0 venta durable | commit |
| 16:16 | `003de04` | Cierra hallazgos P0 de venta durable | commit |
| 16:17 | `f5bce81` | Evidencia P0 revisión 2 | commit |
| 16:48 | `37286fe` | Aísla pendiente por id y aclara avisos | commit |
| 16:48 | `bba631e` | Evidencia P0 revisión 3 | commit |
| 17:07 | `8ca16c9` | Conserva banner editable y amplía evidencia | commit |
| 17:09 | `a7a6088` | Evidencia P0 revisión 3 final; rama `p0/venta-durable` | commit |
| 17:11 | `c22e85d` | Merge de venta sin IA, cambio y borrador durable | commit |
| 17:18 | `4f4a105`, `2145d11` | F0 audit, resultado P0 y handoff; auditorías/E2E P0 | commits |
| 17:22 | `6e0e7e5` | Evidencia full limpia P0 | commit |
| 17:55 | `972d5f2` | Confirma abonos y unifica saldo vivo (fiado) | commit |
| 17:58 | `20ad960` | Evidencia static P0 fiado | commit |
| 18:00 | `e4fc477` | Evidencia E2E P0 fiado | commit |
| 18:42 | `0eddea2` | Idempotencia durable y borrador honesto | commit |
| 18:43–18:47 | `7ea5f67`, `62ca6f2`, `5a857f8`, `9d4b8cc` | Regresión venta, evidencia fiado, static y reporte corregido | commits |
| 18:59 | `80bd574` | No inventa devuelto en abonos duplicados | commit |
| 19:00–19:03 | `0c67f77`, `1181967`, `40f5d67`, `fba1f62` | Evidencia tras fix de duplicados; cierra reporte fiado | commits |
| 19:05 | `586f1a6` | Merge de abono confirmado, saldo vivo e idempotencia durable | commit |
| 19:13 | `a213d71`, `446f2f7` | Docs P0-C; evidencia full/E2E | commits |
| 19:17 | `1d5d8a6` | Evidencia full limpia P0-C | commit |
| 19:18 | `be26105` | Actualiza STATE tras P0-C | commit |
| 20:03 | `2ba2a33` | Voz: método de abono y consultas de deuda | commit |
| 20:08 | `3f8307a` | Dashboard: pendientes de cualquier fecha | commit |
| 20:15 | `e0be811` | Shell 200 % legible y errores honestos | commit |
| 20:20 | `81c7918` | Evidencia shell solo contra cambios de web | commit |
| 20:26 | `7cab7a5` | Reporte P0-F, HIG y E2E de errores | commit |
| 20:28 | `5242891` | Franja de cobros pendientes y fechas de actividad | commit; rama `p0/pendientes` |
| 20:29 | `bf2eec6` | Voz responde deudas y clasifica métodos | commit; rama `p0/knowns` |
| 20:42 | `0cce0df` | Backend de tareas y panel autocontenido | commit; rama `p0/pendientes-negocio` |
| 20:44 | `5752039`, `ab56be4`, `e9f918e` | Voz, franja y backend de tareas | commits |
| 21:10 | `27d42c8` | Shell: nombre accesible, JSON tolerante y venta visible a 768 | commit |

**Lectura:** el 1 de noviembre se construyó la mayor parte del producto P0 (venta, fiado, corte, pendientes, shell) y se endureció el harness. Los conteos de gates cambiaron durante el día; no son un estado único.

---

## 4 · 2 de noviembre: cierre, seguridad, rendimiento y fusión final

| Hora | Commit | Hecho | Fuente |
|---|---|---|---|
| 06:35 | `c0434e3`, `f828cbc` | Actualiza tamaño del video y “cierre versionado” en video de respaldo | commits |
| 06:36 | `772bb3c` | Registra probe de requestId en contexto inseguro | commit |
| 06:37 | `cd34405` | Añade gate de movimiento | commit |
| 06:41 | `917ef0a`, `7a1d75f` | Full 12/12 con motion; actualiza timestamp | commits |
| 06:43 | `ce36e62` | Añade gate de alto contraste | commit |
| 06:47 | `5ae223c`, `abe1f78`, `e439e18` | Full 13/13; refresca evidencia; pagos sin cambios | commits |
| 07:17 | `00216e3` | Capa editorial de papel para el mostrador | commit |
| 07:22 | `2e9a293`, `d0c9ede` | Registra capa editorial; refresca capturas | commits |
| 07:23 | `dfb5e76` | Actualiza tamaño del video rediseñado | commit |
| 07:28 | `219b26f` | Barrido de papel ASLI entre destinos | commit |
| 07:32–07:38 | `91ad4ee`, `a1cdbf4`, `5f0ab9c`, `7bb0dc5` | Evidencia 13/13 con ASLI; tag `pre-remediation` | commits/tag |
| 08:38 | `8dc2b4f` | Cierra carreras e idempotencia en pedidos y metas | commit |
| 08:38 | `fdff48e` | Harness complete-mode, evidencia clean-SHA y deps | commit |
| 08:43 | `f48584e` | Alinea conteo de ensayo y catálogo dinámico | commit |
| 08:44 | `adb3db5` | Endurece demo API, reset y headers | commit |
| 09:54 | `28abb26` | Idempotencia y transacciones de pedidos/metas | commit |
| 10:07 | `c0a9200` | Merge de datos y seguridad | commit |
| 10:09 | `a922a64` | Merge de harness estricto y evidencia | commit |
| 10:14 | `2c48544` | Conserva texto crudo al teclear dinero | commit |
| 10:15 | `a2b187b`, `9b5dd07` | Separa demo de dinero real; ignora `__pycache__` | commits |
| 10:15 | `9193e0a` | A11y 200 %, foco, placeholder y labels | commit |
| 10:16 | `76ce5ee`, `2990581` | Merge tecleo/flujos; evidencia dinero | commits |
| 10:43 | `31f8439` | Merge accesibilidad en caja | commit |
| 11:29 | `3a8cea9` | Merge verdad del dinero | commit |
| 11:47 | `63b9cff`, `f8dbdf1` | Perf core (fonts/assets/cache) y a11y shell | commits |
| 11:56 | `7238028` | Unifica shell, tipografía y checkout público | commit |
| 12:07 | `580df7a`, `669ab50` | Perf data: índices, batch, caché; evidencia fast | commits |
| 12:08 | `87ebd0c`, `b7af403` | Reporte perf-data; merge a11y follow-up | commits |
| 12:22 | `4bd271e` | Merge diseño editorial y checkout | commit |
| 12:35 | `449700a` | Merge rendimiento core | commit |
| 12:48 | `c0248ba` | Merge rendimiento de datos y API | commit |
| 13:24 | `29bb243` | Harness v2: evidencia estricta atada al build | commit |
| 13:27 | `26aead5` | CI incluye perf-data | commit |
| 13:29 | `c1d99e2` | Registra baseUrl/buildSha por gate | commit |
| 13:39 | `3427d72` | Playwright CSP-safe y mobile-320 | commit |
| 13:42 | `199bc7d` | Mobile: reintentos idempotentes, 320 y éxito honesto | commit |
| 13:44 | `f8db832` | Harness exige schema v2 exacto | commit |
| 13:45 | `23f0375` | Merge mobile QA | commit |
| 13:52 | `3b2873d` | Merge master mobile QA en harness v2 | commit |
| 13:54 | `a0de42e` | Preserva versiones y conflicto de requestId | commit |
| 14:09 | `c51e271` | Merge data-mig en harness v2 | commit |
| 14:14 | `c3c8155` | Docs harness: data 85, p0-fiado 51, puertos aislados | commit |
| 14:15 | `b877ee3` | SSR inicial y skeleton de checkout | commit |
| 14:18 | `2ee1e81` | Merge datos, migraciones y requestId | commit |
| 14:19 | `b8540b1` | Merge master 2ee1e81 en harness v2 | commit |
| 14:31 | `665d72e`, `e8e208f` | Merge harness v2 y SSR/checkout/perf móvil | commits |
| 14:37 | `fe26e94` | Checkout aislado y full sin fail-fast | commit |
| 14:39 | `572847d`, `3fe1cc9` | WIP dirección barrio; webhook aislado con DB temporal | commits |
| 15:23–15:28 | `844bb27`, `d0728d1` | Ensayo estable tras pago demo; ignora TTS 503 esperado | commits |
| 15:28 | `75179c7` | Merge ensayo estable y corte 550 | commit |
| 15:34 | `9da8622` | Seguridad: límites, retención y errores P2 | commit |
| 15:36 | `0c052c4` | Merge endurecimiento seguridad P2 | commit |
| 15:37 | `5e31eba` | Corrige corte 550, video histórico y estado honesto | commit |
| 15:38 | `fa4b575` | Merge docs honestos de demo | commit |
| 16:06 | `dd3e3c9` | Dirección “amable y de barrio” (rama `p0/design-final`) | commit |
| 16:13 | `f397419` | Evidencia p0-dinero fuera de git | commit |
| 16:18 | `fe08c17`, `15de820` | Harness full limpio y evidencia íntegra | commits |
| 16:20 | `ccfed4a` | Merge harness P0 con checkout aislado | commit |
| 16:30 | `3663d29` | Merge harness P0 final | commit |
| 16:47 | `4db08a0` | Separa demo/real en fiado, reset y requestId | commit |
| 16:49 | `bcaec5d`, `71bc4ed` | Merge separación demo/real; docs harness webhook 40/40 | commits |
| 18:13 | `b1622f9` | Goal de demo y evidencia final | commit |
| 19:00 | `5d3fa30` | Estructura de mostrador y libreta (barrio) | commit |
| 19:02 | `c395e3e` | Video por roles y verificación MP4/stageshow (rama `p0/fix-video`) | commit |
| 19:07 | `72d405f` | Quita mesh amarillo/verde; papel plano | commit |
| 19:09 | `343c7d0` | Micro limpio y margen suave | commit |
| 19:18 | `4f388e7` | Centra icono del micro y alinea pestañas | commit |
| 19:21 | `499a301` | Contrato de carga y acompañamiento | commit |
| 19:25 | `bbf03de` | Fase de carga cognitiva y aceptación | commit |
| 19:42 | `ddf2262` | Venta manual sin IA y borrador con decisión | commit |
| 19:43 | `42d8f3f` | Auditoría de carga cognitiva en `499a301` | commit |
| 19:45 | `82709f2` | Checklist “Antes de cerrar” en Corte | commit |
| 19:46 | `b5c59e1` | Orden de carriles cognitivos | commit |
| 19:50 | `7b730bf` | Consultas locales antes del parser | commit |
| 19:56 | `a1439c3` | Preferencias “¿Cómo quieres que te ayude?” | commit |
| 19:56 | `207d369` | Reporte sin IA | commit |
| 19:57 | `6012b65` | Reporte cierre cognitivo | commit |
| 19:58 | `7b1ab92` | Merge sin-ia en cognitive-integration | commit |
| 19:59 | `ddd87dc` | Merge master en cognitive-integration | commit |
| 20:00 | `8fd54a6`, `ff156ec` | Merge sin-ia y cierre-cognitivo en design-structure | commits |
| 20:01 | `539a547` | Reporte/evidencia preferencias | commit |
| 20:05 | `8602bf2`, `dfb2b79` | Merge preferencias; verdad de pago | commits |
| 20:07 | `397039d` | Merge verdad-pago en design-structure | commit |
| 20:13 | `7a178a5` | Test sin-ia: etiqueta canónica de efectivo | commit |
| 20:46 | `e6f3107` | Merge master en HEAD (carril rehearsal) | commit |
| 20:54 | `fe97c00` | Evidencia de preferencias sobre merge final | commit |
| 20:55 | `517cb93`, `2fb0ca4` | Handoff de cierre; merge master en final | commits |
| 20:56 | `d35c791`, `b7154ca` | Comando correcto de preflight; merge final master→final | commits |
| 21:29 | `b7154ca` | Se crean `p0/context-recovery`, `p0/supervisor`, `p0/adversarial` desde el mismo HEAD | reflog |
| 21:50 | `3939133` | `p0/adversarial` publica auditoría adversaria de `b7154ca`: 2 P0, 5 P1, 7 P2; build OK, webhook 40/40, security 48/48, servidor aislado `:3317` | `AUDITORIA-ADVERSARIA.md`; `adversarial.json` |
| 21:51 | `ca3f95c` | `p0/supervisor` publica auditoría del handoff/estado de cierre | commit |
| 21:54 | `a85d903` | `master` avanza solo con docs: “⛔ NO MERGEAR TODAVÍA” por 2 P0 | `git show a85d903` |
| 21:54 | `2a786f1` | `p0/final-cognitive` mergea `a85d903`; código de producto sigue en `b7154ca` | commit |
| 21:56 | `65c9b4f` | Se crea el contexto recuperado en `p0/context-recovery` | commit de contexto |

**Lectura:** el 2 de noviembre se integraron los carriles cognitivos en `p0/design-structure`, se creó `p0/final-cognitive` a las 20:46 y se hizo el merge de `master` a las 20:56. El handoff (`517cb93`) se escribió **antes** de ese merge; por eso su SHA de `master`/rama no coincide exactamente con el estado final. A las 21:50–21:54, la auditoría adversaria encontró 2 P0 y `master` añadió un bloqueo explícito de merge; la final (`2a786f1`) solo incorporó ese documento, no una corrección.

---

## 5 · Después del snapshot (futuro, no ocurrido)

| Fecha | Hecho planificado | Fuente | Estado |
|---|---|---|---|
| 7 nov 2026, 10:00–16:00 | Hackathon DevDay Exchange, UTOPÍA Elena Poniatowska, Coyoacán | `README.md:5`; `PLAN-8-DIAS.md:4` | **FUTURO** |
| 7 nov 2026 | Demo de 3 minutos en modo `demo_paid` | `RUNBOOK-DEMO.md:59-126` | **FUTURO / plan** |
| 8 nov 2026, 13:00 | Entrega | `PLAN-8-DIAS.md:5` | **FUTURO** |

No hay commits de producto después del 2 de noviembre de 2026 20:56. Los commits posteriores son documentales: auditoría adversaria (21:50), supervisión (21:51), bloqueo de merge en `master` (21:54), merge de ese doc en la final (21:54) y el contexto recuperado (21:56). El worktree de recuperación se creó a las 21:29.

---

## 6 · Cronología de la deuda de video (importante para el cierre)

| Fecha/hora | Evento | Evidencia |
|---|---|---|
| 1 nov 08:30 | Se regenera video/QR/auditorías tras “Mostrador claro” | `fcfb1bd`, `396556f` |
| 2 nov 06:35 | Se actualiza el tamaño del video de respaldo | `c0434e3` |
| 2 nov 07:23 | Se actualiza el tamaño del video rediseñado | `dfb5e76` |
| 2 nov 19:02 | `p0/fix-video` reescribe `record-demo.py` y valida MP4/stageshow; reporta MP4 177.64 s en temp | `c395e3e`; `p0-fix-video-report.md` (en esa rama) |
| 2 nov 19:00–19:18 | Se integra la libreta barrio (`5d3fa30` + fixes) | commits |
| 2 nov 20:56 | HEAD final no incluye `c395e3e` | `git merge-base --is-ancestor c395e3e HEAD` → no |
| Snapshot | El MP4 versionado sigue siendo 39.76 s, 1,704,744 B, “Mostrador claro” | `ffprobe`; `demo/mercado-cero-demo.mp4` |

**Conclusión:** el video final no existe en el repo. El MP4 actual es anterior a la libreta barrio y anterior al rediseño final. Los scripts para grabar el final están en una rama no mergeada.

---

## 7 · Cómo leer las fechas

- Las fechas de commits son la fuente más confiable; los documentos a veces dicen “2 nov 2026” sin hora.
- `demo/STATUS.md` y `harness/STATE.md` tienen “corte de estado” con SHA de una base anterior (`3fe1cc9`); no son el estado del HEAD.
- `HANDOFF-CIERRE.md` se escribió a las 20:55, un minuto antes del último merge de `master`; su descripción de la rama final es casi actual, pero no exacta.
- `GOAL-CIERRE-DEMO.md` se escribió a las 18:13, cuando `master` era `71bc4ed`; después `master` avanzó a `d35c791` y luego a `a85d903`. Su SHA de partida está desactualizado.
- La fecha de hoy del entorno es 2 de noviembre de 2026; el hackathon es el 7. No hay que confundir “hoy” con “día del hackathon”.
