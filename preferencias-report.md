# Preferencias de acompañamiento — reporte P1-1

**Rama:** `p0/preferencias`
**Base:** `42d8f3f`
**Commit de código:** `a1439c3dd84e8411f8916823d0904e6a3b67af3a`
**Estado:** PASS
**Alcance:** sección “¿Cómo quieres que te ayude?” dentro de la hoja de Ayuda. Sin cambios en dinero, pagos, tareas ni IA.

---

## 1 · Qué se entregó

| Archivo | Cambio |
|---|---|
| `web/src/components/companion-preferences.tsx` | Componente nuevo con las tres preferencias, persistencia versionada, llave espejo, referencia de voz y nota de privacidad. |
| `web/src/components/caja-app.tsx` | Importación y render de `<CompanionPreferences />` dentro de `HelpContent`, después de Accesibilidad. No se reemplazó texto, contraste ni voz. |
| `web/scripts/companion-preferences-e2e.py` | E2E aislado en `:3305` con base temporal, `DEMO_MODE=true` y capturas en `%TEMP%\opencode\preferencias\`. |
| `harness/evidence/companion-preferences-e2e.json` | Evidencia generada por el E2E (26 PASS, 0 FAIL, árbol limpio). |

### Preferencias

| Preferencia | Default | Efecto real |
|---|---|---|
| **Sugerencias para revisar** | Activada | Escribe `mercado-cero:companion:suggestions` como `"on"` u `"off"` y emite `mercado-cero:companion-changed`. La tarjeta “Antes de cerrar” de otro carril debe leer esa llave. |
| **Recordatorios de pendientes** | Activada | Solo preferencia persistida. No hay notificaciones push ni recordatorios automáticos. |
| **Explicaciones en contexto** | Activada | Solo preferencia persistida. No altera la interfaz crítica ni las operaciones. |

### Persistencia

```json
{ "v": 1, "suggestions": true, "reminders": true, "explanations": true }
```

- Llave: `localStorage["mercado-cero:companion:v1"]`.
- Espejo para la tarjeta de otro carril: `localStorage["mercado-cero:companion:suggestions"]` con `"on"` u `"off"`.
- Evento same-tab: `mercado-cero:companion-changed`, con `detail = {v:1, suggestions, reminders, explanations}`.
- Lectura defensiva: si el JSON falta, está corrupto o la versión no es `1`, se usan los defaults (todo activado).
- Almacenamiento no esencial: lectura y escritura van en `try/catch`; si `localStorage` falla, el control cambia en memoria y la app sigue. Probado en el E2E.

### Voz y privacidad

- La voz **no se duplica**: la sección remite al botón de la barra superior (silencio) y a “Velocidad de la voz” en Accesibilidad.
- Texto publicado: “El audio que grabas mientras mantienes el micrófono se envía a OpenAI para transcribirlo. La app no guarda el audio. Si prefieres, escribe la venta.”
- Verificación del proveedor: `web/src/lib/voice.ts:34-48` usa el cliente de OpenAI y el modelo `gpt-4o-mini-transcribe`; `web/src/app/api/voice/transcribe/route.ts:32-47` recibe el archivo y responde solo texto, sin escribirlo en disco ni en la base. La frase “la app no guarda el audio” se sostiene con ese código. No se auditó la retención interna de OpenAI, por eso no se afirma nada sobre ella.
- La nota aclara que las preferencias no apagan avisos críticos de dinero, pagos ni cobros pendientes.

---

## 2 · Gates ejecutados

| Gate | Comando | Resultado |
|---|---|---|
| Instalación | `npm ci` (desde `web/`) | OK · 385 paquetes · 16 vulnerabilidades moderadas preexistentes, sin tocar |
| Guardrails + lint + tipos | `npm run verify:fast` | OK · 3/3 gates |
| Lint | `npm run lint` | OK, sin errores |
| Tipos | `npx tsc --noEmit` | OK, sin errores |
| Build | `npm run build` | OK · `BUILD SHA a1439c3dd84e8411f8916823d0904e6a3b67af3a` |
| E2E | `python scripts/companion-preferences-e2e.py` | **26 PASS · 0 FAIL** |

El E2E corrió sobre el build sellado con el commit de código, con árbol limpio (`gitAtStart.dirty: false`). Evidencia: `harness/evidence/companion-preferences-e2e.json`.

### Casos cubiertos

- Abrir Ayuda y ver el encabezado “¿Cómo quieres que te ayude?”.
- Tres controles activados por defecto, con `aria-pressed` y `aria-describedby`.
- Targets de 48 px o más (103–131 px de alto en escritorio; 268–302 px con texto grande a 360 px).
- Apagar “Sugerencias” con **Space**; verificar `aria-pressed=false`, JSON versionado y espejo `"off"`.
- Recargar y comprobar que sigue apagada, sin encender las otras dos.
- Crear un cobro pendiente real por API (sin pago) y comprobar que la franja **“Cobros pendientes”** sigue visible con “Sugerencias” apagada. No se tocó ningún aviso crítico.
- Encender de nuevo con **Enter**, verificar `"on"` y persistencia tras recarga.
- Apagar y recargar “Recordatorios” y “Explicaciones” de forma independiente.
- Forzar `localStorage.setItem` para que lance `QuotaExceededError`: el control sigue respondiendo en memoria; al restaurar, vuelve a persistir.
- 360 px con texto “Muy grande”: sin desborde horizontal (`360/360`).
- Ninguna petición a `:3000` ni a `:3230`.

---

## 3 · Capturas

Directorio: `%TEMP%\opencode\preferencias\` (resuelto en esta máquina como `C:\Users\ELITEB~1\AppData\Local\Temp\opencode\preferencias\`).

| Archivo | Qué muestra | SHA-256 |
|---|---|---|
| `01-ayuda-abierta.png` | Ayuda con la sección nueva y todo activado. | `8a69164a4248e8456ec82f7ebb8998d0da3d2a905abf507ae0c790db9932158b` |
| `02-sugerencias-apagadas.png` | “Sugerencias” apagada con foco de teclado visible. | `3e130f85ed64aba11c26b907e63deec8c94fcfebf823f17cfbad485f8c042381` |
| `03-recarga-apagada.png` | Tras recargar, la preferencia sigue apagada. | `f9541f54a47e4e65fe30d6222f0b5c844a0c3358cede1fc4020c6d44b6d04ed2` |
| `04-cobro-pendiente-sugerencias-apagadas.png` | Cobro pendiente visible con “Sugerencias” apagada. | `734c2b8fe491d6733d95272d7377c948d4fb7b1c298a296c8ce4f4d3724416f1` |
| `05-sugerencias-encendidas.png` | “Sugerencias” encendida de nuevo. | `ac1db6da1061852134ac1750e101ecda2830a3e0d111b58f2a2082f3164a5b27` |
| `06-360-texto-grande.png` | 360 px y texto grande, sin desborde. | `0b3af621f6d6b226c9d064db4a972808ffc7c522b13f11684348cc34d63e0e03` |

---

## 4 · Qué queda para que “Antes de cerrar” respete la preferencia

La llave y el evento ya están definidos en este carril. El carril de la tarjeta debe:

1. Ocultar **solo la tarjeta de sugerencias** cuando:
   ```ts
   localStorage.getItem("mercado-cero:companion:suggestions") === "off"
   ```
   Si la llave no existe, la tarjeta se muestra (default activado).
2. Reaccionar a cambios sin recargar:
   ```ts
   window.addEventListener("mercado-cero:companion-changed", () => {
     // releer la llave o usar event.detail
   });
   ```
   Para otras pestañas, escuchar también `storage`.
3. No usar esta llave para ocultar avisos críticos de dinero, pagos, cobros pendientes ni errores. La tarjeta es acompañamiento; los avisos críticos son otra ruta.
4. Mantener el estado de posponer/descartar de la tarjeta separado de la preferencia global.

En este worktree no existe `closing-checklist.tsx`; por eso el E2E no puede probar el ocultamiento de la tarjeta, solo la llave, el evento y que el aviso crítico de cobros sigue visible. El carril `mercado-cero-cierre-cognitivo` conserva esa tarjeta y debe implementar la lectura.

---

## 5 · Límites

- No se hizo merge. No se tocaron otros worktrees, `:3230`, `:3000` ni la preview.
- El E2E usa `DEMO_MODE=true`, base temporal y un cobro pendiente creado por API; no mueve dinero real.
- “Recordatorios de pendientes” es solo una preferencia: no hay push, correo ni recordatorios automáticos.
- “Explicaciones en contexto” es solo una preferencia: no se añadió un motor de explicaciones ni un chatbot.
- La privacidad de voz se verificó contra el código del proveedor y de la ruta; no se auditó la política de retención de OpenAI.
- La prueba de texto ampliado es automatizada (360 px, texto “Muy grande”). No sustituye una prueba con lector de pantalla real, TalkBack/VoiceOver ni teléfono físico.
- El build muestra el warning preexistente de `Cache-Control` para `/_next/static/:path*`; no se modificó.
- `npm ci` reporta 16 vulnerabilidades moderadas preexistentes; no se aplicó `npm audit fix`.
