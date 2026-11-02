# Movimiento — Mostrador claro

> “El papel se asienta”: rápido, con causa y sin hacer esperar a la comerciante.
> Inspirado en los principios de ASLI (reveals recortados, scroll trigger,
> jerarquía en cascada), **sin** usar sus assets ni añadir GSAP/Lenis/Barba.

## Tesis

- **Momento autoral:** cambiar de tab es una hoja que cruza la pantalla:
  un barrido de papel de 300 ms pasa por debajo de la navegación y encima del
  contenido; el panel aparece en 160 ms, el título se descubre con un clip-path
  de 240 ms y la lista entra en 180 ms con un stagger máximo de 84 ms.
- **Continuidad:** las hojas suben 18 px y escalan 0.985 → 1 en 220 ms; el fondo
  entra en 140 ms. El resultado de un cobro se estampa en 240 ms (escala 1.08 →
  0.98 → 1, con una rotación mínima).
- **Feedback:** el marcador del tab activo crece en 180 ms; los montos ruedan en
  220 ms; las listas nuevas aparecen con un stagger corto.
- **Scroll:** una veta de 2 px en el borde superior avanza con
  `animation-timeline: scroll(root block)`; la tarjeta de Actividad entra con
  `animation-timeline: view()` (`entry 0–60 %`). Si el navegador no lo soporta,
  no se pinta nada y el contenido queda visible.
- **Presupuesto:** todo es CSS nativo; no hay listeners de scroll ni runtime de
  animación. Solo se animan `opacity`, `transform` y `clip-path` acotado al
  título. El gesto más largo es 240 ms.

## Reglas

- Nada de bounce, elástico ni coreografías de página completa.
- El contenido se ve por defecto; una animación que falle no puede ocultarlo.
- `prefers-reduced-motion: reduce`: duración 0.01 ms, delays 0 y veta de scroll
  apagada. La información y el foco se conservan.
- No se animan `width`, `height`, `top`, `left` ni márgenes.
- El barrido de papel dura 300 ms, intercepta clics mientras existe y la tab bar queda por encima (z-40); un timeout de 1 s lo retira si `animationend` no llega.
- El foco de teclado y los estados de error siguen siendo la prioridad.

## Dónde vive

- `web/src/app/globals.css`: `tab-panel`, `heading-in`, `motion-list`,
  `sheet-in`, `sheet-backdrop`, `result-in`, `tab-marker`, `scroll-progress`,
  `view-reveal` y el bloque de `prefers-reduced-motion`.
- `web/src/components/caja-app.tsx`: clases en tabs, encabezado, hoja y listas.
- `web/src/components/pending-payments.tsx` y `pending-tasks.tsx`: `motion-list`.
- `web/src/components/animated-amount.tsx`: 220 ms.

## Verificación

```powershell
cd web
$env:MOTION_BASE_URL="http://localhost:3000"
python scripts/motion-check.py   # 15 PASS · 0 FAIL; gate `motion` del harness full (14/14 por defecto)
python scripts/hig-after-audit.py
```

Última evidencia: `harness/evidence/motion-check.json` y
`harness/evidence/motion/`. El HIG/axe se mantiene en 0 a 360/390/768/1280 y
200 %. Reel de las transiciones: `demo/stageshow/tab-wipe.mp4` (5.5 s) y
`tab-wipe-sheet.png`.

**Nota de evidencia:** el `motion-check.json` de `91ad4ee` registra
`code.dirty:true`; para que un `full` cruce como evidencia limpia, el carril
a11y debe corregir ese registro en `motion-check.py`/`a11y-contrast.py` y
volver a correrlos sobre árbol limpio. `verify:evidence` lo exige.
