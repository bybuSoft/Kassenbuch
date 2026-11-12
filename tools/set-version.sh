#!/bin/sh
# Setzt die dritte Stelle der Version (BRANCH_CODE in js/version.js) aus dem aktuellen Git-Branch.
# Branch "claude/festive-cray-4a3xvr" -> "4a3xvr"; "feature/login" -> "login".
# Auf master/main wird nichts geändert (der Code des gemergten Branches bleibt stehen).
set -e
root=$(git rev-parse --show-toplevel)
branch=$(git symbolic-ref --short -q HEAD) || exit 0
case "$branch" in master|main) exit 0 ;; esac
code=${branch##*-}
[ "$code" = "$branch" ] && code=${branch##*/}
code=$(printf '%s' "$code" | tr -c 'A-Za-z0-9' '_')
file="$root/js/version.js"
tmp=$(mktemp)
sed "s/^export const BRANCH_CODE = '.*';/export const BRANCH_CODE = '$code';/" "$file" > "$tmp"
cat "$tmp" > "$file"; rm -f "$tmp"
