# 02 · Acciones realizadas (historial comprobable)

> No se incluyen acciones sin evidencia. Donde no hay traza suficiente se marca **NO VERIFICADO**.
> El «agente» es el orquestador de esta sesión salvo que se indique una invocación de subagente con sessionID.

| # | Acción | Agente | Herramienta | Archivo(s) | Motivo declarado | Referencia / requisito | Prueba | Resultado verificable | Riesgo | Decisión |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Leer ZIPs de kit y rescate, y verificar integridad | Orquestador + subagentes de auditoría | shell, read, subagent | `design-references/mercado-cero*` | Entender el encargo antes de tocar UI | `LEEME_PRIMERO.md`, `02_PROMPT_DE_RESCATE_OPENCODE.md` | `verificar_kit.py` (kit), listado del ZIP rescate | 56 SVG/86 PNG/10 agentes; ZIP 11 archivos legible | Bajo | Conservar |
| 2 | Copiar kit de rescate al repo | Orquestador | robocopy | `design-references/mercado-cero-rescate/` | Dejar referencia canónica y protocolo en el árbol | `LEEME_PRIMERO.md` | `Get-ChildItem` | 11 archivos presentes | Bajo | Conservar |
| 3 | Rediseño visual amplio de Caja/shell (`a989878`) | Orquestador | edit, shell, assets | `globals.css`, `barrio.css`, `caja-app.tsx`, `assets/brand` | Nueva dirección “Mercado de papel” | Mockups del usuario | HIG/mobile/contraste en su momento | 5 viewports, 25/25, 7/7 en esa fase | **Alto**: conservó arquitectura Caja-first y comparó Inicio contra Caja | **Revisar**: no revertir en bloque; evaluar por parche |
| 4 | Correcciones HIG/contraste (`0a5d7ba`) | Orquestador | edit, shell | `barrio.css`, `caja-app.tsx` | Resolver 112 hallazgos HIG | Reporte HIG | HIG 5 viewports | HIG OK; mobile 25/25; contraste 7/7 | Medio | Conservar |
| 5 | Coherencia de estados/ilustraciones (`aa40b10`) | Orquestador | edit | `barrio.css`, `caja-app.tsx`, `pending-tasks.tsx`, `pending-payments.tsx` | Unificar estados y dominio de ilustraciones | Auditoría de paridad | HIG/mobile/contraste; p0 | P0 51/0, 69/0, 66/0, 73/0; HIG OK | Medio: cambio amplio de CSS | Conservar con revisión |
| 6 | Crear ruta `/inicio` y CSS propio | Orquestador | write, edit | `web/src/app/inicio/page.tsx`, `inicio.css` | Separar dashboard de Caja | Rescate Fase 1 / blueprint | Build + captura 1448×1086 | Inicio activo; 4 KPIs en fila; hero/pendientes/sugerencia en orden | Alto si no se valida; shell duplicado | **Conservar y corregir** |
| 7 | Recortar assets de la referencia canónica | Orquestador | Python/PIL | `web/src/assets/inicio/*.png` | Usar motivos reales, no generar | `07_NOTA_SOBRE_ASSETS.md` | Comparación visual + auditoría de assets | Hero/sugerencia/picado/sidebar presentes; hero opaco, sugerencia cortada, sidebar con halo | **P0/P1 visual** | **Revisar**: producir cutouts limpios |
| 8 | Añadir `?tab=` e `initialTab` a Caja | Orquestador | edit | `page.tsx`, `caja-app.tsx` | Navegación desde Inicio a destinos existentes | Blueprint / rutas | Prueba Playwright `/`, `/?tab=fiado|corte` | `/` sigue Caja; deep links iniciales funcionan; URL no se sincroniza al cambiar tab | Bajo | Conservar; probar back/forward |
| 9 | Añadir enlaces de marca a `/inicio` desde Caja | Orquestador | edit | `caja-app.tsx` | Volver a Inicio sin agregar un sexto tab | Criterio de navegación | Playwright desktop/mobile | Marca/topbar vuelven a `/inicio` | Bajo (recarga completa) | Conservar |
| 10 | Cambiar `start_url` y colores del manifest | Orquestador | edit | `web/src/app/manifest.ts` | PWA abra Inicio | Decisión de producto no confirmada | No ejecutada | Cambio presente; además se detectó `Â·`/BOM | **Medio**: regresión de encoding y cambio de producto | **Revisar / aprobar explícitamente** |
| 11 | Ajustes móviles de Inicio | Orquestador | edit | `inicio.css`, `page.tsx` | Evitar CTA recortado y marca “MercadoCero” | Verificador B2/B3 | Playwright 390 | CTA dentro del ancho; nav envuelve; Ayuda/Ajustes visibles; CTA aún bajo el pliegue | Medio | Conservar con QA móvil |
| 12 | Hacer transparente el arte del sidebar | Orquestador | Python/PIL | `sidebar-plantas.png` | Integrar con verde del sidebar | Auditoría de assets | Diff de píxeles | 31% transparente; halo/motas visibles | Medio | **Revisar** |
| 13 | Rebuild y captura canónica 1448×1086 | Orquestador | npm build, Playwright | `.next`, `rescate-inicio/inicio-1448x1086.png` | Evidencia de Fase 1 | `05_PROTOCOLO_DE_CAPTURAS.md` | Captura + metadata | 1448×1086, DPR1, fuentes cargadas, Inicio activo | Bajo; árbol sucio invalida handoff | Conservar como evidencia de WIP |
| 14 | Auditorías independientes A–D | `general` (equivalente a mc-auditoria-repo, mc-sistema-diseno, mc-shell-responsive, mc-accesibilidad) | subagent | `quality-reports/…` | Revisión cruzada | Instrucción del usuario | SessionIDs en `03_TRAZABILIDAD_SUBAGENTES.md` | Hallazgos P0/P1 documentados | N/A | Conservar |
| 15 | Verificación final independiente | Pendiente: `mc-verificador-final` equivalente | subagent | `08_VEREDICTO_INDEPENDIENTE.md` | GO/NO-GO | Protocolo de cierre | — | — | — | **Pendiente** |
| 16 | Evidencia de harness para el HEAD | **NO EJECUTADO** | — | — | Cierre formal | `AGENTS.md`, `HARNESS.md` | `verify:evidence` | `latest.json` es de `9206ea1`; no vale | Alto | **Pendiente** |

## Cambios que no deben conservarse sin revisión

- **Hero `hero-registradora.png`:** recorte opaco con verde ajeno; parece una captura pegada dentro de la tarjeta. P0 visual.
- **Sugerencia `sugerencia-lupita.png`:** corta tableta/brazo y conserva un fondo crema visible. P0 visual.
- **`manifest.ts`:** `Mercado Cero Â· La caja que habla` y BOM. Regresión de encoding.
- **`web/src/app/page.tsx`:** comentario `vacÃ­o` y BOM. Regresión de encoding.
- **`sidebar-plantas.png`:** alfa binaria con halo; el manifest/README no describen el cutout.
- **CSS duplicado:** dos bloques `@media (max-width:760px)` y overrides al final; consolidar.

## Acciones NO VERIFICADAS

- La secuencia exacta de ediciones de la fase anterior (`a989878`–`d49b649`) no está trazada comando a comando; solo se puede reconstruir por commits y diffs. **NO VERIFICADO** el detalle fino de cada prompt/edición.
- No hay prueba de que los perfiles `mc-*` se hayan cargado como subagentes en esta sesión; ver `03_TRAZABILIDAD_SUBAGENTES.md`.
- No hay `verify:fast`, `verify:full`, `verify:evidence` ejecutados sobre el árbol actual.
- No hay pruebas de `/inicio` ni de `/inicio` en HIG/axe del repo.
