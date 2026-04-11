#!/bin/bash
# Dashboard (src/) - TypeScript & Code Quality Audit
APP_NAME="Dashboard"
PROJECT_ROOT="/workspaces/mata"
TARGET_DIR="${PROJECT_ROOT}/src"
source "$(dirname "$0")/scripts/audit-core.sh"
run_full_audit
