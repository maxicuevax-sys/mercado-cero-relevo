# PROMPTS — Debug completo Trangui / Mercado Cero

Fecha: 2026-11-08  
Producción: https://xn--hw9h.st  
GitHub: https://github.com/maxicuevax-sys/mercado-cero-relevo  
Main al iniciar esta auditoría: `84afe873b70170e80ffc85bc7b3f4f1bf75ced9a`  
Repo local de referencia: `C:\Users\Elitebook 840 G8\Documents\ChatGPT\Mercado Cero\trangui-identidad`

Documento recuperado selectivamente de `docs/prompts-debug-completo`, commit `e100c393`; no se mezcló su rama completa. Las identidades anteriores son un snapshot de inicio, no sustituyen `/api/health` ni `git rev-parse`. La autorización y el alcance vigentes pertenecen al usuario. Los prompts son una lista de verificación, no evidencia de ejecución.

## Cómo usarlo
1. Usa **un prompt por sección** y un worktree/rama por writer.
2. Primero auditoría read-only; después fix; después verificación independiente.
3. Ningún subagente despliega a producción: el Lead integra, despliega y actualiza `main`.
4. Prohibido imprimir secretos, pegar API keys o ejecutar cobros reales.
5. Toda afirmación necesita captura/JSON/status HTTP. Sin evidencia = no está hecho.

## Contexto fijo para pegar al inicio de cualquier prompt
```text
CONTEXTO FIJO
- App: Trangui (Mercado Cero), Next.js 16 + React 19, Better Auth, SQLite, DEMO_MODE=true.
- Producción: https://xn--hw9h.st — build comprobado 4662d7a.
- GitHub: https://github.com/maxicuevax-sys/mercado-cero-relevo — main 84afe87.
- Repo de trabajo: C:\Users\Elitebook 840 G8\Documents\ChatGPT\Mercado Cero\trangui-identidad.
- Producción no se toca desde este prompt: solo lectura. No DNS, no 443, no CyberPanel, no correo, no otros contenedores.
- No ejecutes pagos reales ni pidas datos bancarios. Usa sesión guest y datos demo.
- No imprimas ni pegues secretos. La config privada vive fuera del repo y se referencia por ruta, nunca por valor.
- Navegadores: Chromium desktop y Playwright WebKit iPhone 13 emulado. Viewports 320x569, 390x844, 1448x1086.
- Evidencia obligatoria: URL, status, selector, consola, screenshot y JSON. Un build no es prueba visual.
```

---

## PROMPT 00 — Coordinador / Lead de debug
```text
Eres el Lead de una auditoría completa de Trangui (Mercado Cero), en producción y en el repo.
Primero crea un plan por secciones y asigna un subagente por sección con write scopes disjuntos.
No permitas que dos agentes editen el mismo worktree. No permitas deploy directo desde subagentes.
Orden:
1) inventario de rutas y estado real de producción/GitHub;
2) auditoría read-only de cada sección en WebKit/Chromium, 320/390/1448;
3) fixes en ramas aisladas;
4) gates: typecheck, lint, build, security, demo-pay, voice;
5) verificación visual y funcional independiente;
6) integración, deploy con backup/rollback, health y actualización de main.
Reporta matriz sección → estado → defecto → evidencia → decisión GO/NO-GO.
Prohibido declarar “listo” sin captura y sin prueba pública después del deploy.
```

---

## PROMPT 01 — Acceso, registro, login, guest, sesión (iPhone prioritario)
```text
Audita y corrige el acceso de Trangui: /acceso, /registro, onboarding y sesión.
Prioridad: iPhone/WebKit. Prueba:
- escribir email y contraseña reales en WebKit; foco, autofill, teclado y submit;
- contraseña de 1 carácter y contraseña larga; sin mínimos/máximos en UI;
- “Entrar sin cuenta” → /onboarding → /inicio;
- registro nuevo → login → logout → volver a entrar;
- email duplicado y mensaje visible (no genérico);
- sesión tras reload y segunda pestaña; logout borra cookie y no permite back;
- dos guests: datos aislados;
- 8 intentos fallidos: no debe haber 429 de auth.
Revisa components/auth, lib/auth, app/api/access, app/acceso, app/registro.
No toques producción. Evidencia: status, cookies (nombres/flags), screenshots WebKit + Chromium.
Criterio: ningún usuario demo queda bloqueado; errores claros; 0 pageerrors.
```

---

## PROMPT 02 — Inicio/hub CoDi, KPI, hero y overflow
```text
Audita /inicio en 320/390/1448, WebKit y Chromium.
Comprueba:
- header, logo, campana, avatar, altura y espaciados;
- saludo, KPIs y sus números centrados/legibles; sin espacios muertos;
- hub “Cobrar con CoDi”: input, chips $0.01/$20/$50/$100, CTA, límites y foco;
- imagen superior derecha sin overflow (derecha <= viewport);
- navegación central QR y “Más”; link del QR a /inicio#cobrar-codi;
- card “Nueva venta”, accesos y Pendientes;
- foco programático sin recuadros visibles;
- errores de consola/red.
No cambies la estética validada sin evidencia visual A/B. Evidencia 3 viewports y rects.
```

---

## PROMPT 03 — Cobrar CoDi: $0.01, QR, estados
```text
Audita /inicio#cobrar-codi y el flujo CoDi en demo.
- $0.01 debe llenar el input, habilitar “Cobrar $0.01” y crear una orden demo;
- el QR debe ser demo y decir “no cobra dinero real”;
- “Esperando pago” → “Simular pago CoDi” → “Pago simulado”;
- no debe crear dos órdenes al reintentar; no debe marcar paid sin confirmación;
- “Nuevo cobro”, “Consultar estado”, estados vacío/vencido/cancelado;
- importes inválidos, 0, negativos y máximos;
- el QR visible no debe presentarse como dinero recibido.
No actives el riel real de Pey ni cobres de verdad. Prueba API real de demo y captura.
```

---

## PROMPT 04 — Caja/Nueva venta, texto, micrófono, interpretar, ticket
```text
Audita /caja en 320/390/1448 con Chromium y WebKit.
- Escribir “2 tacos de 35 y un agua de 20” → Interpretar → propuesta correcta;
- Añadir al ticket → 2 conceptos, total correcto, ticket consistente;
- micrófono: permiso, grabar, detener, transcribir, propuesta; audio silencioso debe dar error claro y volver a idle, nunca quedarse “Escuchando…”;
- métodos Efectivo/Tarjeta/QR CoDi, monto directo, teclado, borrar, descartar;
- no precargar tortilla/huevo/refresco; no duplicar líneas;
- botones de cámara/escáner: cámara debe abrir; si el navegador no soporta, mensaje claro;
- registrar venta demo y comprobar ticket/estado;
- consola, red, 44px táctil y overflow.
No ejecutes ventas reales ni pagos reales.
```

---

## PROMPT 05 — Ventas y detalle
```text
Audita /ventas y /ventas/[id] en móvil y escritorio.
Comprueba listado, KPIs, filtros, paginación, “Ver detalle”, conceptos, cliente, método, estado, demo vs dinero real, totales y enlaces de regreso.
Verifica que una venta demo nunca diga “cobrado real” y que el detalle coincida con Movimientos.
Prueba 0 datos, muchos datos, 320px, teclado, consola y red. Evidencia con capturas.
```

---

## PROMPT 06 — Movimientos y detalle
```text
Audita /movimientos y /movimientos/[id].
- Filtros Todos/Pendientes/Pagados y query ?filtro=...
- KPIs: por cobrar, dinero recibido, pago demo; nunca sumar QR/demo como dinero real.
- Filas: SOLICITUD vs DINERO, QR/link, pagos, fiado, vencido/cancelado.
- Detalle: QR no es ingreso; pagos registrados visibles; enlace de regreso.
- Paginación, empty states, 320px, WebKit, consola/red.
- Títulos sin outline de foco; sin links rotos.
No cambies la semántica financiera para “que se vea bonito”.
```

---

## PROMPT 07 — Pendientes y tareas
```text
Audita /pendientes y /pendientes/nuevo.
- Crear tarea → al volver debe aparecer inmediatamente sin reload; no stale-list.
- Tabs Hoy/Completados, búsqueda, completar/reabrir, posponer, borrar.
- Evitar CTA “Nuevo pendiente” duplicada; un solo CTA visible por viewport.
- Banner “Pendiente guardado” y contadores coherentes.
- Cobros pendientes: “Cobrar” → /inicio?pedido=... con la misma orden, QR y estado.
- 0 tareas, 1 tarea, muchas, 320px, WebKit, consola/red.
```

---

## PROMPT 08 — Fiados
```text
Audita /fiados y /fiados/[id].
- Saldo, abonos, historial, cliente, estado, distinción deuda vs dinero recibido.
- Crear abono demo/efectivo/digital; validar montos; no permitir sobrepago.
- Enlace “Cobrar con CoDi” debe abrir el hub sin fingir que el pago ya se aplicó.
- Empty state, muchos datos, 320px, WebKit, consola/red.
```

---

## PROMPT 09 — Corte
```text
Audita /corte, /corte/historial y cierre de caja.
- Totales, métodos, efectivo/digital/fiado/pendiente, diferencia y guardado.
- Un QR/demo no debe sumar como dinero real; no cerrar corte con datos inconsistentes.
- Persistencia, volver/abrir, empty state, 320px, escritorio, consola/red.
```

---

## PROMPT 10 — Metas
```text
Audita /metas.
- Progreso, meta semanal/mensual, cálculo, textos, CTA, inputs y estados vacíos.
- Coherencia con pagos confirmados; demo separado de real.
- 320/390/1448, WebKit, teclado, consola/red.
```

---

## PROMPT 11 — Ajustes, notificaciones, ayuda, accesibilidad
```text
Audita /ajustes, /notificaciones, /ayuda y /acceso.
- Ajustes: negocio, cobros, notificaciones, seguridad, voz, demo, respaldo, logout.
- “Cerrar sesión” elimina cookie y manda a /acceso; back no restaura.
- Notificaciones: X/cerrar vuelve a /inicio; enlaces correctos.
- Accesibilidad: texto grande, alto contraste, persistencia, switch de voz, foco visible y navegación teclado.
- Evita controles dentro de <details> demasiado escondidos; propone mejora si aplica.
- 320/390/1448, WebKit/Chromium, 0 pageerrors.
```

---

## PROMPT 12 — Onboarding
```text
Audita /onboarding.
- Guest y cuenta nueva → elegir giro → entrar a /inicio.
- Validaciones, volver, estado, persistencia, nunca dejar cuenta sin negocio.
- 320/390/1448, WebKit, capturas y red.
```

---

## PROMPT 13 — Responsive, visual y accesibilidad transversal
```text
Haz auditoría transversal de todas las rutas en 320x569, 390x844 y 1448x1086, WebKit y Chromium.
- scrollWidth == innerWidth; ninguna imagen/tarjeta fuera de viewport;
- elementos táctiles >=44px, foco visible, contraste, zoom 200%;
- títulos sin recuadros de foco programático;
- CTA duplicadas, textos cortados, labels que se parten;
- comparación visual contra referencias/captura previa; sin cambiar la estética sin aprobación.
Entrega matriz ruta × viewport × motor con PASS/FAIL y capturas.
```

---

## PROMPT 14 — Deploy de producción con rollback
```text
SOLO LEAD, con autorización explícita. No ejecutes desde un subagente.
Despliega un commit verificado de Trangui a https://xn--hw9h.st.
Contexto: VPS zicua-vps, /opt/mercado-cero/public-emoji, contenedor trangui-public-emoji, loopback 4597, relay 4598, STT host systemd 172.30.0.1:4097.
Procedimiento:
1. git status limpio; HEAD = commit a desplegar; build local/typecheck/tests.
2. git archive del commit; subir a /opt/mercado-cero/pilot/releases/<sha>/source.
3. docker build --build-arg BUILD_SHA=<sha> -t trangui-public-emoji:<short> .
4. Verificar .next/BUILD_SHA de la imagen antes de tocar producción.
5. Crear rollback-<short> con compose.json, runtime.env, deployment.json y snapshot de cuentas.
6. Parchear imagen y EXPECTED_BUILD_SHA/JUDGE_RELEASE_SHA atómicamente; docker compose config; up -d --no-build --pull never.
7. Esperar health local y HTTPS == SHA; verificar counts sin cambios.
8. Si falla: restaurar compose/env y up -d; nunca down -v, nunca prune.
9. No tocar DNS, 443, CyberPanel, LSCache, correo, certificados ni otros contenedores.
10. Documentar health, imagen, rollback y evidencia.
```

---

## PROMPT 15 — Cierre de GitHub (rama, PR, main, CI, release)
```text
Deja el repositorio https://github.com/maxicuevax-sys/mercado-cero-relevo cerrado y coherente.
Reglas: no force-push, no borrar ramas sin autorización, no imprimir secretos.
Pasos:
1. git fetch --prune; revisar main, ramas remotas, worktrees y PRs abiertos.
2. Verificar que main == commit desplegado en producción; si no, fast-forward/merge autorizado.
3. Comprobar .gitignore (datos, DB, .env, backups, capturas temporales); escanear que no haya secretos en árbol actual; no reescribir historia.
4. Revisar CI/workflows, scripts de build/tests, README, docs de deploy, STT host y rollback.
5. Abrir/actualizar PR con resumen, riesgos, tests y evidencia; no auto-merge sin verificación.
6. Crear tag/release del SHA de producción y notas breves.
7. Listar ramas/worktrees obsoletos y proponer limpieza; ejecutar solo con aprobación.
8. Reportar: main SHA, PR, tag, CI, ramas pendientes, secretos (solo “OK/sin hallazgos”), rollback.
Criterio: cualquiera puede clonar, entender el estado y reproducir el deploy sin secretos en el repo.
```

---

## PROMPT 16 — Verificador independiente final
```text
Eres verificador independiente. No edites código, no reinicies, no deployes.
Contra https://xn--hw9h.st y main:
- health SHA coincide con main; contenedor healthy; STT activo.
- guest/login/logout WebKit; contraseña 1 carácter; sin 429.
- $0.01 demo → QR → simular; no dinero real.
- Nueva venta texto + mic + Interpretar + ticket.
- Un pendiente creado aparece al volver; no stale.
- Audio silencioso: 422 y UI vuelve a idle con mensaje.
- Rutas completas 200; 0 pageerrors; 0 assets/API roto; 320/390/1448 sin overflow.
- Cache: no CDN, HTML no-store, assets hashed, sin service worker.
- GitHub main/tag/PR coherentes y sin secretos.
Devuelve veredicto GO/NO-GO, matriz de evidencia y rollback path. No aceptes “debería funcionar”.
```
