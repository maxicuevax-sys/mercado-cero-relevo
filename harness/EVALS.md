# EVALS — Mercado Cero

> Catálogo de evaluaciones del harness. Un gate solo cuenta si es determinista, tiene un comando reproducible y deja evidencia.
> Si una evaluación necesita una persona, se dice explícitamente y no se simula.

---

## 1 · Gates automáticos

| ID | Comando | Qué prueba | Lo que **no** prueba | Marcador exacto | Muta |
|---|---|---|---|---|---|
| `guard` | `node scripts/harness-guard.mjs` | Sin secretos trackeados; `.env.local` ignorado; invariantes demo/pey presentes | Que el webhook real funcione | `Guardrails OK.` | No |
| `lint` | `node scripts/lint-gate.mjs` | ESLint con wrapper; el marcador solo sale con exit 0 | Comportamiento en runtime | `LINT OK` | No |
| `types` | `node scripts/run-types.mjs` | `next typegen` + `tsc --noEmit` | Datos reales | `TYPES OK` | Genera `next-env.d.ts` (ignorado) |
| `deps` | `node scripts/check-deps.mjs` | `npm audit --omit=dev --audit-level=high`; 0 high/critical | Explotabilidad real, devDependencies | `DEPS OK` | No |
| `build` | `node scripts/build-gate.mjs` | Build Next.js con `BUILD_SHA` y `.next/BUILD_SHA`; **solo `static`** | Servidor sirviendo el build | `BUILD OK` + `compiled successfully` | `.next/` (ignorado) |
| `truth` | `node scripts/verify-truth.mjs` | Un `transactionId` demo devuelve `verified:false` | Un pago pey real | `VERDAD OK` | Reset demo |
| `webhook` | `node scripts/webhook-contract.mjs` | Firma, replay, monto, orden, timestamp, QR y reintento corregido tras 409/404 | Que el banco emita el evento | `WEBHOOK OK` + `34/34` | Reset demo |
| `mobile` | `python scripts/mobile-audit.py` | Flujo completo a 360 px | Teléfono físico, TalkBack/VoiceOver | `MOBILE OK` + `25/25` | Reset demo |
| `checkout` | `python scripts/checkout-audit.py` | Checkout público a 360 px | Pago real por pey | `CHECKOUT OK` + `19/19` | Crea/paga demo |
| `hig` | `python scripts/hig-after-audit.py` | HIG/WCAG 2.2 AA, 48 px, 200%, **4 viewports** | Personas reales | `HIG OK` + `4 viewports` | Reset/recorre |
| `motion` | `python scripts/motion-check.py` | Duraciones, scroll trigger, reduced-motion | Que el diseño guste | `MOTION OK` + `19 PASS` + `0 FAIL` | Recorre hojas/tabs |
| `contrast` | `python scripts/a11y-contrast.py` | Alto contraste: axe, foco visible y 360 px | Personas reales | `CONTRAST OK` + `0 FAIL` | Recorre |
| `mobile-320` | `node scripts/mobile-320-gate.mjs` | 320/360 px en Chromium, Firefox y WebKit: labels, CTA y foco | Teléfono físico, lector real | `MOBILE 320/360 E2E` + `42 PASS` + `0 FAIL` | Servidor aislado + DB temporal |
| `rehearsal` | `python scripts/rehearse-demo.py` | Guion completo, 3 corridas, 15 pasos por corrida | Que el público entienda | `REHEARSAL OK` + `todo en verde: True` | Reset/recorre |
| `security` | `node scripts/security-contract.mjs` | CSRF, token de reset, límites de cuerpo, rate limit, headers, backup y protección de pagos reales | Despliegue real detrás de Cloudflare Access | `SEGURIDAD OK` | Servidor aislado + DB temporal |
| `data` | `npm run test:fix-datos` | Idempotencia, transacciones, migraciones y mapeo de errores; **85 checks (58+20+7)** | Carga de producción | `DATOS OK` + `P0 FIX DATOS` + `P0 DB GUARDS` + `P0 ORDERS ATOMIC` | Servidor aislado + DB temporal |
| `perf` | `node scripts/perf-budget.mjs` | Presupuesto de JS, CSS, fuentes, fotos e iconos del build | Latencia de red real | `PERF BUDGET OK` | No |
| `p0-venta` | `node scripts/p0-venta-gate.mjs` | Venta durable, draft, cambio, validaciones inline | Que una comerciante lo entienda | `65 PASS` + `0 FAIL` + `0 KNOWN` | Servidor aislado + DB temporal |
| `p0-fiado` | `python scripts/p0-fiado-e2e.py` | Abono confirmado, saldo vivo, idempotencia y carrera | Crédito real | `51 PASS` + `0 FAIL` + `0 KNOWN` | Servidor aislado + DB temporal |
| `p0-corte` | `python scripts/p0-corte-e2e.py` | Corte no destructivo, versiones, snapshot, migración y 409 | Operación multi-proceso | `69 PASS` + `0 FAIL` + `0 KNOWN` | Servidor aislado + DB temporal |
| `p0-integracion` | `python scripts/p0-integracion-e2e.py` | Pendientes, tareas, venta mixta y carrera de refresco | Estrés con muchos clientes | `51 PASS` + `0 FAIL` + `0 KNOWN` | Servidor aislado + DB temporal |
| `p0-dinero` | `python scripts/p0-dinero-e2e.py` | Arranque real, fixtures demo, webhook, verify, fiado, fechas y corte | Pago real con pey | `45 PASS` + `0 FAIL` + `3 KNOWN` | Servidor aislado + DB temporal |
| `tunnel` | `python scripts/tunnel-smoke.py` | Camino público HTTPS por Cloudflare | Estabilidad del túnel en el evento | `TUNNEL OK` + `8/8` | Reset/paga |
| `preflight` | `node scripts/preflight.mjs` | Servidor, túnel, datos, QR, respaldos y video | Que el QR esté impreso | `PREFLIGHT OK` + `18/18` | Reset demo |
| `film` | `python scripts/film-check.py` | 8 beats, contact sheet, motion sheet; opcional | Que el diseño guste | `FILM OK` + `SHEET` | Reset/recorre |

**Conteos canónicos:** catálogo **25** gates; `fast` **3**, `static` **5**, `full` **23** (sin `build` ni `film`) y `full --with-film` **24**. Los markers se comparan con límites de palabra: `0 FAIL` no acepta `10 FAIL` y `25/25` no acepta `125/125`.

**Cobertura p0:** `p0-venta` (65), `p0-fiado` (51), `p0-corte` (69), `p0-integracion` (51) y `p0-dinero` (45 + 3 KNOWN). Cada uno levanta su servidor aislado en 3211–3213 con SQLite temporal; `security`/`data` usan 3191/3192 y `mobile-320` 3214. `p0-shell` (68 PASS) sigue siendo evidencia de carril aparte, no un gate del full.

**Contratos fuera del catálogo:** CI también corre `test:security`, `test:fix-datos`, `test:perf-budget` y `test:perf-data` (este último sin servidor). No cambian el conteo del full; si fallan, el job estático falla.

### Cuándo correr qué

- **`verify:fast`**: 3 gates; cada cambio pequeño antes de commit.
- **`verify:static`**: 5 gates; antes de arrancar/reiniciar el servidor. Incluye `deps` y `build` con identidad.
- **`verify:full`**: 23 gates; antes de decir “listo”, antes de un merge y antes de la demo. Requiere servidor construido desde HEAD y túnel.
- **`verify:full -- --with-film`**: 24 gates; cuando el cambio es visual o de movimiento.
- **`verify:full -- --skip=tunnel`**: diagnóstico local; **no** queda `ok:true` porque deja `partial:true` y `tunnel` es crítico.
- **`--only`**: `mode: "partial"`; solo para depurar. Nunca es handoff ni se etiqueta como `full`.
- **`verify:evidence`**: al cerrar, contra el HEAD que se entrega. Falla si el SHA no coincide, el árbol está sucio, el build servido no es el mismo, falta un gate o un artefacto/hash no coincide. `fast` se rechaza salvo `--allow-fast`.

---

## 2 · Evaluaciones humanas (no automatizables)

| Evaluación | Criterio | Evidencia |
|---|---|---|
| Pago real de $0.01 | Webhook firmado, monto/moneda/ref exactos, una sola transición | Captura del portal + log de evento + SQLite |
| Teléfono físico 360/320 px | Sin scroll horizontal, targets, una mano | Video/captura del dispositivo |
| TalkBack / VoiceOver | Flujo crítico comprensible y operable | Notas + grabación |
| 6–8 comerciantes | Tareas, errores, ayuda, SUS/NASA-TLX | `TEST-USUARIO.md` + registro |
| Revisión de copy y verdad | Ningún demo se lee como pagado real | Revisión independiente |
| Accesibilidad completa | No declararla sin las pruebas anteriores | `ACCESIBILIDAD.md` actualizado |

---

## 3 · Reglas de evidencia

1. Un output viejo no cuenta: la evidencia incluye SHA de inicio/fin, branch, dirty, buildSha, timestamps y duración.
2. Un gate saltado o no ejecutado no está verde. Si es crítico, `ok:false`; `--only` y `--skip` son `partial` y también `ok:false`.
3. `ok:true` exige **todos** los gates del modo, todos con `ok:true`, `exitCode:0`, `reason:"ok"`, `expectedMatched:true` y artefactos existentes con hash.
4. Las capturas apoyan, no sustituyen: el estado de negocio se prueba contra API/SQLite.
5. Los secretos no se imprimen; el runner redacta valores de `.env.local` y patrones de claves.
6. Los runs locales viven en `harness/evidence/runs/` (ignorado); `latest.json` es el handoff y solo se escribe en `full`/`static` con `ok:true`.
7. Si un gate falla, no se cambia el umbral para que pase; se corrige la causa o se documenta el bloqueo.
8. `latest.json` no se versiona: es un artefacto local que se genera después del commit sobre el HEAD actual. Si se commiteara, HEAD cambiaría y la evidencia pasaría a atestiguar el commit anterior. `runs/` también es local/ignorado.
9. `serverBuildSha` debe ser igual a `gitAtStart.sha`. Un servidor de otro build no es evidencia de este árbol.
10. Los artifacts declarados se validan con `sha256` y tamaño; un JSON que declare `code.commit` distinto o `code.dirty:true` invalida la evidencia.
11. `npm run harness:report` genera la tabla desde `latest.json`; no se escribe a mano.

---

## 4 · Schema de `latest.json` (v2)

```json
{
  "schemaVersion": 2,
  "mode": "static",
  "requestedMode": "static",
  "partial": false,
  "startedAt": "2026-11-02T...",
  "endedAt": "2026-11-02T...",
  "durationMs": 96043,
  "baseUrl": "http://localhost:3000",
  "serverBuildSha": "c0248ba...",
  "buildMatches": true,
  "node": "v25.7.0",
  "os": "win32-x64",
  "python": "Python 3.14.3",
  "error": null,
  "gitAtStart": { "sha": "c0248ba...", "branch": "p0/fix-harness-evidence", "dirty": false },
  "gitAtEnd":   { "sha": "c0248ba...", "branch": "p0/fix-harness-evidence", "dirty": false },
  "expectedGates": ["guard", "lint", "types", "deps", "build"],
  "criticalGates": ["guard", "lint", "types", "deps", "build"],
  "skipped": [],
  "notRun": ["truth", "webhook", "..."],
  "notRunReasons": { "truth": "fuera-del-modo" },
  "resets": [],
  "gates": [
    {
      "id": "build",
      "name": "Build de producción con identidad",
      "command": "node scripts/build-gate.mjs",
      "baseUrl": null,
      "buildSha": null,
      "ok": true,
      "exitCode": 0,
      "durationMs": 30410,
      "expected": ["BUILD OK", "compiled successfully"],
      "expectedBasis": "output",
      "expectedMatched": true,
      "reason": "ok",
      "artifacts": [
        {
          "path": "web/.next/BUILD_SHA",
          "exists": true,
          "sha256": "...",
          "size": 104
        }
      ],
      "outputTail": "..."
    }
  ],
  "complete": true,
  "gatesOk": true,
  "evidenceValid": true,
  "buildBound": true,
  "cleanStart": true,
  "cleanEnd": true,
  "shaStable": true,
  "missing": [],
  "criticalMissing": [],
  "reasons": [],
  "ok": true
}
```

`mode` puede ser `fast`, `static`, `full` o `partial`. Solo `full` y `static` con `ok:true` escriben `latest.json`; `fast` se rechaza para handoff salvo `--allow-fast`; `partial` siempre es `false`.

---

## 5 · Chequeo de integridad

```bash
cd web
npm run test:harness      # 48 tests: gate, deps, schema v2 y evidencia
npm run verify:evidence   # lee latest.json y lo compara con HEAD
npm run harness:report    # tabla Markdown desde latest.json
```

`verify:evidence` comprueba, entre otras cosas:

- `schemaVersion === 2`, `mode` `full`/`static` (o `fast` con `--allow-fast`), `partial:false`.
- `complete:true`, `ok:true`, `error:null`.
- `gitAtStart.sha === HEAD`, `gitAtStart.dirty === false`.
- `gitAtEnd.sha === gitAtStart.sha`, `gitAtEnd.dirty === false`.
- árbol actual limpio, ignorando artefactos generados.
- `serverBuildSha === gitAtStart.sha` y `buildBound:true`.
- `expectedGates` y `gates[]` coinciden exactamente con el modo.
- todos los gates `ok:true`, `exitCode:0`, `reason:"ok"` y `expectedMatched:true`; los de runtime declaran `buildSha === gitAtStart.sha`.
- cada `expected` canónico validado con límites de palabra.
- cada artefacto existe, su `sha256`/`size` coincide y, si declara `code.commit`/`code.dirty`, coincide con el HEAD limpio.
- `skipped`/`notRun` no contienen gates críticos.
- `truth`/`preflight` registran reset de demo cuando aplican.
- `startedAt`/`endedAt` coherentes, `baseUrl`/`node`/`os` presentes.

Un `FAIL` de este chequeo invalida el handoff aunque los gates hayan pasado.
