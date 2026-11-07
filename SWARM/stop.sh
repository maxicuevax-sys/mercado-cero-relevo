#!/usr/bin/env bash
# Detiene los workers del swarm (no borra los worktrees).
set -euo pipefail

echo "▶ Deteniendo workers (codex/claude)..."
taskkill //IM codex.exe //F 2>/dev/null || true
taskkill //IM claude.exe //F 2>/dev/null || true
taskkill //IM opencode-cli.exe //F 2>/dev/null || true
echo "✔ Workers detenidos. Los worktrees quedan en su sitio; bórralos con:"
echo "   git worktree remove <ruta>  (desde el repo principal)"
