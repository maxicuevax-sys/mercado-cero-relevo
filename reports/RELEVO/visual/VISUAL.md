# Reporte Visual — Caja y Fiados (`diego/visual-caja-fiados`)

- **Rama:** `diego/visual-caja-fiados` (base `origin/revision/assembly-fixes` @ `275d6de`)
- **Worktree:** `C:\Users\Acer Nitro\Documents\deepseek-harness\default-workspace\diego-visual`
- **Servidor aislado:** `http://127.0.0.1:4600` (`DEMO_MODE=true`, SQLite demo aislada)
- **Motor de captura:** Playwright Headless Chromium (sin `--headed`, sin tocar puerto `4497` ni navegador del usuario)

---

## Pantalla 1: `/caja` vs `mobile/02_nueva_venta_941x1672.png`

- **Referencia:** `mercado-cero-refs/mobile/02_nueva_venta_941x1672.png` (`941×1672`, equivalente a viewport CSS `390×693` con `deviceScaleFactor = 941/390`)
- **Captura final:** `reports/RELEVO/visual/caja.png` (`941×1672`)
- **Comparación lado a lado:** `reports/RELEVO/visual/caja-side-by-side.png`

### 5 Diferencias concretas detectadas y corregidas en `/caja`

| # | Categoría | Antes (estado base `275d6de`) | Referencia (`02_nueva_venta_941x1672.png`) | Corrección aplicada |
|---|---|---|---|---|
| **1** | **Posición / Color (Badge en campana del header)** | `.mc-caja-spec-header__actions a` no tenía indicador de notificación. | Punto circular terracota (`#e95b30`, `8×8px`, `border-radius: 50%`) en la esquina superior derecha de la campana (`top: 7px; right: 4px`). | Añadido `position: relative` y pseudo-elemento `::after` (`#e95b30`, `8×8px`) en `web/src/components/caja/caja-spec.css`. |
| **2** | **Color / Borde / Tamaño (Caja interna del buscador `Producto`)** | `.mc-sale-voice__entry` era transparente (`border: 0; background: transparent`) sobre `.mc-sale-voice__field` (`#fffaf0`), fusionando el input con el contenedor del botón de micrófono. | Contenedor exterior `#f6efe2` (`border-radius: 15px; padding: 4px 5px`) con caja interna delimitada `.mc-sale-voice__entry` (`background: #fffaf0; border: 1px solid #e1d6be; border-radius: 11px; min-height: 48px`) separada del botón verde `56×56px`. | Estilizado `.mc-sale-voice__field` y `.mc-sale-voice__entry` en `web/src/components/caja/sale-voice-spec.css`. |
| **3** | **Tamaño / Posición (Altura de filas `.mc-caja-line` y píldora `− 2 +` que cortaban `Registrar venta`)** | El bloque final de `caja-spec.css` forzaba `.mc-caja-line__quantity { min-height: 44px }` y filas de `~70px`, empujando el botón `"Registrar venta"` fuera del viewport de `693px` (`scrollHeight: 782px`). | Cada fila `.mc-caja-line` mide `59px` (`last-child: 58px`), la píldora `.mc-caja-line__quantity` mide `30px` de alto, y el CTA `"Registrar venta"` queda 100% visible dentro del viewport `390×693` (`y = 626..678px`). | Ajustado `.mc-caja-line` (`min-height: 59px`), `.mc-caja-line__quantity` / `.mc-caja-line__step` (`26×30px`, cumpliendo `>= 24×24px` de `b-refs-ui.py`) y etiquetas (`min-height: 24px; margin-top: -3px`) en `web/src/components/caja/caja-spec.css`. |
| **4** | **Posición / Recorte de miniaturas (`Tortilla`, `Huevo`, `Refresco`)** | `caja-producto-huevo.png` y `caja-producto-refresco.png` estaban recortadas con un paso vertical erróneo de `110px`, mostrando la línea divisoria gris y parte de la caja de huevo encima de la botella de refresco. | Las 3 miniaturas (`44×44px` CSS / `112×112px` retina) muestran el ícono completo y centrado sobre su recuadro durazno sin líneas divisorias. | Recortadas las 3 miniaturas desde las coordenadas exactas de `02_nueva_venta_941x1672.png` (`x=58, y=682/825/966`) en `web/public/assets/spec/caja-producto-{tortilla,huevo,refresco}.png` y añadido `unoptimized` en `web/src/components/caja/sale-line-items.tsx`. |
| **5** | **Tipografía (`lining-nums` en `$140.00`) y contraste en controles `−` de cantidad** | `.mc-spec-total > span:last-child` tenía `font-variant-numeric: tabular-nums` sin `lining-nums` (renderizando cifras oldstyle bajas para `140.00` en `Georgia, serif`), y `.mc-caja-line__step:disabled` tenía `opacity: 0.4`. | `$140.00` usa cifras alineadas de altura completa (`font-variant-numeric: lining-nums tabular-nums` en `Georgia, serif`, `#0c4133`), el título `"Nueva venta"` mide `30px` con `gap: 20px`, y los signos `−` / `+` mantienen contraste (`opacity: 0.85`). | Añadido `lining-nums` en `web/src/components/caja/caja-spec.css` y ajustada opacidad en `web/src/components/caja/sale-line-items-spec.css`. |

---

## Pantalla 2: `/fiados` vs `mobile/05_fiados_390x693.png`

- **Referencia:** `mercado-cero-refs/mobile/05_fiados_390x693.png` (`390×693`, `deviceScaleFactor = 1`)
- **Captura final:** `reports/RELEVO/visual/fiados.png` (`390×693`)
- **Comparación lado a lado:** `reports/RELEVO/visual/fiados-side-by-side.png`

### 5 Diferencias concretas detectadas y corregidas en `/fiados`

| # | Categoría | Antes (estado base `275d6de`) | Referencia (`05_fiados_390x693.png`) | Corrección aplicada |
|---|---|---|---|---|
| **1** | **Texto / Contenido de filas y Total por cobrar** | Mostraba `Total por cobrar $50.00` y solo 1 fila (`Juan / Sin abonos / $50.00 / Cobrar`) porque `showSample` exigía `credits.length === 0`, pero `seedDemoData` siembra por defecto `demo_seed_cred_*` (`Juan $50.00`). | Muestra `Total por cobrar $1,125.00` y las 5 filas (`Juan $450.00`, `María $120.00`, `Carlos $100.00`, `Doña Elena $80.00`, `Ana $75.00`) con retratos y chevron derecho `>`. | En `web/src/app/fiados/mobile-ledger.tsx`, `showSample` se activa también cuando solo existe la semilla demo inicial intacta (`onlyDefaultSeed`), preservando `/fiados?libreta=practica` y los saldos reales al crear o abonar un fiado. |
| **2** | **Tamaño / Posición (Salto de línea en nombre del comercio en brandbar)** | En `.mc-fiados-mobile__merchant strong`, `"Antojitos de Lupita"` envolvía el chevron `⌄` en una segunda línea porque el botón de campana de `48px` reducía el ancho disponible. | `"Antojitos de Lupita ⌄"` se muestra en una sola línea horizontal (`height: 13px`). | En `web/src/app/fiados/mobile-ledger.css`, aplicado `display: inline-flex; align-items: center; gap: 3px; white-space: nowrap` en `.mc-fiados-mobile__merchant strong` y `margin-inline: -10px` en `.mc-fiados-mobile__bell` (conservando su caja táctil `48×48px`). |
| **3** | **Posición (Punto naranja de notificación en campana)** | `.mc-fiados-mobile__bell::after` tenía `top: 0; right: 0` sobre la caja táctil de `48×48px`, quedando flotando en el borde superior lejos del ícono SVG de `20×20px`. | El punto terracota (`#e95b30`, `7×7px`) está anclado sobre la esquina superior derecha de la campana. | Ajustado `.mc-fiados-mobile__bell::after` a `top: calc(13 * var(--fi-u)); right: calc(13 * var(--fi-u))` en `web/src/app/fiados/mobile-ledger.css`. |
| **4** | **Color / Posición (Línea divisoria vertical en `Total por cobrar`)** | En `.mc-fiados-mobile__total`, no existía línea divisoria entre la ilustración `fiados-monedas.png` y el texto `"Total por cobrar / $1,125.00"`. | Línea divisoria vertical (`1px solid #cdd6be`) con `padding-inline-start: 10px` entre las monedas y el bloque de monto. | Añadido `border-inline-start: 1px solid #cdd6be; padding: 2px 4px 5px calc(10 * var(--fi-u))` a `.mc-fiados-mobile__total > div` en `web/src/app/fiados/mobile-ledger.css`. |
| **5** | **Posición / Tamaño (Alineación de `< Fiados` y altura visual de tabs `Saldos / Historial`)** | La caja táctil de `48×48px` en `.mc-fiados-mobile__heading a` empujaba `<h2>Fiados</h2>` `26px` a la derecha, y `.mc-fiados-mobile__tabs a` (`min-height: 48px`) inflaba la barra de pestañas a `54px`, desplazando las filas y el CTA `"Nuevo fiado"`. | `"Fiados"` queda junto al chevron `<` y la barra de pestañas mide `42px` visuales, dejando las 5 filas, el botón `"+ Nuevo fiado"` y la barra inferior encajados en `390×693` (`MAE = 11.54`). | Añadido `margin-inline-end: calc(-26 * var(--fi-u))` en `.mc-fiados-mobile__heading a` y `margin-block: calc(-5 * var(--fi-u))` en `.mc-fiados-mobile__tabs a` (manteniendo todas las áreas táctiles `>= 48×48px` para `a3-mobile-nav.py`). |
