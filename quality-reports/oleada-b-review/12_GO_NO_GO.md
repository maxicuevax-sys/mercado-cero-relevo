# 12 — GO / NO-GO — OLEADA B (Caja y Ventas)

**Agente:** `mc-verificador-final` (subagente independiente)
**Fecha:** 4 de noviembre de 2026
**Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
**Rama:** `design/oleada-b-caja-ventas`
**HEAD / build:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02`
**Servidor:** `http://localhost:3100`, `buildSha=4130e71...`, `DEMO_MODE=true`
**Árbol:** solo `?? quality-reports/oleada-b-review/` (evidencia; no se borró)
**Declaración:** no implementé, no corregí producto, no hice commits.

---

## 1. Decisión

| Nivel | Decisión | Alcance |
|---|---|---|
| **Cierre local de Oleada B** | **NO-GO** | No se puede declarar B cerrada ni “lista” con los 2 P0 abiertos. |
| **Demo controlada** | **GO CONDICIONADO — solo guion restringido** | Efectivo exacto/con cambio + digital demo, con operador. **NO-GO** si el guion incluye fiado puro o mixto efectivo+digital. |
| **Handoff público** | **NO-GO** | Sin pey/webhook/QR reales, sin lector/iOS, `latest.json` de `9206ea1`, `APP_URL` local y P0 abiertos. |

**En una frase:** la base técnica es buena y el motor financiero está intacto, pero la interfaz miente sobre dinero en fiado puro y mixto efectivo+digital; no se aprueba por un smoke 44/44 que no mide esos casos.

---

## 2. Bloqueadores

### 2.1 P0 — no negociables

| ID | Qué pasa | Por qué bloquea | Evidencia |
|---|---|---|---|
| **P0-01** | Fiado 100 % muestra “el efectivo sí se registró en la caja” con `paidCents=0`. | Contradice la regla de oro “fiado es deuda, no dinero recibido”; la comerciante puede creer que entró efectivo. | `EVIDENCIAS/final-fiado-puro.png`; `repo-fiado-banner-p0.json` |
| **P0-02** | Mixto efectivo+digital oculta $60 ya cobrados y dice “El dinero aún no se considera recibido”. | La persona no sabe si tiene $60 en el cajón; puede volver a cobrar o entregar mal. | `EVIDENCIAS/final-mixto-panel.png`; `repo-mixto-cash-hidden-p0.json` |

### 2.2 P1 que también impiden cierre

- **P1-08** `/ventas` oculta “Cobrado $60.00” cuando el pedido pasa a `payment_pending` (REP-08, servidor real aislado 3107).
- **P1-09** Abonos demo suman **$450.00** a “Cobrado confirmado” mientras el subtítulo dice “demo no cuenta” (REP-07).
- **P1-12** Un 502 post-commit + edición duplica una venta pagada (dos órdenes: 4000 y 8000).
- **P1-01** Dos Cajas/dos drafts/dos requestId sin migración ni lock; la nav lleva a legacy y oculta el draft v2.
- **P1-06** Un cobro pendiente secuestra `/caja`; no hay “Nueva venta/Descartar”.
- **P1-07** Cambio fantasma ($100 efectivo + $100 fiado → “Cambio $100, aplicado $0”) y aviso falso “El total cambió”.
- **P1-10** `/api/demo/pay` acepta pedidos `demo=0` y no es idempotente por pedido (heredado).

---

## 3. Qué sostiene el NO-GO (evidencia dura)

| Prueba | Resultado | Evidencia |
|---|---|---|
| Fiado puro contra banner | Texto falso con `paid=0` | `final-fiado-puro.png` |
| Mixto efectivo+digital | “No recibido” con `paid=6000` | `final-mixto-panel.png` |
| Importe de línea | 1×1 px a 1448/1366/1280/768 | `final-line-*.png`; `importe-linea-invisible.txt` |
| CTA 3 conceptos | Fuera a 1366/1280/768 | `final-cta-*.png`; `shell-cta-scrolltop.json` |
| Texto 200 % | CTA `y=1359.7`; `/ventas` 320 `scrollWidth=337` | `final-text200-1366.png`; `final-text200-ventas-320.png` |
| Dos drafts/Cajas | v1 y v2 coexisten; nav aterriza en legacy | `final-two-drafts-*.png`; `final-two-cajas-nav.png` |
| Historial `payment_pending` | Solo “Pendiente/Falta $40”; sin “Cobrado $60” | `final-ventas-payment-pending.png`; `final-verificador-history.json` |
| Abono demo | “$450.00” con “demo no cuenta” | `final-abono-demo-cobrado.png` |
| Cambio fantasma | “Cambio $100, aplicado $0” | `final-mixto-phantom.png` |
| Aviso falso | “El total cambió” en split válido | `final-mixto-false-total.png` |

---

## 4. Qué haría falta para cambiar la decisión

### 4.1 Para **GO local** (cierre de B)

1. P0-01 y P0-02 corregidos y con regresión de copy/estado en el gate.
2. P1-08, P1-09, P1-12 y P1-06 corregidos o formalmente aceptados por el dueño con fecha y mitigación.
3. P1-01/P1-02/P1-03/P1-04/P1-05 resueltos o waivers escritos con dueño.
4. `verify:full` sobre HEAD limpio + `verify:evidence` PASS; `latest.json` con `gitAtStart.sha=HEAD`, `dirty:false`, `serverBuildSha=HEAD`.
5. Regresiones que cubran: fiado puro, mixto cash+digital, línea visible, CTA 1366, 200 % con rectángulos disjuntos, dos drafts, `payment_pending` con `paid>0`, abono demo.

### 4.2 Para **demo controlada** (GO condicionado)

- Guion cerrado: una venta en efectivo exacto, una con cambio, una digital demo.
- No navegar a Fiado puro, Mixto, `/ventas` con `payment_pending`, ni “Ayuda”.
- Operador presente; demo etiquetada como simulación; no compartir links `localhost`.
- Si se quiere mostrar fiado/mixto, primero corregir P0-01/P0-02.

### 4.3 Para **handoff público**

- Todo lo anterior, más pey real, webhook firmado real, QR real escaneado, lector real, iOS/Safari, HCM real y URL pública válida.
- `latest.json` full del HEAD limpio y `verify:evidence` PASS.
- Sin P0/P1 de verdad de dinero abiertos.

---

## 5. Lo que el 44/44 smoke no prueba

| Hallazgo | ¿Lo cubre el smoke? |
|---|---|
| P0-01 banner de fiado | No: valida DB “fiado sin efectivo”, no ausencia de la frase falsa. |
| P0-02 panel mixto | No: valida cambio y DB, no el panel post-confirmación. |
| Importe de línea | No: mide overflow, no visibilidad por línea. |
| CTA a 1366 | No: prueba 390/320 sin overflow, no el fold con 3 conceptos. |
| 200 % | No: `scrollWidth` puede pasar mientras el CTA está en `y=1359`. |
| Dos Cajas/drafts | No: nunca abre `/` ni inyecta v1. |
| Historial `payment_pending` | No. |
| Abono demo en “Cobrado confirmado” | No. |

**Por eso el 44/44 no se usa como aprobación.**

---

## 6. Riesgos residuales y no probado

- Lector real, iOS/Safari, teclado virtual real, HCM real y QR real: **no ejecutado**.
- Pey/webhook/checkout reales: **no ejecutado**; sin `PEY_API_KEY`.
- Full gate de HEAD: **no ejecutado**; `latest.json` es de `9206ea1`.
- Multiproceso natural: solo reproducido con lock externo; no carrera espontánea.
- Estudio con 5 personas: **no ejecutado**.
- `verify:evidence -- --static` hoy falla solo por el untracked de esta revisión; la corrida original de `4130e71` sí era limpia. No es una regresión de producto, pero impide declarar “árbol limpio” sin excluir la carpeta de evidencia.

---

## 7. Firma del verificador

**NO-GO local. GO condicionado solo para demo restringida. NO-GO público.**

No autorizo declarar Oleada B cerrada, actualizar `latest.json` como GO ni publicar un handoff con este estado. Sí reconozco que la base es funcional, que el motor financiero no se tocó y que el camino efectivo/digital demo es demostrable con acompañamiento y guion.

**Rutas:**
- Veredicto completo: `quality-reports/oleada-b-review/11_VEREDICTO_INDEPENDIENTE.md`
- Evidencia propia: `quality-reports/oleada-b-review/EVIDENCIAS/final-*`
- Informe de reproducción: `quality-reports/oleada-b-review/EVIDENCIAS/final-verificador*.json`
