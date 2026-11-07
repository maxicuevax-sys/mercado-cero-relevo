# Accesibilidad MVP — Mercado Cero

> Objetivo: **WCAG 2.2 AA** y, como referencia TIC mexicana, **NMX-R-099-SCFI-2018**.
> Referencias internacionales: **EN 301 549 V4.1.1** y **ADA** para servicios cubiertos en EE. UU.
> Este documento es el contrato de accesibilidad del prototipo; no sustituye una auditoría con personas ni con lectores de pantalla reales.

## 1 · Checklist MVP

| Impacto | Acción | Estado | Evidencia |
|---|---|---|---|
| Alta | Contraste ≥ 4.5:1; no depender del color; foco visible; texto escalable | ✅ | Tokens, `axe` 0, foco 3 px, 200% y texto Normal/Grande/Muy grande |
| Alta | Targets ≥ 48 dp; teclado/switch; labels/ARIA | ✅ | `under48=0` en 360/390/768/1280; foco atrapado; labels en controles |
| Alta | TalkBack/VoiceOver | ⚠️ Parcial | ARIA y nombres accesibles implementados; **falta prueba en dispositivo real** |
| Alta | ASR → confirmación visual+oral → acción | ✅ | Transcripción visible, “Escuché … ¿Confirmas?”, draft y confirmación |
| Alta | TTS nunca “confirma pago” sin webhook válido | ✅ | Demo dice “Pago simulado”; pey dice “Pago verificado”; efectivo dice “Efectivo recibido” |
| Media | Alto contraste | ✅ | Ajuste persistente en Ayuda y accesibilidad |
| Media | Vibración + sonido | ✅ | `navigator.vibrate` en micrófono, pago, abono y verificación; chime existente |
| Media | Modo silencioso | ✅ | Botón de altavoz persistente; cancela audio y TTS |
| Media | Offline para ventas no bancarias | ❌ Pendiente | No se implementa en este MVP; nunca se marca pagado sin conexión |

## 2 · Flujo

```
Voz / texto
   ↓
ASR o parser local
   ↓
Confirmación visual + oral (“Escuché $185. ¿Confirmas?”)
   ↓
Cobro (link/QR o efectivo/fiado)
   ↓
Webhook firmado de pey
   ↓
Estado verificado + audio + registro
```

Regla: la IA **propone**; la comerciante **confirma**; el webhook **verifica**. Ningún TTS puede decir “Pago verificado” si el proveedor del pago no es `pey`.

Los pagos demo se guardan como `demo_paid` y `/api/verify` solo acepta `provider = 'pey'`: un comprobante demo nunca se muestra como verificado.

## 3 · Microcopy

- “Escuché $185. ¿Confirmas?”
- “Pago pendiente; aún no entregues.”
- “Pago verificado: $185.”
- “No pude oírte. Toca para escribir.”
- “Pago simulado: $185.” (solo demo)
- “Efectivo recibido: $185.” (no es confirmación bancaria)
- “Ajusta el texto, el contraste y la voz. Se guarda en este dispositivo.”

## 4 · Ajustes de accesibilidad en la app

En **Ayuda y accesibilidad** (icono `?`):

- **Texto:** Normal / Grande / Muy grande (persistente).
- **Contraste:** alto contraste (fondo blanco, texto negro, bordes y foco reforzados).
- **Voz:** Lenta / Normal / Rápida.
- **Leer esta pantalla:** lee títulos y estados visibles.
- **Repetir último aviso:** repite la última frase.
- **Escuchar** en Caja: instrucciones en voz alta.
- Micrófono de **80 px**, etiqueta completa y texto alternativo siempre visible.
- **Skip link** “Saltar al contenido”.
- Navegación por teclado con foco visible y trampa en sheets.

## 5 · Pruebas con personas (6–8)

Incluir al menos:

- 1 persona con baja visión.
- 1 persona mayor (65+).
- 1 persona con limitación motora (manos, temblor o movilidad reducida).
- 1 persona con limitación auditiva.
- 2–4 comerciantes sin discapacidad, como control.

Tareas:

1. Abrir la caja y encontrar cómo cobrar.
2. Vender dos quesadillas y un agua; corregir un monto.
3. Cobrar con link/QR y explicar si ya está pagado.
4. Verificar un comprobante falso.
5. Registrar un abono de fiado.
6. Contar efectivo y cerrar caja.
7. Activar texto grande y alto contraste.

Métricas:

- Éxito sin ayuda (sí/no).
- Tiempo por tarea.
- Errores y tipo de error.
- Número de ayudas verbales.
- SUS (System Usability Scale, 10 preguntas, 0–100).
- Preguntas cualitativas: ¿qué palabra usó?, ¿qué la confundió?, ¿usó voz o texto?

Hipótesis (exploratoria, no impacto poblacional):

> Con texto grande, alto contraste y voz, al menos **5 de 6** participantes completan la primera venta sin ayuda en **≤ 90 s**, y **0** confunden un pago demo/pendiente con dinero real. SUS objetivo: **≥ 75**.

## 6 · Evidencia automatizada

```powershell
cd mercado-cero\web
$env:BASE_URL="http://localhost:3000"
python scripts/hig-after-audit.py
```

El audit corre `axe` con `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, **`wcag22aa`** y best-practice; mide targets de **48 px**, foco, 200%, clipping y overflow. Reporte: `demo/hig-after/audit.json`.

## 7 · Lo que falta antes de decir “accesibilidad completa”

- Prueba real con **TalkBack** y **VoiceOver** en teléfono físico.
- Prueba con **switch/control por voz** del sistema.
- Estudio con **6–8 personas** y SUS.
- Offline para ventas no bancarias (si entra al alcance).
- Revisión de textos legales y de ayuda con una persona con baja visión.
- Validación NMX-R-099/EN 301 549 con un auditor externo si se comercializa.
