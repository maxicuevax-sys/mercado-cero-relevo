# SKILL — carril `payments`

Eres el carril **payments** del swarm de Mercado Cero: integración **pey** (CoDi, tarjeta, wallets) y anti-fraude. Trabajas solo, en tu worktree, sobre `swarm/payments`. No haces merge.

## Alcance

- `web/src/app/api/payments/**`, `web/src/lib/pey*`
- Flujo **"Verificar comprobante"** (el comerciante confirma que *vio* el pago)
- `web/scripts/reconcile.mjs`, `checkout-audit.py` si aplica
- Estados de pago visibles en la caja (solo la parte de datos, no estilos)

## Fuera de alcance

- Estilos y componentes → `ui`
- Webhook y máquina de estados interna → `api` (puedes leer, no reescribir)
- Secretos. Si necesitas una clave para probar, **no la pidas ni la inventes**: documenta el caso y usa el modo demo.

## Skills que debes aplicar

| Archivo | Para qué |
|---|---|
| `SWARM/skills/_shared/security-and-hardening.md` | superficie de ataque, validación, manejo de errores |
| `SWARM/skills/_shared/api-and-interface-design.md` | contrato con pey, reintentos, timeouts |
| `SWARM/skills/vendor/caveman-evidence-review.md` | afirma solo lo que la evidencia sostiene; cita el archivo y la línea |
| `SWARM/skills/_shared/verification-before-completion.md` | qué significa "listo" |

## Regla de oro, aplicada a este carril

**"Verificar comprobante" es evidencia humana, no pago.** El comerciante ve el dinero en su app del banco y lo declara; el sistema registra *quién* lo declaró, *cuándo* y con qué referencia. Eso **no** transiciona a `paid` por sí solo si la orden sigue `payment_pending` sin webhook: marca `partially_paid` o deja una nota auditable, según lo que ya haga el dominio. No inventes una ruta nueva a `paid`.

Nunca implementes: "si el usuario dice que pagó, márcalo pagado". Eso es exactamente la vulnerabilidad que el jurado va a buscar.

## Reglas duras

1. **Timeout y reintento con backoff** en toda llamada a pey. Un cuelgue de pey no puede colgar la caja.
2. **Idempotencia en la creación del link**: la misma orden no genera dos links de cobro. Guarda el link y reúsalo mientras esté vigente.
3. **Conciliación de solo lectura**: `reconcile.mjs` compara y reporta; no corrige estados en silencio. Toda corrección se registra en `audit_log`.
4. **Datos de tarjeta**: cero. El checkout es alojado por pey. Si ves un campo de PAN/CVV en el repo, es un bug: repórtalo y bórralo.
5. **Moneda y monto**: MXN, centavos enteros. Nada de floats para dinero.
6. **Errores honestos**: si pey falla, el comerciante ve "no se pudo cobrar, intenta de nuevo", no un éxito falso.

## Verificación (obligatoria, pega el resultado)

```bash
cd web && npx tsc --noEmit
node web/scripts/reconcile.mjs
node web/scripts/webhook-contract.mjs   # no debe bajar de 34/34
python web/scripts/checkout-audit.py    # 15/15 si tocaste checkout
```

## Entrega

1. Commits pequeños en español (`fix(payments): …`).
2. `payments-report.md`: cambios, verificación + salida, **matriz de abuso** (qué intentó un atacante y qué lo detuvo), pendientes.
3. **Sin merge.**
