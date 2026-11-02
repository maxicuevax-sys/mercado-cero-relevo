# P0 perf core — fuentes, assets y presupuesto de caché

Rama: `p0/perf-core` · base `76ce5ee` · worktree `mercado-cero-perf-core`.
Sin merge. Sin cambios en `caja-app.tsx`, `globals.css`, `orders.ts`, `db.ts`,
`goals.ts`, `checkout-client.tsx` ni `pending-tasks.tsx`.

## Qué cambió

- `web/next.config.ts`
  - `compress`, `poweredByHeader: false`, `productionBrowserSourceMaps: false`.
  - `experimental.optimizePackageImports: ["lucide-react", "qrcode"]`.
  - `images`: AVIF + WebP, `deviceSizes` 360–1920, `imageSizes` 16–384,
    `minimumCacheTTL` 1 año, calidad 75.
  - Caché: `/_next/static` immutable (solo producción), `/icons`, `/tts` y
    fotos 7 días con SWR; `/api/*` y `/pay/*` `private, no-store`; `/` shell
    público `s-maxage=60`.
  - Headers de seguridad intactos (CSP, HSTS, X-Frame-Options, etc.).
- `web/src/app/layout.tsx`
  - Manrope variable (un woff2 para 400–700) y Fraunces latin sin ejes
    opcionales; `font-display: swap`; solo se precargan las 2 fuentes latin.
  - `viewport` (`theme-color #f3ece0`, `color-scheme: light`),
    `formatDetection` y `apple-mobile-web-app`.
- `web/src/app/manifest.ts` + iconos 192/512/maskable, `icon.png`,
  `apple-icon.png` y `favicon.ico` regenerado (1.5 KiB). Sin service worker.
- Assets: fotos públicas recomprimidas (1.50 MiB → 350.6 KiB) y favicon
  (15.1 → 1.5 KiB). Se borraron los SVG de ejemplo de Next, sin referencias.
- `web/scripts/perf-budget.mjs` + `test:perf-budget`.
- `web/scripts/lighthouse-mobile.mjs` + `lighthouse:mobile`.
- `web/scripts/perf-mobile.py` + `perf:mobile`.
- `web/scripts/optimize-assets.mjs` + `assets:optimize`.
- `web/PERF-BUDGET.md` con los números y el protocolo.

## Antes / después

| Métrica | Base | Ahora |
|---|---:|---:|
| JS inicial gzip | 191.6 KiB | 186.6 KiB* |
| CSS inicial gzip | 12.3 KiB | 11.8 KiB |
| Fuentes latin | 61.0 KiB | 59.6 KiB |
| Total inicial | 264.9 KiB | 258.0 KiB |
| Favicon | 15.1 KiB | 1.5 KiB |
| Fotos públicas | 1.50 MiB | 350.6 KiB |
| Lighthouse Perf | 81 | 82 (rango 73–82) |
| Lighthouse LCP | 3.55 s | 3.50 s |
| Lighthouse TBT | 411 ms | 392 ms |
| Lighthouse transfer | 312 KiB | 305 KiB |

\* El JS **no** bajó de forma material: el chunk de dependencias mide lo mismo
(211,366 B vs 211,365 B). La diferencia de gzip es varianza por el cambio de
IDs de módulo. El peso real en el cable sigue en ~184.5 KiB. Sacar `qrcode`
del chunk inicial exige tocar `caja-app.tsx` (fuera de este carril).

Playwright CPU 4×/Slow 3G: antes TBT 1420 ms, después 1329 ms; LCP 7.70 s vs
8.54 s (el LCP es el subtítulo que aparece tras 5 APIs, no un asset). El host
estuvo al 100 % de CPU (Folding@Home + apps), así que el TBT se mueve entre
1300 y 2100 ms. El número determinista es el presupuesto del build.

## Gates

- `npm run lint` — PASS (0 errors; 1 warning preexistente en harness-gate).
- `npx tsc --noEmit` / `npm run typecheck` — PASS.
- `npm run build` — PASS (aviso de Next por el Cache-Control explícito de
  `/_next/static`; se emite solo en producción para no romper dev).
- `npm run test:harness` — PASS 44/44.
- `npm run test:perf-budget` — PASS 9/9.
- `npm run verify:fast` — 3/3 gates PASS; la evidencia se regenera tras el
  commit porque el árbol sucio invalida `ok:true`.

## KNOWN / conflictos previsibles

- El icono es un placeholder funcional (caja verde con asa y ranura). Diseño
  puede reemplazar `web/assets/icon.svg` y correr `npm run assets:optimize`.
- `formatDetection` desactiva autolinks de teléfono/fecha; no toca zoom,
  contraste ni foco.
- Si el carril de dinero agrega rutas privadas fuera de `/pay`, hay que
  replicar `Cache-Control: private, no-store`.
- `optimizePackageImports` no movió el chunk de `qrcode`; es no-op medido.
- El umbral `--assert` de Lighthouse (85/3.0 s/300 ms) es una meta, no el
  estado actual: la base ya estaba en 81/3.55 s/411 ms.
