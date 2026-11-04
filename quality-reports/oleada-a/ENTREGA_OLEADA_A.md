# Entrega Oleada A — Fundación compartida

> **Estado:** implementación local completa, **sin commit**.
> **Rama:** `design/oleada-a-fundacion` · **HEAD:** `62c3fed6874bc500db16b4a9260fb62cf9626453`.
> **Build servido:** `http://localhost:3100`, `/api/health` buildSha `62c3fed...`.
> **Veredicto independiente:** aprobada para continuar a Oleada B; **handoff público NO-GO**.
> **Commit:** autorizado por el verificador como commit acotado de ola, pendiente de autorización de producto.

## 1. Alcance entregado

| Área | Estado |
|---|---|
| A1 Hearth + Alder | Integradas con `next/font/local`, OFL 1.1, hashes y tokens únicos de tipografía. |
| A2 AppShell | `AppShell`, `Sidebar`, `TopBar`, `MobileNav`, `SkipLink`, `BrandLockup`, `PageHeader`. Aplicado a `/inicio`. Caja conserva su shell legacy hasta Oleada B. |
| A3 Componentes | `MaskIcon`, `CurrencyAmount`, `ProgressIndicator`, `SectionHeader`, `EmptyState`. |
| A4 Rutas | Alias HTTP 307 para `/ventas`, `/fiados`, `/corte`, `/metas`, `/pendientes`; `/caja` reservada (404). |
| Navegación | Solo destinos reales. Sin Productos/Proveedores/Reportes hasta que existan. |
| Contratos financieros | Sin cambios en `lib/`, APIs, webhook, DB, checkout ni `/pay/**`. |

## 2. Decisiones de producto y rutas

- `/` y `?tab=` siguen siendo la fuente de verdad durante la migración.
- `/ventas` es el alias de la pantalla de venta (`?tab=caja`) mientras no exista un historial separado.
- `/fiados` → `?tab=fiado`; `/corte` → `?tab=corte`; `/metas` → `?tab=meta`; `/pendientes` → `?tab=pendientes`.
- Los alias responden **307 real** desde route handlers, conservan `ayuda=1` y descartan parámetros ajenos. El hash `#ajustes` lo conserva el navegador.
- `/caja` **no se activa**: no hay pantalla distinta de Ventas. Queda reservada para cuando Caja se separe.
- `/reportes`, `/productos`, `/proveedores`, `/ayuda` y `/ajustes` no se enlazan como pantallas.
- CTA “Registrar” e “Ir a ventas” apuntan a `/ventas`, no a `/`.

## 3. Archivos

### Modificados

| Archivo | Cambio |
|---|---|
| `web/src/app/layout.tsx` | Hearth/Alder con `next/font/local`; variables HTML. |
| `web/src/app/globals.css` | Tokens `--font-sans`/`--font-display` y alias de compatibilidad. |
| `web/src/app/inicio/page.tsx` | Inicio con AppShell y componentes compartidos; CTA a `/ventas`; estado “Hecho” accesible. |
| `web/src/app/inicio/inicio.css` | Layout móvil, targets 48, topbar sin affordances falsas, HC/forced-colors. |
| `harness/STATE.md` | Estado real de Oleada A. |
| `quality-reports/MIGRACION_INTEGRAL_MERCADO_CERO.md` | Matriz y decisiones de rutas. |

### Nuevos

| Archivo | Cambio |
|---|---|
| `web/src/assets/fonts/Hearth-Variable.woff2` | Hearth variable, OFL 1.1. |
| `web/src/assets/fonts/Alder-Variable.woff2` | Alder variable, OFL 1.1. |
| `web/src/assets/fonts/Hearth-OFL.txt`, `Alder-OFL.txt` | Licencias originales. |
| `web/src/assets/fonts/README.md` | Procedencia, hashes y límites. |
| `web/src/components/shell/*` | AppShell, Sidebar, TopBar, MobileNav, SkipLink, BrandLockup, PageHeader, nav. |
| `web/src/components/ui/*` | MaskIcon, CurrencyAmount, ProgressIndicator, SectionHeader, EmptyState. |
| `web/src/app/_redirects/tab.ts` | Helper de redirect 307. |
| `web/src/app/{ventas,fiados,corte,metas,pendientes}/route.ts` | Alias 307. |
| `web/scripts/oleada-a-smoke.py` | Smoke de shell, fuentes, rutas y a11y. |
| `quality-reports/oleada-a/*` | Auditorías, veredicto y capturas. |

### No modificados (contratos preservados)

`web/src/lib/orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `db.ts`, `payment-rules.ts`, `payment-labels.ts`, `pey-events.ts`, `checkout.ts`, `web/src/app/api/**`, `web/src/app/pay/**`, `web/src/components/caja-app.tsx`, `web/src/app/page.tsx`.

## 4. Tipografía

- **Hearth:** marca, saludos y encabezados editoriales.
- **Alder:** navegación, formularios, botones, importes, tablas, estados y mensajes operativos.
- **Hashes SHA-256:**
  - Hearth `B885DEA71502BC246DFD68EDBEE1FB7CF11A6E3E091669A1410376133AE2E470`
  - Alder `B0C178C8C48CA5B064E734591ABAB6157889AA7C9D84B5AE7D4647594C5A0B3C`
- `document.fonts.check` PASS para 400/600/700; solo 2 requests WOFF2 (sin duplicados).
- Cifras con avance constante y `tabular-nums`; no hay `tnum` ni itálica.

## 5. Pruebas ejecutadas

| Prueba | Resultado | Evidencia |
|---|---|---|
| `python scripts/oleada-a-smoke.py` | **34 PASS · 0 FAIL** | salida local / `demo/oleada-a/oleada-a-smoke.json` |
| HIG (gate de Caja) | **5/5 viewports** | `demo/hig-after/audit.json` |
| Variantes de Inicio | **10/10** | `quality-reports/oleada-a/variantes-summary.json` |
| axe Inicio normal + HC | **0 violaciones** | `quality-reports/oleada-a/metricas-summary.json` |
| p0-venta | **66 PASS · 0 FAIL · 0 KNOWN** | `harness/evidence/p0-venta-e2e.json` |
| p0-fiado | **51 PASS · 0 FAIL · 0 KNOWN** | `harness/evidence/p0-fiado-e2e.json` |
| p0-corte | **69 PASS · 0 FAIL · 0 KNOWN** | `harness/evidence/p0-corte-e2e.json` |
| p0-integración | **51 PASS · 0 FAIL · 0 KNOWN** | `harness/evidence/p0-integracion-e2e.json` |
| p0-dinero | **45 PASS · 0 FAIL · 3 KNOWN** | `harness/evidence/p0-dinero-e2e.json` |
| webhook | **40/40** | `harness/evidence/` |
| checkout | **19/19** | `harness/evidence/` |
| `tsc --noEmit` / ESLint / build | PASS | buildSha `62c3fed` |

**3 KNOWN de p0-dinero:** payload real de pey no verificable sin portal; reconciliación de red no ejecutada; contrato de conteo posterior al cierre (la UI debe reemplazar el conteo guardado por el vigente).

**Run parcial 6/6:** `harness/evidence/runs/2026-11-04T06-39-02-354Z-partial.json` — todos los gates verdes, `ok:false` porque `--only` es partial y el árbol estaba sucio. No se presenta como full.

## 6. Capturas

- `quality-reports/oleada-a/capturas/inicio-desktop-1448x1086-viewport.png`
- `.../inicio-mobile-390x844-viewport.png`
- `.../inicio-mobile-390-mas.png`
- `.../inicio-mobile-320x640.png`
- `.../inicio-zoom-200-724x543.png`
- `.../inicio-alto-contraste-1448.png`
- `.../inicio-desktop-1448x1086-hc-viewport.png`
- `.../inicio-mobile-390x844-hc-viewport.png`

Corresponden al build `62c3fed` servido en `:3100` al momento de la auditoría.

## 7. Accesibilidad

- Un solo `main`, un solo skip link primero en el orden de tabulación, una sola nav visible por breakpoint, un solo `h1`, un solo `aria-current` visible.
- Targets ≥48 en sidebar, topbar, nav móvil, panel “Más” y CTA.
- Sin overflow horizontal a 1448/1366/768/390/320/200 %.
- Foco visible; skip link enfoca `main`; “Más” cierra con Escape y devuelve el foco.
- `forced-color-adjust` vuelve a `auto`; el modo de alto contraste se conserva.
- **No ejecutado:** NVDA, TalkBack, VoiceOver, iOS/Safari, HCM real, PWA instalada/offline, teclado virtual. **WCAG no certificada.**

## 8. Regresiones y observaciones

- El primer intento de `p0-venta` falló por un servidor aislado obsoleto; tras reconstruir y reiniciar, pasó **66/0** en tres corridas. No era una regresión de producto.
- Caja conserva nodos `color-contrast` en axe de alto contraste emulado; la auditoría previa los documenta como falsos positivos de `forced-colors` (colores computados negro/blanco). No se declaran cerrados.
- HIG 5/5 es el gate de **Caja**; la cobertura de Inicio es el smoke + 10 variantes + axe.
- El shell nuevo está acoplado a clases `.inicio-*`; Caja sigue en legacy. Es deuda de Oleada B, no una pantalla migrada.

## 9. Pendientes abiertos

1. Autorización de commit de Oleada A (no ejecutado).
2. Después del commit: `verify:static`, `verify:full --skip=tunnel,preflight` y `verify:evidence` sobre HEAD limpio.
3. Oleada B: migrar Caja y Nueva venta al AppShell; sincronizar URL↔tab; extraer `caja-app.tsx` por fases.
4. Consolidar tokens de color/foco y retirar overrides legacy.
5. PWA instalada/offline y service worker: **NOT RUN**.
6. Handoff público: destino estable, `APP_URL`, QR, `tunnel`, `preflight`, `latest.json` full. Sigue **NO-GO**.

## 10. Veredicto

- **Oleada A:** aprobada para continuar a Oleada B, con las limitaciones documentadas.
- **Commit:** autorizado por el verificador como commit acotado; falta autorización de producto.
- **Handoff público:** **NO-GO**.
