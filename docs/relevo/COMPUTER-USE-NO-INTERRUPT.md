# COMPUTER USE — NO INTERRUMPIR NAVEGACIÓN

## Regla dura
Computer use **nunca** debe robar foco, mover el cursor real, cambiar de escritorio ni interrumpir una navegación en curso.

### Navegación web
- Usar **Playwright/headless** o `browser_exec` de Hermes.
- **No** usar `computer_use` para navegar páginas, leer web, llenar formularios web ni manejar Chrome/Edge del usuario.
- No usar el perfil real del navegador (`browser.use_real_profile: false`).
- No `adopt_existing_tab`, no pestañas del usuario.

### Apps nativas
- `cua-driver` solo en modo **background**.
- Prohibido `delivery_mode: "foreground"` salvo aprobación explícita por atención (`relevo-attention`).
- Prohibido `launch_app`/`bring_to_front`/`focus_app` sin pedido explícito.
- No hacer clic en ventanas del navegador del usuario.
- Overlay de Hermes: `computer_use.no_overlay: true`.
- Target: ventana explícita, no "desktop" salvo tarea de escritorio autorizada.
- Snapshot antes de cada acción y verificación después.

### Si una acción requiere foreground
1. El agente crea obligación `hard` en `relevo-attention`.
2. No ejecuta; espera respuesta.
3. Si se aprueba, se hace una sola acción foreground y se documenta.
4. Nunca se autoaprueba ni se reintenta en foreground.

### Subagentes
- Todo subagente que use Cua debe leer esta política.
- Si no hay target/ventana explícita, no actúa.
- Si no puede background, no escala solo: reporta `blocked_foreground` y sigue con otra tarea.

### Verificación
- `cua-driver get_desktop_state` solo para evidencia, no para interactuar.
- `hermes computer-use doctor` OK.
- Prueba de no interrupción: navegar en Chrome mientras un agente hace `get_window_state` de otra app; el foco/cursor no debe cambiar.
