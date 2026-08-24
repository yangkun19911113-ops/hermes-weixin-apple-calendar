#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_SRC="$PROJECT_DIR/hermes/skills/apple-calendar-time-manager"
SKILL_DEST="${HERMES_HOME:-$HOME/.hermes}/skills/apple-calendar-time-manager"

if ! command -v hermes >/dev/null 2>&1; then
  echo "hermes command not found. Install Hermes first:"
  echo "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"
  exit 1
fi

mkdir -p "$(dirname "$SKILL_DEST")"
rm -rf "$SKILL_DEST"
cp -R "$SKILL_SRC" "$SKILL_DEST"

echo "Installed Hermes skill:"
echo "$SKILL_DEST"
echo
echo "Try in Hermes:"
echo "/apple-calendar-time-manager 帮我规划明天的工作，并先给我确认表，不要直接写入日历"
