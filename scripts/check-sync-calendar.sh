#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
swift "$PROJECT_DIR/scripts/list-eventkit-calendars.swift"
