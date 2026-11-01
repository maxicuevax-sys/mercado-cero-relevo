#!/usr/bin/env bash
# Swarm Mercado Cero — crea worktrees y lanza workers por carril.
# Uso: bash SWARM/fire.sh [--yolo]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v git  >/dev/null || { echo "✗ git no está en PATH";   exit 1; }
command -v codex >/dev/null || { echo "✗ codex no está en PATH"; exit 1; }

BASE="$(git rev-parse --abbrev-ref HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠ Cambios sin commitear en '$BASE' (no se tocan; los worktrees salen limpios)."
fi

# Preflight: los worktrees se ramifican del HEAD commiteado. Si AGENTS.md o SWARM/
# no están commiteados, los workers NO los heredarán (corren sin instrucciones ni convención).
if [ -z "$(git ls-files AGENTS.md)" ] || [ -z "$(git ls-files SWARM/)" ]; then
  echo "⚠ AGENTS.md y/o SWARM/ no están commiteados → los worktrees NO los heredarán."
  echo "  Recomendado: git add AGENTS.md SWARM/ && git commit -m 'chore(swarm): harness + AGENTS.md'"
fi

# Modo de aprobación/sandbox (flags reales de codex-cli 0.159.x)
if [ "${1:-}" = "--yolo" ]; then
  MODE=(--dangerously-bypass-approvals-and-sandbox)
  echo "▶ Modo: sin sandbox ni aprobaciones (peligroso)"
else
  MODE=(--sandbox workspace-write --approve-for-me)
  echo "▶ Modo: workspace-write + auto-aprobación (seguro)"
fi

# Tope por lane para que NADA quede colgado: se mata a los N segundos.
TIMEOUT="${SWARM_TIMEOUT:-1800}"   # 30 min por defecto

# nombre | ruta_relativa | rama | prompt
lanes=(
  "ui|../mercado-cero-ui|swarm/ui|web/src: pulido UI/acc o responsive, sin romper el diseno 'Mostrador claro'. Revisa contraste y botones grandes. Commit al terminar."
  "api|../mercado-cero-api|swarm/api|web/src/app/api: audita webhook, maquina de estados, fiado y corte contra README seccion 4 (seguridad minima). Corrige gaps. No toques secretos. Commit al terminar."
  "payments|../mercado-cero-payments|swarm/payments|Integracion pey y anti-fraude: revisa el flujo 'Verificar comprobante' y scripts/reconcile.mjs. No toques secretos. Commit al terminar."
)

mkdir -p "$ROOT/SWARM/logs"

for lane in "${lanes[@]}"; do
  IFS='|' read -r name path branch prompt <<< "$lane"
  wt="$ROOT/$path"
  [ -d "$wt/.git" ] || git worktree add -b "$branch" "$wt" "$BASE"
  echo "▶ Lane $name → $branch (codex, timeout ${TIMEOUT}s) · log: SWARM/logs/$name.log"
  ( cd "$wt" && timeout "$TIMEOUT" codex exec "${MODE[@]}" "$prompt Al terminar, escribe $name-report.md en la raiz del worktree: cambios, verificacion corrida y su resultado, y pendientes. No hagas merge." 2>&1 | tee "$ROOT/SWARM/logs/$name.log" ) &
done

wait
echo "✔ Swarm terminado. Revisa los diffs de cada worktree y pide merge al orquestador."
