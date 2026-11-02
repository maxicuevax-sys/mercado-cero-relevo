# EVALS — Mercado Cero

> Catálogo de evaluaciones del harness. Un gate solo cuenta si es determinista, tiene un comando reproducible y deja evidencia.
> Si una evaluación necesita una persona, se dice explícitamente y no se simula.

---

## 1 · Gates automáticos

| ID | Comando | Qué prueba | Lo que **no** prueba | Muta |
|---|---|---|---|---|
| `guard` | `node scripts/harness-guard.mjs` | Sin secretos trackeados; `.env.local` ignorado; invariantes demo/pey presentes | Que el webhook real funcione | No |
| `lint` | `npm run lint` | Convenciones y errores estáticos; marcador `eslint` + exit code | Comportamiento en runtime | No |
| `types` | `node scripts/run-types.mjs` | `next typegen` + `tsc --noEmit`; imprime `TYPES OK` | Datos reales | Genera `next-env.d.ts` (ignorado) |
| `deps` | `node scripts/check-deps.mjs` | `npm audit --omit=dev --audit-level=high`; 0 high/critical | Explotabilidad real, devDependencies | No |
| `build` | `npm run build` | Build de producción Next.js; **solo en `static`** | Servidor sirviendo el build | `.next/` |
| `truth` | `node scripts/verify-truth.mjs` | Un `transactionId` demo devuelve `verified:false` | Un pago pey real | Reset demo |
| `webhook` | `node scripts/webhook-contract.mjs` | Firma, replay, monto, orden, timestamp, QR; 27/27 | Que el banco emita el evento | Reset demo |
| `mobile` | `python scripts/mobile-audit.py` | Flujo completo a 360 px; 25/25 | Teléfono físico, TalkBack/VoiceOver | Reset demo |
| `checkout` | `python scripts/checkout-audit.py` | Checkout público a 360 px; 15/15 | Pago real por pey | Crea/paga demo |
| `hig` | `python scripts/hig-after-audit.py` | HIG/WCAG 2.2 AA, 48 px, 200%, 360/390/768/1280 | Personas reales | Reset/recorre |
| `motion` | `python scripts/motion-check.py` | Duraciones, scroll trigger, reduced-motion; `15 PASS · 0 FAIL` | Que el diseño guste | Recorre hojas/tabs |
| `contrast` | `python scripts/a11y-contrast.py` | Alto contraste: axe, foco visible y 360 px; `0 FAIL` | Personas reales | Recorre |
| `rehearsal` | `python scripts/rehearse-demo.py` | Guion completo, 3 corridas, 15 pasos por corrida | Que el público entienda | Reset/recorre |
| `tunnel` | `python scripts/tunnel-smoke.py` | Camino público HTTPS; 8/8 | Estabilidad del túnel en el evento | Reset/paga |
| `preflight` | `node scripts/preflight.mjs` | Servidor, túnel, datos, QR, respaldos; 18/18 | Que el QR esté impreso | Reset demo |
| `film` | `python scripts/film-check.py` | 8 beats, contact sheet, motion sheet; opcional | Que el diseño guste | Reset/recorre |

**Conteos canónicos:** catálogo **16** gates; `fast` **3**, `static` **5**, `full` **14** (sin `build` ni `film`) y `full --with-film` **15**. `motion-check.py` son **15** comprobaciones. Las referencias a 13/15 o 14/14 de motion son históricas y no describen este catálogo.

### Cuándo correr qué

- **`verify:fast`**: 3 gates; cada cambio pequeño antes de commit.
- **`verify:static`**: 5 gates; antes de arrancar/reiniciar el servidor. Incluye `deps` y `build`.
- **`verify:full`**: 14 gates; antes de decir “listo”, antes de un merge y antes de la demo. Requiere servidor y túnel.
- **`verify:full -- --with-film`**: 15 gates; cuando el cambio es visual o de movimiento.
- **`verify:full -- --skip=tunnel`**: diagnóstico local; **no** queda `ok:true` porque `tunnel` es crítico y no sirve para declarar QR público listo.
- **`--only`**: `mode: "partial"`; solo para depurar. Nunca es handoff ni se etiqueta como `full`.
- **`verify:evidence`**: al cerrar, contra el HEAD que se entrega. Falla si el SHA no coincide, el árbol estaba sucio o falta un gate.

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

1. Un output viejo no cuenta: la evidencia incluye SHA de inicio/fin, branch, dirty, timestamps y duración.
2. Un gate saltado o no ejecutado no está verde. Si es crítico, `ok:false`; `--only` es `partial` y también `ok:false`.
3. `ok:true` exige **todos** los gates del modo, todos con `ok:true` y con su `expected` validado contra la salida. El exit code solo no basta cuando existe un marcador.
4. Las capturas apoyan, no sustituyen: el estado de negocio se prueba contra API/SQLite.
5. Los secretos no se imprimen; el runner redacta valores de `.env.local` y patrones de claves.
6. Los runs locales viven en `harness/evidence/runs/` (ignorado); `latest.json` es el handoff y debe validarse con `npm run verify:evidence` contra HEAD.
7. Si un gate falla, no se cambia el umbral para que pase; se corrige la causa o se documenta el bloqueo.
8. `latest.json` no se versiona: es un artefacto local que se genera después del commit de código sobre el HEAD actual. Si se commiteara, HEAD cambiaría y la evidencia pasaría a atestiguar el commit anterior. `runs/` también es local/ignorado.
9. En `full`, los artefactos `motion-check.json` y `a11y-contrast.json` deben declarar el mismo commit y `code.dirty:false`. `hig-after/audit.json` está ignorado: si falta, es warning.

---

## 4 · Schema de `latest.json` (v2)

```json
{
  "schemaVersion": 2,
  "mode": "static",
  "requestedMode": "static",
  "partial": false,
  "startedAt": "2026-11-02T...",
  "finishedAt": "2026-11-02T...",
  "durationMs": 96043,
  "baseUrl": "http://localhost:3000",
  "error": null,
  "gitAtStart": { "sha": "...", "branch": "p0/fix-harness", "dirty": false },
  "gitAtEnd":   { "sha": "...", "branch": "p0/fix-harness", "dirty": false },
  "expectedGates": ["guard", "lint", "types", "deps", "build"],
  "criticalGates": ["guard", "lint", "types", "deps", "build"],
  "skipped": [],
  "notRun": ["truth", "webhook", "..."],
  "notRunReasons": { "truth": "fuera-del-modo" },
  "resets": [],
  "gates": [
    {
      "id": "deps",
      "name": "Dependencias de producción",
      "command": "node scripts/check-deps.mjs",
      "ok": true,
      "exitCode": 0,
      "durationMs": 3091,
      "expected": "DEPS OK",
      "expectedBasis": "output",
      "expectedMatched": true,
      "reason": "ok",
      "outputTail": "DEPS OK: 0 high/critical (0 total, 0 moderate, 0 low)"
    }
  ],
  "complete": true,
  "gatesOk": true,
  "evidenceValid": true,
  "cleanStart": true,
  "cleanEnd": true,
  "shaStable": true,
  "missing": [],
  "criticalMissing": [],
  "reasons": [],
  "ok": true
}
```

`mode` puede ser `fast`, `static`, `full` o `partial`. Solo los tres primeros pueden tener `ok:true`; `partial` siempre es `false`. `expectedBasis` es `output` cuando hay marcador y `exit-code` cuando el comando es silencioso en verde (hoy no queda ninguno: `types` imprime `TYPES OK`).

---

## 5 · Chequeo de integridad

```bash
cd web
npm run test:harness      # 44 tests del gate, deps y validación de evidencia
npm run verify:evidence   # lee latest.json y lo compara con HEAD
```

`verify:evidence` comprueba, entre otras cosas:

- `schemaVersion >= 2` y `mode` no `partial`.
- `gitAtStart.sha === HEAD` y `gitAtStart.dirty === false`.
- `gitAtEnd.sha === gitAtStart.sha` y `gitAtEnd.dirty === false`.
- `expectedGates` y `gates[]` coinciden exactamente con el modo.
- todos los gates `ok:true` y cada `expected` canónico validado.
- `skipped`/`notRun` no contienen gates críticos.
- `truth`/`preflight` registran reset de demo cuando aplican.
- en `full`, `motion-check.json` y `a11y-contrast.json` declaran el mismo commit limpio.

Un `FAIL` de este chequeo invalida el handoff aunque los gates hayan pasado.
