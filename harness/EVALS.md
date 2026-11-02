# EVALS — Mercado Cero

> Catálogo de evaluaciones del harness. Un gate solo cuenta si es determinista, tiene un comando reproducible y deja evidencia.
> Si una evaluación necesita una persona, se dice explícitamente y no se simula.

---

## 1 · Gates automáticos

| ID | Comando | Qué prueba | Lo que **no** prueba | Muta |
|---|---|---|---|---|
| `guard` | `node scripts/harness-guard.mjs` | Sin secretos trackeados; `.env.local` ignorado; invariantes demo/pey presentes | Que el webhook real funcione | No |
| `lint` | `npm run lint` | Convenciones y errores estáticos | Comportamiento en runtime | No |
| `types` | `npx tsc --noEmit` | Contratos de TypeScript | Datos reales | No |
| `build` | `npm run build` | Build de producción Next.js | Servidor sirviendo el build | `.next/` |
| `truth` | `node scripts/verify-truth.mjs` | Un `transactionId` demo devuelve `verified:false` | Un pago pey real | Reset demo |
| `webhook` | `node scripts/webhook-contract.mjs` | Firma, replay, monto, orden, timestamp, QR y reintento corregido tras 409/404; 34/34 | Que el banco emita el evento | Reset demo |
| `mobile` | `python scripts/mobile-audit.py` | Flujo completo a 360 px; 25/25 | Teléfono físico, TalkBack/VoiceOver | Reset demo |
| `checkout` | `python scripts/checkout-audit.py` | Checkout público a 360 px; 15/15 | Pago real por pey | Crea/paga demo |
| `hig` | `python scripts/hig-after-audit.py` | HIG/WCAG 2.2 AA, 48 px, 200%, 360/390/768/1280 | Personas reales | Reset/recorre |
| `motion` | `python scripts/motion-check.py` | Duraciones 140–240 ms, scroll trigger, reduced-motion y 14 comprobaciones | Que el diseño guste | Recorre hojas/tabs |
| `contrast` | `python scripts/a11y-contrast.py` | Alto contraste: axe, foco visible y 360 px | Personas reales | Recorre |
| `rehearsal` | `python scripts/rehearse-demo.py` | Guion completo, 3 corridas, 15 pasos | Que el público entienda | Reset/recorre |
| `tunnel` | `python scripts/tunnel-smoke.py` | Camino público HTTPS; 8/8 | Estabilidad del túnel en el evento | Reset/paga |
| `preflight` | `node scripts/preflight.mjs` | Servidor, túnel, datos, QR, respaldos; 18/18 | Que el QR esté impreso | Reset demo |
| `film` | `python scripts/film-check.py` | 8 beats, contact sheet, motion sheet | Que el diseño guste | Reset/recorre |

### Cuándo correr qué

- **`verify:fast`**: cada cambio pequeño antes de commit.
- **`verify:static`**: antes de arrancar/reiniciar el servidor; incluye build.
- **`verify:full`**: antes de decir “listo”, antes de un merge y antes de la demo.
- **`verify:full -- --skip=tunnel`**: cuando el túnel temporal no está vivo; no sirve para declarar QR público listo.
- **`--with-film`**: cuando el cambio es visual o de movimiento.

---

## 2 · Evaluaciones humanas (no automatizables)

| Evaluación | Criterio | Evidencia |
|---|---|---|
| Pago real de $0.01 | Webhook firmado, monto/moneda/ref exactos, una sola transición | Captura del portal + log de evento + SQLite |
| Teléfono físico 360 px | Sin scroll horizontal, targets, una mano | Video/captura del dispositivo |
| TalkBack / VoiceOver | Flujo crítico comprensible y operable | Notas + grabación |
| 6–8 comerciantes | Tareas, errores, ayuda, SUS/NASA-TLX | `TEST-USUARIO.md` + registro |
| Revisión de copy y verdad | Ningún demo se lee como pagado real | Revisión independiente |
| Accesibilidad completa | No declararla sin las pruebas anteriores | `ACCESIBILIDAD.md` actualizado |

---

## 3 · Reglas de evidencia

1. Un output viejo no cuenta: la evidencia incluye commit SHA y timestamp.
2. Un gate saltado no está verde; se registra como “no ejecutado” y por qué.
3. Las capturas apoyan, no sustituyen: el estado de negocio se prueba contra API/SQLite.
4. Los secretos no se imprimen; el runner redacta valores de `.env.local` y patrones de claves.
5. Los runs locales viven en `harness/evidence/runs/`; `latest.json` es el handoff.
6. Si un gate falla, no se cambia el umbral para que pase; se corrige la causa o se documenta el bloqueo.

---

## 4 · Schema de `latest.json`

```json
{
  "schemaVersion": 1,
  "mode": "full",
  "startedAt": "2026-11-01T...",
  "finishedAt": "2026-11-01T...",
  "durationMs": 123456,
  "baseUrl": "http://localhost:3000",
  "git": { "sha": "...", "branch": "master", "dirty": false },
  "runtime": { "node": "v...", "platform": "win32", "python": "..." },
  "resets": [{ "before": "truth", "ok": true }],
  "gates": [
    {
      "id": "webhook",
      "name": "Contrato del webhook",
      "command": "node scripts/webhook-contract.mjs",
      "ok": true,
      "exitCode": 0,
      "durationMs": 2345,
      "outputTail": "27/27 pruebas en verde"
    }
  ],
  "ok": true
}
```
