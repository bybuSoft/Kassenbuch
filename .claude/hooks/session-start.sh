#!/bin/bash
# Aktiviert die versionierten Git-Hooks (.githooks/), damit der Branch-Code
# in js/version.js bei jedem Commit automatisch gesetzt wird. Idempotent, keine Abhängigkeiten.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"
if git rev-parse --git-dir >/dev/null 2>&1 && [ -d .githooks ]; then
  [ "$(git config --get core.hooksPath || true)" = ".githooks" ] || git config core.hooksPath .githooks
  chmod +x .githooks/* tools/*.sh 2>/dev/null || true
fi
