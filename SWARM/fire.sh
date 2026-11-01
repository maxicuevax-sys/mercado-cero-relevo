#!/usr/bin/env bash
# Swarm Mercado Cero — crea worktrees y lanza workers por carril.
# Uso: bash SWARM/fire.sh [--yolo]
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# git es binario nativo de Windows: no entiende rutas MSYS (/c/...). Le pasamos C:/...
ROOT_WIN="$(pwd -W 2>/dev/null || echo "$ROOT")"

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
  # --approve-for-me YA implica sandbox workspace-write; no se puede combinar con -s.
  MODE=(--approve-for-me)
  echo "▶ Modo: workspace-write + revisión automática (seguro)"
fi

# Tope por lane para que NADA quede colgado: se mata a los N segundos.
TIMEOUT="${SWARM_TIMEOUT:-1800}"   # 30 min por defecto

# nombre | ruta_relativa | rama | prompt
lanes=(
  "ui|../mercado-cero-ui|swarm/ui|web/src: pulido UI/acc o responsive, sin romper el diseno 'Mostrador claro'. Revisa contraste y botones grandes. Commit al terminar."
  "api|../mercado-cero-api|swarm/api|web/src/app/api: audita webhook, maquina de estados, fiado y corte contra README seccion 4 (seguridad minima). Corrige gaps. No toques secretos. Commit al terminar."
  "payments|../mercado-cero-payments|swarm/payments|Integracion pey y anti-fraude: revisa el flujo 'Verificar comprobante' y scripts/reconcile.mjs. No toques secretos. Commit al terminar."
  "canary|../mercado-cero-canary|swarm/canary|Crea el archivo SWARM/CANARY.md con una linea 'canary ok <fecha UTC>' y haz commit. No toques ningun otro archivo."
)

# Filtro opcional: SWARM_LANES="ui,api" (por defecto los tres carriles reales, sin canary)
selected="${SWARM_LANES:-ui,api,payments}"
picked=()
for lane in "${lanes[@]}"; do
  name="${lane%%|*}"
  case ",$selected," in
    *",$name,"*) picked+=("$lane") ;;
  esac
done
[ ${#picked[@]} -gt 0 ] || { echo "✗ SWARM_LANES='$selected' no coincide con ningún carril"; exit 1; }
lanes=("${picked[@]}")

mkdir -p "$ROOT/SWARM/logs"

pids=()
names=()
for lane in "${lanes[@]}"; do
  IFS='|' read -r name path branch prompt <<< "$lane"
  wt="$ROOT/$path"
  # en un worktree, .git es un ARCHIVO (no un directorio): usar -e, no -d
  if [ ! -e "$wt/.git" ]; then
    git worktree add -b "$branch" "$ROOT_WIN/$path" "$BASE" 2>/dev/null \
      || git worktree add "$ROOT_WIN/$path" "$branch" \
      || { echo "✗ no pude crear el worktree $wt"; continue; }
  fi
  echo "▶ Lane $name → $branch (codex, timeout ${TIMEOUT}s) · log: SWARM/logs/$name.log"
  ( cd "$wt" && timeout "$TIMEOUT" codex exec "${MODE[@]}" -o "$ROOT_WIN/SWARM/logs/$name-last.md" "$prompt Al terminar, escribe $name-report.md en la raiz del worktree: cambios, verificacion corrida y su resultado, y pendientes. No hagas merge." 2>&1 | tee "$ROOT/SWARM/logs/$name.log" ) &
  pids+=($!)
  names+=("$name")
done

fail=0
for i in "${!pids[@]}"; do
  wait "${pids[$i]}"; rc=$?
  case "$rc" in
    0)   echo "✅ ${names[$i]} terminó OK" ;;
    124) echo "⏱ ${names[$i]} agotó ${TIMEOUT}s"; fail=1 ;;
    *)   echo "❌ ${names[$i]} salió con código $rc"; fail=1 ;;
  esac
done

echo "✔ Swarm terminado. Revisa los diffs de cada worktree y pide merge al orquestador."
[ "$fail" = "0" ] || exit 1
