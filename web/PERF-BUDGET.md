# Presupuesto de performance (móvil de gama baja)

Objetivo: que la caja abra y sea usable en un Android Go / Moto E de 2 GB,
sobre Slow 3G (1.6 Mbps, 150 ms RTT) y CPU 4× más lenta que una laptop.
El costo dominante no es la red: es parsear e hidratar JavaScript.

## Números

| Métrica (build de producción) | Base `76ce5ee` | Ahora | Presupuesto |
|---|---:|---:|---:|
| JS inicial (gzip, 7 chunks) | 191.6 KiB | 186.6 KiB | ≤ 200 KiB |
| JS inicial (crudo) | 660.7 KiB | 660.7 KiB | — |
| CSS inicial (gzip) | 12.3 KiB | 11.8 KiB | ≤ 16 KiB |
| Fuentes latin (2 woff2) | 61.0 KiB | 59.6 KiB | ≤ 65 KiB |
| Total inicial (JS+CSS+fuentes) | 264.9 KiB | 258.0 KiB | ≤ 285 KiB |
| Peticiones iniciales | 10 | 10 | ≤ 12 |
| Foto pública más pesada | 811.9 KiB | 137.2 KiB | ≤ 200 KiB |
| Fotos públicas (suma) | 1.50 MiB | 350.6 KiB | ≤ 400 KiB |
| Iconos móviles | 0 (sin manifest) | 27.5 KiB | ≤ 40 KiB |
| `favicon.ico` | 15.1 KiB | 1.5 KiB | ≤ 8 KiB |

Los presupuestos se aplican con `npm run test:perf-budget` después de
`npm run build`. El script lee el HTML prerenderizado, suma los scripts
iniciales (excluye el polyfill `nomodule`), el CSS, las fuentes latin que
`next/font` precarga y los assets de `public/`.

### Matiz importante sobre el JS

El JS inicial **no bajó de forma material**: el chunk de dependencias de la
caja mide lo mismo (211,366 B vs 211,365 B). La diferencia de gzip es varianza
de compresión al cambiar los IDs de módulo. El peso real del JS inicial sigue
siendo ~184.5 KiB en el cable. La oportunidad grande es sacar `qrcode` del
chunk inicial, pero eso requiere tocar `caja-app.tsx` (fuera de este carril):
Turbopack fusiona el `import("qrcode")` con `next/image` en el mismo chunk.

Lo que sí bajó: CSS por las reglas de fuente duplicadas, fuentes por usar el
eje variable de Manrope, `favicon` (−13.6 KiB) y las fotos públicas
(−1.17 MiB de artefacto). Las fotos no están en la ruta crítica (la del
puesto usa `next/image` con lazy loading), pero reducen el costo del
optimizador y el tamaño del despliegue.

## Cómo medir

### Build + presupuesto

```powershell
cd web
npm ci
npm run build
npm run test:perf-budget          # falla con exit 1 si se pasa de presupuesto
node scripts/perf-budget.mjs --json > ..\perf-budget.json
```

### Lighthouse móvil (servidor ya levantado)

```powershell
cd web
$env:DATABASE_PATH="$env:TEMP\opencode\perf-core\db-lh\mercado-cero.db"
$env:DEMO_MODE="true"
$env:APP_URL="http://localhost:3154"
$env:PORT="3154"
npm start

# en otra terminal
$env:BASE_URL="http://localhost:3154"
npm run lighthouse:mobile
npm run lighthouse:mobile -- --assert   # falla si no cumple el umbral
```

Umbrales (`scripts/lighthouse-mobile.mjs`): Performance ≥ 85, LCP ≤ 3.0 s,
TBT ≤ 300 ms, CLS ≤ 0.1, accesibilidad = 100.

### Playwright CPU 4× / Slow 3G

```powershell
python scripts/perf-mobile.py http://localhost:3154/ after "$env:TEMP\opencode\perf-core\pw-after.json"
```

Emula 360×800, DPR 2, 1.6 Mbps de bajada, 750 kbps de subida, 150 ms RTT y
CPU 4×. Guarda FCP/LCP/TBT/CLS, peso por tipo y la lista de peticiones.
En una máquina con el host al 100 % de CPU el TBT varía ±500 ms; para una
decisión de merge, el número determinista es el presupuesto del build.

## Resultados de referencia (2026-11-02)

Lighthouse móvil, misma build servida en `:3154` con DB temporal:

| Corrida | Perf | FCP | LCP | TBT | CLS | Transfer |
|---|---:|---:|---:|---:|---:|---:|
| Antes (`lh-before.json`) | 81 | 0.86 s | 3.55 s | 411 ms | 0.016 | 312 KiB |
| Después (`lh-after-3.json`) | 82 | 0.85 s | 3.50 s | 392 ms | 0.016 | 305 KiB |

Corridas extra durante la sesión (host cargado, Folding@Home + apps al 100 %
de CPU): 73, 76, 79 de Performance. Se reportan para no esconder la varianza;
la mediana limpia es 79–82 y el delta contra la base está dentro del ruido.

Playwright (CPU 4×/Slow 3G), antes: FCP 1.50 s, LCP 7.70 s, TBT 1420 ms.
Después: FCP 1.53 s, LCP 8.54 s, TBT 1329 ms. El LCP es el subtítulo que se
pinta cuando llegan las 5 APIs, no un asset: varía con el host y con la DB.
El TBT mejora en la corrida pareada, pero el host al 100 % lo mueve entre
1300 y 2100 ms. No se usa como gate.

## Archivos

- `next.config.ts`: `compress`, sin `X-Powered-By`, sin source maps de browser,
  `optimizePackageImports`, formatos/tamaños de imagen, caché de estáticos,
  `no-store` para `/api` y `/pay`, caché corta para el shell `/`.
- `src/app/layout.tsx`: Manrope variable, Fraunces latin, `swap`, viewport,
  `theme-color`, `formatDetection`, `apple-mobile-web-app`.
- `src/app/manifest.ts` + `src/app/icon.png` + `src/app/apple-icon.png` +
  `public/icons/*`: PWA instalable sin service worker.
- `scripts/optimize-assets.mjs`: regenera iconos y recomprime fotos.
- `scripts/perf-budget.mjs`: gate de peso.
- `scripts/lighthouse-mobile.mjs`: corrida móvil reproducible.
- `scripts/perf-mobile.py`: medición Playwright CPU 4×/Slow 3G.

## Conflictos previsibles

- **Diseño**: el icono (caja verde con asa y ranura) es un placeholder
  funcional; si el carril de diseño define un logo, reemplazar
  `assets/icon.svg` y correr `npm run assets:optimize`. El `theme-color`
  `#f3ece0` debe seguir al canvas si cambia el fondo.
- **A11y**: `formatDetection` desactiva el autolink de teléfonos/fechas; no
  afecta zoom ni contraste. No se tocó `globals.css` ni el foco.
- **Pagos**: el `no-store` de `/pay/:path*` evita que un enlace de cobro
  quede cacheado; si el carril de dinero añade rutas fuera de `/pay`, hay que
  replicar esa regla.
- **Headers**: no se añadió CSP nueva ni se relajó la existente. El header
  `Cache-Control` de `/_next/static` solo se emite en producción para no
  romper el hot reload.
