# Integración Codex Inicio vNext sobre B.1

**Fecha:** 4 de noviembre de 2026 (hora local; 5 de noviembre UTC).
**Rama:** `integration/codex-inicio-vnext`.
**Veredicto:** **GO local de la integración**; GO demo con datos demo; handoff público **NO-GO** heredado; **Oleada C no iniciada**.

---

## 1. Identidad

| Elemento | Valor |
|---|---|
| Base oficial B.1 | `424fdd2d197aab550f52244413df7eb8b45414de` |
| Tag B.1 | `oleada-b1-cierre` |
| Rama de integración | `integration/codex-inicio-vnext` |
| Producto | `bd15f22` (integración) + `0de183f` (Pendientes 200 %) |
| Pruebas | `a439b9a` (contrato/gate) + `5ea2d85` (identidad de evidencia) |
| Build de código verificado | `5ea2d853841e8f324c63486eafd4c2f033d407a4` |
| `/api/health` | `buildSha=5ea2d85…`, `ok:true`, servidor aislado `:3340` |
| Commit documental | posterior a este informe; solo documentación/evidencia |
| Merge / push / deploy | **No ejecutados** |

El producto no se declara cerrado por este informe. B.1 conserva su rama, tag, historial, contratos y evidencia.

---

## 2. Procedencia y alcance

La entrega de Codex se localizó en:

`C:\Users\Elitebook 840 G8\Documents\ChatGPT\Mercado Cero\inicio-adoption-worktree`

Se usaron el commit `7242de8` y el cierre documental `0e3abcf`, más el parche persistente `design-lab/adoption/INICIO_COMPACTO_ADOPTION.patch`. **No** se copió el WIP sin commit del worktree (`mobile-density/`, `inicio-mobile-density.py`, cambios locales de CSS/script).

El parche se comprobó con `git apply --check` sobre `424fdd2` y se aplicó sin conflictos textuales. Después se adaptó lo necesario para conservar B.1.

Archivos de producto modificados:

- `web/src/app/inicio/page.tsx`
- `web/src/app/inicio/inicio.css`

Archivos de prueba:

- `web/scripts/inicio-adoption-contract.mjs`
- `web/scripts/inicio-compact-gate.py`
- `web/package.json` (dos scripts npm)

`git diff --name-only 424fdd2..5ea2d85 -- web/src/lib web/src/app/api web/src/app/pay web/src/components/shell web/src/components/caja web/src/app/ventas` quedó **vacío**. No se tocaron `orders.ts`, `cash.ts`, `db.ts`, pagos, webhooks, pey, checkout, idempotencia, fiados ni reconciliación.

---

## 3. Qué se tomó de Codex

- Composición compacta de Inicio: saludo, cuatro KPI, hero de Nueva venta, Pendientes y Sugerencia.
- Cuatro KPI en una fila cuando el contenedor real supera `52rem`; dos columnas por debajo.
- Eliminación de las alturas mínimas artificiales (`196px`, `304px`, etc.).
- Container queries sobre `.inicio-main`: `52rem`, `58rem`, `46rem`, `38rem`, `23rem` y `19rem`.
- Topbar compacta, tarjetas con padding contenido y tipografía fluida con `cqi`.
- Tablet de Inicio: sidebar oculto y MobileNav visible desde `1023px`.
- Móvil: KPI 2×2, CTA prioritario, Pendientes y Sugerencia a ancho completo.
- Papel picado dentro del saludo y oculto cuando no cabe.
- Hero antes de KPI a 320 px.
- Corrección propia: a 200 % en 320/390 el título “Pendientes” se mantiene en una línea (`@container max-width: 15rem`).

## 4. Qué se adaptó o descartó

| Elemento | Decisión |
|---|---|
| Shell, sidebar, TopBar y MobileNav de B.1 | **Conservados**. El CTA de C queda ~48 px más abajo que en B de Codex por la topbar/espaciado B.1; sigue en la primera pantalla en los seis viewports. |
| Breakpoint de tablet | Se conserva el enfoque Codex de `1023px` con la navegación real de B.1; 768 usa MobileNav. |
| Papel picado | Se mueve al saludo; se oculta por container query a 768 y en móvil. |
| Escala de texto | Se sustituyen las reglas `html[data-text-size]` de Inicio por container queries en `rem`, que reaccionan al tamaño de texto global. |
| `inicio-adoption.py` | **Retirado**: rechaza el checkout `mercado-cero` y `.env.local`; no es ejecutable en este repo. |
| `inicio-adoption-contract.mjs` | **Adaptado**: base `c3a883a` → `424fdd2`; protege datos, rutas y capas financieras. |
| WIP `mobile-density/` de Codex | **No integrado**. |
| Fixtures/cifras del Design Lab | **No integrados**. Los KPI usan `getDashboardData`, `listGoals` y `listTasks`. |

La semántica financiera de los KPI es la de B.1: “Ventas hoy” no implica cobro; “Cobrado hoy” = efectivo + digital verificado; “Por cobrar” = saldo digital pendiente; “Meta del mes” = primera meta. No se cambiaron fórmulas ni fuentes.

---

## 5. Comparación A / B / C

- **A:** Inicio de Codex antes de su cambio, base `c3a883a`. Es la referencia disponible; **no certifica** el Inicio de B.1 en `424fdd2`.
- **B:** propuesta de Codex después del cambio (`552820a`).
- **C:** integración real de este informe (`5ea2d85`, build `5ea2d85`).

| Ancho | A KPI / filas | B KPI / filas | C KPI / filas | CTA A / B / C (px) |
|---|---|---|---|---|
| 1448 | 200.4 / 1 | 165.3 / 1 | **165 / 1** | 637.2 / 556.9 / **605** |
| 1366 | 200.4 / 1 | 165.3 / 1 | **165 / 1** | 587.2 / 575.3 / **623** |
| 1280 | 196.0 / 2 | 165.5 / 1 | **165 / 1** | 787.8 / 574.1 / **622** |
| 768 | 196.0 / 2 | 147.3 / 2 | **147–165 / 2** | 870.8 / 739.2 / **787** |
| 390 | 117.8 / 2 | 134.8 / 2 | **135–136 / 2** | 505.7 / 633.7 / **682** |
| 320 | 107.4 / 2 | 145.8 / 2 | **130–146 / 2** | 322.5 / 394.9 / **443** |

Lectura visual:

- **1448×1086:** cuatro KPI en fila; hero y Pendientes completos; Sugerencia completa. Papel picado a la derecha del saludo sin invadir el `h1`.
- **1366×768:** cuatro KPI en fila; Pendientes completo; CTA de Nueva venta visible; la Sugerencia empieza en `y≈711` y requiere scroll, sin recorte ni superposición.
- **1280×800:** cuatro KPI en fila; Pendientes visible; CTA visible. La Sugerencia empieza en `y≈710`; se ve su cabecera y requiere scroll.
- **768×1024:** sidebar oculto, MobileNav, KPI 2×2, hero a ancho completo, Pendientes visible, CTA `bottom=787`; sin overflow.
- **390×844:** KPI 2×2, CTA `bottom=682`, Pendientes debajo del pliegue, navegación inferior; al final del scroll la Sugerencia queda por encima de la barra.
- **320×640:** hero antes de KPI, KPI 2×2, CTA `bottom=443`, navegación inferior; al final del scroll la Sugerencia queda por encima de la barra.
- **200 % (32 px):** 1280/768/390/320 sin scroll horizontal; importes sin recorte; ambos CTA accesibles con scroll; el gate centra el CTA para comprobar que no queda bajo la barra fija.
- **Texto ampliado (`xlarge`):** 1448/1280 conservan 4 KPI; 768 2×2; 390/320 priorizan legibilidad y pueden pasar a una columna. Sin overflow.

Capturas C: `evidencia/inicio-{1448,1366,1280,768,390,320}-viewport.png`, `evidencia/zoom200-{1280,768,390,320}.png`, `evidencia/contraste-alto-{1448,390}.png`.
Referencias A/B: `evidencia/referencia-codex-a/` y `referencia-codex-b/` (capturas de Codex; no son certificación de C).

---

## 6. Pruebas ejecutadas

| Suite | Resultado | Evidencia |
|---|---|---|
| Gate de Inicio compacto (6 viewports, 200 %, foco, axe, CTA, Pendientes, overflow) | **111 PASS · 0 FAIL** | `evidencia/results.json`, `gate-111.txt` |
| B.1 regression final | **65 PASS · 0 FAIL** | `b1-regression-65.txt` |
| B.1 regression, primera corrida | 64 PASS · 1 FAIL (P1-11 transitorio) | `b1-regression-run1-flake.txt` |
| Alias `/fiados` aislado | **10/10** `?tab=fiado` | reporte del verificador |
| Smoke A | **33 PASS · 0 FAIL** | `smoke-a-33.txt` |
| HIG | **HIG OK · 5 viewports** | `hig-5-viewports.txt` |
| A11y B (Caja/Ventas) | axe 0 normal/HC; 0 targets &lt;44; zoom sin overflow | `a11y-b.txt` |
| Mobile 320/360 | **60 PASS · 0 FAIL** | `mobile-320-60.txt` |
| demo-pay aislado | **59 PASS · 0 FAIL** en árbol limpio | `demo-pay-59.txt` |
| p0-venta / fiado / corte / integración / dinero | 66/0 · 51/0 · 69/0 · 51/0 · 45/0+3 KNOWN | `verify-only-7-gates-a439b9a.txt` |
| webhook / checkout | 40/40 · 19/19 | ídem |
| Fix datos / seguridad | **32 PASS · 0 FAIL** / **58/58** | `fix-datos-32.txt`, `security-58.txt` |
| Build | **BUILD OK**, SHA `5ea2d85` | `build-5ea2d85.txt` |

Los siete gates financieros se ejecutaron con `verify:full --only=...` sobre `a439b9a`: **7/7 verdes**, pero el harness los marca `partial` porque `--only` no cuenta como full. El código financiero no cambió entre `a439b9a` y `5ea2d85`; el delta es CSS de Inicio y el script de evidencia. B.1 y demo-pay se repitieron sobre `5ea2d85`.

**Nota de proceso:** la primera corrida B.1 sobre el build final falló solo `P1-11` (el test, no severidad) por una carrera de asentamiento de la redirección `/fiados → /?tab=fiado`; la segunda dio 65/0 y el flujo aislado 10/10. No se cambió navegación ni contrato. Se documenta el flake, no se oculta.

También se reparó el entorno: `node_modules` había perdido `@swc/helpers`; `npm ci` se ejecutó en un directorio temporal y se fusionó preservando el binario SWC en uso. No cambió código, `package.json` ni `package-lock.json`.

---

## 7. Accesibilidad

- Skip link primero; Enter enfoca `#inicio-main`.
- Navegación real: foco al `h1` al volver a Inicio; siguiente Tab entra a “Registrar”.
- axe 0 violaciones en normal y alto contraste (1448/390; gate en los seis viewports).
- Alto contraste: blanco/negro, bordes y foco visibles; capturas `contraste-alto-1448/390`.
- 200 %: sin overflow horizontal; importes y CTAs accesibles; “Pendientes” completo en una línea tras `0de183f`.
- MobileNav: cinco accesos, targets ≥44/48, “Más” abre/cierra y devuelve foco (Smoke A/B.1).
- `prefers-reduced-motion` y reglas de alto contraste de B.1 se conservan.

Limite conocido: el gate usa axe con `resultTypes: ["violations"]`; no reporta `incomplete`. La comprobación de contraste se complementó con capturas de alto contraste y revisión visual. En `forced-colors`, axe reporta 6 falsos positivos de contraste en los chips “Clásica” por los colores computados; la inspección visual muestra los chips legibles y el alto contraste explícito da 0.

---

## 8. Verificación independiente

Un agente distinto del implementador revisó el diff, la CSS, los datos, las capturas A/B/C y ejecutó el contrato y el gate por su cuenta.

- Veredicto inicial: **GO con residuales, sin P0/P1**.
- Confirmó que solo cambian Inicio y pruebas; que las fórmulas y fuentes de datos siguen intactas; que el build servido coincide con `a439b9a` y después con `5ea2d85`.
- Detectó un P3 real: “Pendientes” se partía a 200 % en 320 px. Se corrigió en `0de183f`; el follow-up confirmó una línea y 111/0.
- Detectó P2 de certificación (sin full/static en el SHA de integración) y de demo-pay (58/1 por árbol sucio). Demo-pay se repitió limpio: **59/59**.
- Residuales P3 aceptados: 1024×768 con CTA bajo el pliegue (accesible por scroll), flake del alias no reproducido, cobertura `incomplete` de axe y semántica de KPI heredada de B.1.

---

## 9. Residuales y límites

1. **P2 — certificación formal:** no hay `latest.json` full 23/23; `tunnel`/`preflight` siguen sin infraestructura. Se ejecutará `verify:static` y `verify:evidence -- --static` sobre el HEAD documental limpio.
2. **P2 — 1024×768:** el CTA de Nueva venta queda ligeramente bajo el pliegue (`bottom≈800 > 768`); no está en la matriz obligatoria y es accesible por scroll. El corte 1023/1024 cambia de MobileNav a sidebar; documentado.
3. **P3 — flake P1-11:** una corrida de B.1 falló el asentamiento de la redirección; dos corridas y 10/10 manuales pasan. No hay regresión de código.
4. **P3 — contraste:** axe solo reporta violaciones; no se emite certificación WCAG formal ni se probó lector de pantalla real.
5. **P3 — semántica heredada:** “Meta del mes” usa la primera meta y “Por cobrar” es saldo digital pendiente, no todo el fiado. Proviene de B.1; no se cambió en esta integración.
6. **Handoff público:** NO-GO. Faltan pey real, webhook real, QR/lector, iOS/Safari, túnel/preflight y `latest.json` full.

---

## 10. Estado Git y siguiente paso

- Rama: `integration/codex-inicio-vnext`.
- Producto: `bd15f22` + `0de183f`.
- Pruebas: `a439b9a` + `5ea2d85`.
- Build de código: `5ea2d85`.
- El commit documental contiene este informe, la evidencia, `harness/STATE.md`, el handoff de integración y la matriz actualizada.
- **No** hay merge, push, deploy ni tag de integración.

### Preparación de Oleada C (sin ejecutarla)

Codex dejó matrices utilizables, no código productivo:

- **Fiados:** separar contenedor de datos de la lista; total global del servidor independiente de paginación/filtros; historial autorizado por crédito; reusar `POST /api/credits/[id]/pay` y `recordCreditPayment` con `requestId`, `expectedBalanceCents`, sobrepago y 409; no copiar `applyPayment` ni localStorage del laboratorio. Pruebas: dos créditos de la misma persona, abono parcial, sobrepago con cambio, replay, cuenta liquidada, error de red sin convertir deuda en cero.
- **Corte:** día operativo México; efectivo separado de digital; fiado como deuda, no cajón; abonos solo efectivo al cajón; pendientes fuera del esperado; conservar `previewCashClose`/`closeCash`, `expectedVersion`, `previewFingerprint`, `requestId` y la fórmula `opening + cashSales + cashCredit − expenses − withdrawals`. La variante compacta de Codex (~356 px menos hasta el CTA) es una referencia de densidad, no un contrato.
- **Metas:** construir crear/editar/aportar/historial solo con API real; hoy Inicio usa `goals[0]`.
- **Pendientes:** CRUD real y agrupación/posposiciones requieren contrato nuevo; no simular checks locales.
- **Regla:** ninguna simulación del Design Lab se copia a servicios reales; cada módulo conserva sus contratos y pasa p0 antes de declararse migrado.

**No se inició Oleada C.**
