# cognitive-audit-report

- **Worktree:** `mercado-cero-cognitive-audit`
- **Rama:** `p0/cognitive-audit`
- **Base auditada:** `499a30175844f33ab3ffbc7863b0bc58eb2364c2`
- **Informe completo:** [`AUDITORIA-CARGA-COGNITIVA.md`](./AUDITORIA-CARGA-COGNITIVA.md)
- **Fecha:** 2 de noviembre de 2026

## Alcance

Auditoría independiente de la app actual contra `docs/CARGA-COGNITIVA.md`, usando como línea base `GOAL-ACOMPANAMIENTO.md` y `AUDITORIA-COGNITIVA.md` (snapshot `26d06ce`). No se implementaron funciones, no se modificaron app, tests ni configuración, y no se hizo merge.

## Verificación ejecutada

Desde `web/`:

```text
npm ci                     OK
npm run verify:fast        3/3 (guard, lint, types)
npm run test:voice         17/17
npm run test:harness       48/48
npm run lint               OK
npx tsc --noEmit           OK
```

No se ejecutó `npm run build`, `verify:full`, los E2E Playwright, ni una prueba con pey real. No hay `harness/evidence/latest.json` en este worktree; el único JSON local es `harness/evidence/p0-dinero-e2e.json`, generado en `2ee1e81` con árbol sucio. Por eso los reportes de P0-A/B/C/D/E/G se citan como pruebas existentes, no como evidencia verde de `499a301`.

## Archivos revisados

- Contrato y goals: `docs/CARGA-COGNITIVA.md`, `GOAL-ACOMPANAMIENTO.md`, `AUDITORIA-COGNITIVA.md`.
- UI: `web/src/components/caja-app.tsx`, `pending-tasks.tsx`, `pending-payments.tsx`, `screen-heading.tsx`.
- Dominio: `web/src/lib/orders.ts`, `cash.ts`, `tasks.ts`, `goals.ts`, `analytics.ts`, `voice.ts`, `voice-local.ts`, `voice-debts.ts`, `checkout.ts`, `db.ts`, `types.ts`.
- Rutas: `web/src/app/api/orders`, `credits`, `cash`, `tasks`, `goals`, `checkout`, `voice`, `verify`, `webhooks/pey`.
- Público: `web/src/app/pay/[id]/page.tsx`, `checkout-client.tsx`, `success/page.tsx`, `success-client.tsx`.
- Shell: `web/src/app/page.tsx`, `layout.tsx`, `manifest.ts`, `globals.css`.
- Pruebas: `web/scripts/p0-venta-e2e.py`, `p0-fiado-e2e.py`, `p0-corte-e2e.py`, `p0-integracion-e2e.py`, `p0-shell-e2e.py`, `p0-orders-atomic-contract.mjs`, `checkout-audit.py`, `mobile-audit.py`, `hig-after-audit.py`.
- Reportes: `P0-VENTA-REPORT.md`, `P0-FIADO-REPORT.md`, `P0-D-CORTE-REPORT.md`, `P0-INTEGRACION-REPORT.md`, `harness/STATE.md`.

## Resultado en una frase

Los P0-A a P0-G del snapshot histórico ya están implementados en `499a301`; lo que sigue faltando es el contrato de acompañamiento: “Antes de cerrar”, una sola verdad de estados/cifras, demo sin CTA de entrega, pantalla de éxito honesta, preferencias de acompañamiento, recomendaciones explicables, operación sin conexión y exportación.

## Limitaciones

- Sin estudio con comerciantes (0 de 6–8), sin SUS/NASA-TLX, sin tiempos humanos.
- Sin TalkBack/VoiceOver/NVDA, sin teléfono físico, sin zoom real de navegador (solo 200 % inyectado en script).
- Sin pago real de $0.01 con pey/CoDi; el demo usa `demo_paid`.
- Sin `npm run build` ni `verify:full` en este worktree.
- La auditoría es de código, copy y pruebas existentes; no verifica visualmente la app en este HEAD.
- El gate local verificó **208 referencias `archivo:línea`**; todas existen y la línea está dentro del archivo.
