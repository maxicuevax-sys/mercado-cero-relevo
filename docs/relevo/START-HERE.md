# START HERE — Diego

Bienvenido a **Mercado Cero / Operación Relevo**. Esto es lo que tienes que instalar y hacer para quedar dentro de la infraestructura, con tu propia identidad y sin tocar producción.

## 1. Acepta las invitaciones
- Código: https://github.com/maxicuevax-sys/mercado-cero-relevo
- Refs/evidencia (LFS): https://github.com/maxicuevax-sys/mercado-cero-refs

No compartas tokens; usa tu cuenta `diegoalva99`.

## 2. Instala base
Windows:
```powershell
winget install Git.Git GitHub.cli OpenJS.NodeJS.LTS Python.Python.3.14 BurntSushi.ripgrep.MSVC jqlang.jq Tailscale.Tailscale
git lfs install
corepack enable
corepack prepare pnpm@latest --activate
npx playwright install chromium
gh auth login
```
macOS/Linux equivalentes con `brew`/`apt`; el prompt de abajo detecta el OS.

También necesitas:
- **DSH Desktop** con tu propio perfil/`DSH_HOME`.
- **OpenCode** con tu propia cuenta/modelo.
- **Docker** opcional.
- **No** necesitas la DB de producción, `.env` real, claves de A/B ni el bridge abierto.

## 3. Clona
```powershell
gh repo clone maxicuevax-sys/mercado-cero-relevo C:\dev\mercado-cero
gh repo clone maxicuevax-sys/mercado-cero-refs C:\dev\mercado-cero-refs
cd C:\dev\mercado-cero
git worktree add C:\dev\mercado-cero-diego\onboarding -b diego/onboarding origin/main
```
Un writer por worktree. No toques 4497; levanta tu propio `next dev -p 4600`.

## 4. Arranca tu agente
Copia el prompt completo:
https://github.com/maxicuevax-sys/mercado-cero-relevo/blob/main/docs/relevo/DIEGO-OPENCODE-ONBOARDING.md

Dile a tu agente:
> Sigue `docs/relevo/DIEGO-OPENCODE-ONBOARDING.md` al pie de la letra. Instala, conecta y entrega `DIEGO-ONBOARDING-REPORT.md`. No merge/push a main; no toques 4497; no compartas secretos. Pausa y pregunta por UAC/accesos que falten.

## 5. Red y accesos
- Tailscale/Headscale: únete a la tailnet con tu dispositivo; el Lead te agrega a la ACL de **solo lectura 4497** y a tu propio 4600.
- HumanLayer: se conecta en staging cuando el Lead lo levante.
- GitHub: trabaja en `diego/<tarea>`, abre PR, nunca merge.

## 6. Verificación mínima
```powershell
cd C:\dev\mercado-cero-diego\onboarding\web
# .env.local con valores DEMO, nunca producción
npm ci
npm run build
npm run dev -- -p 4600
```
- Smoke de las 18 rutas.
- `relevo-ref verify` → 31/31.
- `relevo-attention gate` → PASS.
- Abre PR; no merge.

## 7. Reglas duras
- No secretos/DB/.env reales en Git.
- `demo_paid`; nunca `paid` sin webhook firmado.
- No tocar 4497 ni el bridge abierto.
- Un writer por worktree.
- Ref exacta `DEFINITIVE`; sin “parecido”.

Cualquier bloqueo: issue https://github.com/maxicuevax-sys/mercado-cero-relevo/issues/1 o ping al Lead.
