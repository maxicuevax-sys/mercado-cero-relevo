# Reporte — verdad visible del pago (P0-2 a P0-5 + P0-4 voz)

> Rama `p0/verdad-pago`, base `42d8f3f`. No se hizo merge.
> No se modificó la lógica de ledger ni el webhook; solo lectura/agregados y copy.

## Objetivo

Una sola verdad visible para el dinero:

- Un pago demo no se entrega ni se llama “Pagado”.
- “Verificado” solo describe un evento firmado de pey.
- “Cobrado confirmado” = efectivo + digital verificado por pey; declarado y demo van aparte.
- La pantalla de éxito de un pedido pendiente no afirma un débito ni retiene al comprador.
- La respuesta local por voz usa la misma verdad que la cabecera.

## Cambios

### P0-2 · Demo no se entrega

- `caja-app.tsx`: `canDeliver` ya no incluye `demo_paid`; `fulfillOrder` recibe la orden y cierra sin `PATCH` si es demo.
- Hoja de resultado demo: título “Pago demo (simulado)”, botón “Cerrar demo”, copy “No es dinero real. No se entrega.”
- El servidor sigue rechazando `PATCH /api/orders/:id/fulfill` con `409 demo_not_deliverable`; el E2E lo comprueba.

### P0-3 · Estados canónicos

- Nuevo módulo puro `web/src/lib/payment-labels.ts`:
  - efectivo recibido;
  - pago verificado por pey;
  - digital declarado, sin verificar;
  - por cobrar;
  - fiado;
  - pago demo (simulado);
  - pago parcial.
- Aplicado en resultado de cobro, actividad, checkout, success, ayuda, verificación y badges.
- `/api/verify` distingue `source: local` de `source: pey`; la UI ahora dice “Registrado por webhook firmado” o “Confirmado ahora por pey”. Se eliminó “El dinero sí llegó”.
- Un demo nunca usa “verificado”, “Pagado” ni “Listo para entregar”.

### P0-4 · Cifras unívocas

- Cabecera de Caja: `Ventas registradas hoy $X · Cobrado confirmado $Y · Por cobrar de hoy $Z`.
- `Cobrado confirmado` = efectivo + pagos verificados por pey. No incluye pendiente, declarado ni demo.
- Libreta “Cuánto llevo”: líneas separadas para efectivo, pey, declarado, por cobrar de hoy y demo; pie “Cobrado confirmado de hoy”.
- Corte/analytics: “Cobrado confirmado” y “Declarado sin verificar” separados; “Cómo te pagaron” muestra Confirmado + Declarado + Demo.
- Franja: “Cobros pendientes (todas las fechas)”. Cabecera: “Por cobrar de hoy”.
- Se agregó `salesCents` a `DailySummary` como agregado de lectura en `db.ts` (suma de `total_cents` del día). No cambia transiciones ni asientos.

### P0-4 · Voz local

`answerLocal` en `caja-app.tsx` ya no dice “Hoy llevas”. Nueva plantilla:

```text
Ventas registradas hoy $X · Cobrado confirmado $Y · Por cobrar de hoy $Z
[ · Declarado sin verificar $D]
[ · Demo $E (no es dinero real)].
```

Ejemplo real del E2E:

```text
Ventas registradas hoy $340.00 · Cobrado confirmado $0.00 · Por cobrar de hoy $180.00 · Demo $160.00 (no es dinero real).
```

Para el carril `p0/sin-ia`: su E2E debe buscar `Ventas registradas hoy` (o la cadena completa) en vez de `Hoy llevas`. `Cobrado confirmado` no incluye pendiente ni demo.

### P0-5 · Success honesto

- Pendiente: “Esperando la confirmación de pey” + “Si ya pagaste, estamos esperando la confirmación firmada de pey. Puedes cerrar; este link conserva el comprobante.”
- Se eliminaron “Tu pago ya salió del banco” y “No cierres esta pantalla”; se agregó salida “Cerrar esta pestaña”.
- Demo: “Pago demo (simulado)” + “No es dinero real”.
- Verificado: “Pago verificado por pey”.
- Efectivo: “Efectivo recibido”, sin llamarlo pago verificado.

### P0-5 · Copy de corte

- “Falta dinero en la caja” → “Hay $X menos de lo esperado. Puedes contar de nuevo, revisar retiros o guardar con motivo.”
- Se conserva “Cuadra” cuando la diferencia es cero.
- Se eliminaron “Falta”/“Sobra” como etiquetas secas en el resumen y la vista previa.

## Archivos

- `web/src/lib/payment-labels.ts` (nuevo, puro)
- `web/scripts/payment-labels-test.mjs` (nuevo)
- `web/scripts/payment-truth-e2e.py` (nuevo)
- `web/src/components/caja-app.tsx`
- `web/src/components/pending-payments.tsx`
- `web/src/app/pay/[id]/checkout-client.tsx`
- `web/src/app/pay/[id]/success/success-client.tsx`
- `web/src/lib/types.ts`
- `web/src/lib/db.ts` (agregado `salesCents`; sin cambios de ledger/webhook)
- `web/package.json` (`test:payment-labels`)

## Evidencia

- `npm ci`: PASS.
- `npm run lint`: PASS (0 errores, 0 warnings).
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS. El build previo al commit selló `BUILD SHA 42d8f3f`; después del commit se re-ejecutó para sellar el SHA entregado.
- `npm run test:payment-labels`: PASS, 6/6.
- `npm run verify:fast`: 3/3 gates PASS con el árbol limpio (guard, lint, types).
- `web/scripts/payment-truth-e2e.py`: **35/35 PASS**.
  - Servidor aislado `:3304`, `DATABASE_PATH` temporal, `DEMO_MODE=true`.
  - No tocó `:3000`, `:3230` ni la preview.
  - Capturas: `%TEMP%\opencode\verdad-pago\`
    - `01-cabecera.png`
    - `02-demo-resultado.png`
    - `03-success-pendiente.png`
    - `04-success-demo.png`
    - `05-voz-local.png`

### Qué prueba el E2E

- Venta demo + “Simular CoDi”: título demo, sin “Listo para entregar”, botón “Cerrar demo”, cero `PATCH` de entrega; el pedido queda `demo_paid`; la API responde 409 `demo_not_deliverable`.
- `/success` de pedido pendiente: espera confirmación firmada, permite cerrar, no dice “salió del banco”, no dice “No cierres”, no se muestra pagado.
- Cabecera: las tres etiquetas y sus montos coinciden con `/api/dashboard`; “Cobrado confirmado” no incluye pendiente ni demo; la franja dice “todas las fechas”.
- `/success` de demo: “Pago demo (simulado)”, “No es dinero real”, sin “verificado” ni “Listo para entregar”.
- Voz local con parser en modo consulta: la cadena nueva, sin “Hoy llevas”, con demo declarado como no dinero real.

## Hallazgos corregidos

1. Demo ofrecía entrega y `PATCH fulfill`.
2. Demo se presentaba como “Pago simulado” sin decir “no se entrega”.
3. Siete estados de dinero con etiquetas distintas entre Caja, checkout, success, actividad y ayuda.
4. “Cobrado” incluía declarado sin decirlo en Corte.
5. “Hoy” sumaba pendiente y demo como si fueran caja disponible.
6. “Por cobrar” de la cabecera (hoy) y de la franja (todas las fechas) compartían nombre.
7. Success de pendiente afirmaba un débito bancario y pedía no cerrar.
8. Verificación afirmaba “El dinero sí llegó” sin distinguir webhook local de consulta viva.
9. Copy de faltante culpabilizaba y no ofrecía siguiente paso.
10. Voz local sumaba demo/declarado y no separaba “Cobrado confirmado”.

## P0 no cerrados

Ninguno de los P0-2 a P0-5 solicitados.

Notas de alcance:

- `web/src/lib/voice.ts:answerQuery` no se usa desde la UI y conserva el copy viejo; no se tocó para no invadir `p0/sin-ia`.
- No se sembró un webhook pey firmado real en el E2E de esta rama; la copy verificada se cubre con el módulo puro de etiquetas y el camino `provider === "pey"`. La lógica del webhook no se modificó.
- No hay cambio de backend forzado: el único agregado es `salesCents` de lectura en `DailySummary`.

## Verificación manual

- [x] Revisé las capturas de cabecera, resultado demo, success pendiente, success demo y voz local.
- [x] Revisé estados demo/pendiente en la UI real del servidor aislado.
- [ ] No revisé 360 px ni 200 % en esta rama (fuera del alcance de este carril).
- [x] No hay secretos en el diff.
- [x] No introduje un camino `payment_pending → paid` fuera del webhook pey; demo sigue en `demo_paid`.
