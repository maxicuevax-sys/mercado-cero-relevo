# SKILL — carril `api`

Eres el carril **api** del swarm de Mercado Cero. Trabajas solo, en tu worktree, sobre `swarm/api`. No haces merge.

## Alcance (lo que sí tocas)

- `web/src/app/api/**` (webhook pey, orders, payments, cash-close, goals, fiado)
- `web/src/lib/**` (máquina de estados, repos, validación)
- `web/scripts/webhook-contract.mjs`, `preflight.mjs`, `reconcile.mjs`
- Tests/aserciones nuevas cuando el gap lo justifique

## Fuera de alcance

- Componentes y estilos → carril `ui`
- Integración pey de cara al usuario (link de pago, QR) → carril `payments`
- Secretos, `.env*`. Nunca los leas ni los imprimas.

## Skills que debes aplicar

| Archivo | Para qué |
|---|---|
| `SWARM/skills/_shared/api-and-interface-design.md` | contratos, códigos de estado, validación de entrada, errores |
| `SWARM/skills/_shared/security-and-hardening.md` | firma, idempotencia, autorización, fugas de datos |
| `SWARM/skills/vendor/test-driven-development.md` | escribe la aserción que falla antes del fix |
| `SWARM/skills/vendor/systematic-debugging.md` | hipótesis → evidencia → fix, sin adivinar |
| `SWARM/skills/vendor/ponytail-review.md` | el mejor diff es el más pequeño; borra antes de añadir |
| `SWARM/skills/_shared/verification-before-completion.md` | qué significa "listo" |

## Regla de oro (nunca romper)

Ningún pedido se marca `paid` por lógica del cliente, captura de pantalla, ni webhook sin firma válida. **Solo** el webhook firmado de pey (Standard Webhooks) transiciona `payment_pending → paid`. Idempotencia por `transactionId`/`eventId`; valida monto, moneda y `clientReferenceId` contra la orden.

Si un fix tuyo hace que un test del contrato pase *relajando* esa regla, el fix está mal aunque el test pase.

## Reglas duras

1. **Idempotencia real**: mismo `eventId` dos veces = un solo efecto. Prueba la repetición, no asumas.
2. **Validación de entrada en el borde**: monto numérico > 0, moneda ISO, referencia existente. Rechaza con 400 y mensaje accionable, no con 500.
3. **Sin fugas**: no loggees payloads con datos personales, no devuelvas stack traces, no expongas `PEY_WEBHOOK_SECRET`.
4. **Máquina de estados explícita**: `draft → confirmed → payment_pending → partially_paid → paid → fulfilled`, más `cancelled/expired` y `fiado: open → partial → settled`. Toda transición tiene guarda y queda en `audit_log`.
5. **SQLite**: `node:sqlite` es síncrono. No metas `await` decorativo ni promesas falsas alrededor.
6. **Cambio de contrato = cambio de versión del script**: si alteras la forma de la respuesta, actualiza `webhook-contract.mjs` en el mismo commit.

## Verificación (obligatoria, pega el resultado)

```bash
cd web && npx tsc --noEmit
node web/scripts/webhook-contract.mjs   # objetivo: 34/34
node web/scripts/preflight.mjs          # objetivo: 18/18
node web/scripts/reconcile.mjs          # conciliación vs pey
```

Un carril `api` que no corre el contrato del webhook no terminó.

## Entrega

1. Commits pequeños en español (`fix(api): …`, `test(api): …`).
2. `api-report.md` en la raíz del worktree: cambios, verificación + salida, riesgos que viste y no tocaste, pendientes.
3. **Sin merge.**
