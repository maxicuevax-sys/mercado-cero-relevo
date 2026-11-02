# P0 · Fix de diseño — reporte de carril

- Worktree: `mercado-cero-fix-diseno`
- Rama: `p0/fix-diseno`
- Base: `7bb0dc5`
- Servidor de verificación: `:3125` con `DATABASE_PATH` temporal (`%TEMP%\opencode\mc-fix-diseno.db`), modo demo.
- Sin merge.

## Qué se corrigió

### P1

1. **Tipografía de controles.** `button,input,textarea,select` ya no usa `font: inherit`; solo hereda la familia. Comprobado: `.demo-stamp` 12/700, `.mobile-tab-label` 13/600, `#sale-text` 16/400 y CTA `button.bg-accent` 17/600.
2. **Chrome al 200 %.** Topbar de 155 → **57 px**, tab bar de 125 → **65 px**, H1 56 → **40 px**, iconos con máximo en px. El campo de venta (360/200) queda en y=478–526 y el micrófono en y=600–680; la tab bar empieza en y=735.
3. **Un shell para 5 tabs.** `.tab-shell` compartido; los cinco H1 quedan en **x=272, y=91** a 1280. `Pendientes` usa `ScreenHeading` (raya terracota incluida); Fiado/Meta conservan `.tab-readable` dentro del mismo shell.
4. **Salida pública del pagador.** Checkout, éxito y 404 ya no enlazan a `/` ni al dashboard. Usan “Listo” / “Cerrar” y, mientras el pago espera, “Revisar link”.

### P2

5. **`surface-2`.** Reservado para edición/inset. Stats, avisos, chips y notas de solo lectura pasan a texto/regla/borde; “Registrar abono” es outline verde. Fiado explica cómo anotar un fiado desde Caja sin inventar API.
6. **Píldora semántica.** Se eliminó `button.bg-accent { border-radius: 999px }`; solo `.cta-primary` es píldora. `.pay-option` (Link de pago / QR CoDi) conserva radio de lista.
7. **Cobros pendientes en móvil.** Fila compacta bajo el heading (“Por cobrar $120.00 · Ver”), oculta cuando Caja ya tiene dos columnas; el detalle sigue en el aside.
8. **Pendientes.** Un solo CTA, `ScreenHeading` compartido, empty state explicativo y `Hechas (n)`.
9. **Meta.** Orden: monto + % + barra → falta / por semana → input + CTA. A 360/200 “Apartar” queda en y=579–629, sobre la tab bar.
10. **Checkout.** Barra fija total + CTA (“Pagar $120.00”) en móvil **y escritorio**; a 1280×800 el CTA queda en y=742–790. El shell público aplica `data-contrast` / `data-text-size` antes del paint. Header compacto a 200 %.

### P3 / addendum

- HIG actualizado: **5 destinos**, salida pública del pagador, matriz responsive coherente (tab bar hasta 1023; sidebar desde 1024).
- Placeholders con `--color-placeholder`; controles con `--color-control-border`.
- `screen-heading.tsx` sin `outline-none`, con `screen-heading-block`.
- `pending-tasks` sin `role="checkbox"` ni `aria-controls` colgante; `mobileLabel: "Tareas"` (aria-label “Tareas (Pendientes)”).
- Preferencias de lectura en script inline antes del primer paint; `PublicPreferences` eliminado. CLS medido: **0**.
- Bandas de checkout y PaymentPanel pasan de `surface-2` a `canvas`.
- `.cta-primary` añadido a los tres primarios que faltaban (“Listo para entregar”, “Guardar corte”, “Seguir editando”).
- Plurales/fechas: “1 venta”, “Mejor día 11 feb”, empty state de Pendientes y “Hechas (0)”.
- Variante ligera para `prefers-reduced-motion`: sin grano, sin blur de topbar/tab bar/CTA.
- 768: se mantiene tab bar (decisión de shell probada) y el contrato HIG se actualizó a sidebar desde 1024; así no se contradice `p0-shell-e2e` ni se rompe el 200 % (el sidebar a 768 desbordaba).

## Verificación (servidor de producción en :3125)

| Gate | Resultado |
|---|---|
| `npm run lint` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `checkout-audit.py` | **15/15 checks en verde** |
| `mobile-audit.py` | **25/25 checks en verde** |
| `motion-check.py` | **15 comprobaciones de esa fase** |
| `p0-shell-e2e.py` | **52 PASS · 0 FAIL** |
| `hig-after-audit.py` | **PASÓ** (360/390/768/1280, axe 0, 200 %, sin recortes/overflow) |

Última línea de salida de `checkout-audit.py`:

```text
15/15 checks en verde
```

La aserción nueva de CTA en escritorio está integrada sin cambiar el marcador de 15 checks.

## Métricas finales

- 360 normal: topbar 65, tab bar 65, H1 28, `#sale-text` 16/400.
- 360/200: topbar 57, tab bar 65, H1 40, campo de venta 478–526, micrófono 600–680, sin overflow.
- 768: tab bar, sin sidebar, `scrollWidth=768`; a 200 % campo 700–796 y sin overflow.
- 1280: H1 de los cinco tabs en x=272/y=91; “Pagar” del checkout 742–790.
- CLS de checkout con `xlarge` + alto contraste: **0** (script inline pre-paint + skeleton del mismo alto).

## Capturas

En `harness/evidence/fix-diseno/`:

- `home-360.png`, `home-360-text200.png`
- `home-768.png`, `home-768-text200.png`
- `home-1280.png`, `home-1280-text200.png`
- `checkout-360.png`, `checkout-360-text200.png`, `checkout-1280.png`
- `success-360.png`
- `metrics.json`

## KNOWN / notas

- `p0-shell-e2e.py` y `motion-check.py` se ejecutaron con `P0_BASE_URL` / `MOTION_BASE_URL` apuntando a `:3125`; no se editaron.
- `motion-check.py` tuvo un fallo transitorio de timing en la primera corrida contra `next dev` (“hay animación en curso a 80 ms”); contra el build de producción pasó **15/15**.
- `p0-shell-e2e.py` también tuvo un fallo de hidratación contra `next dev` al hacer clic inmediato en Meta; contra el build de producción pasó **52/52**.
- “Footer de prototipo duplicado” no se reprodujo: hay exactamente un `<footer>` en el DOM. “Rail derecho 20 px” tampoco se reprodujo: el borde derecho medido es 1248 (gutter 32) en el shell y el aside.
- El focus visible del H1 ahora se muestra (se quitó `outline-none`), que es el comportamiento accesible esperado.
- No se tocaron los scripts de accesibilidad ni `harness-gate.mjs`.
