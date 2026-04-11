#!/bin/bash
# Driver App (drivermobileapp/src) - TypeScript & Code Quality Audit
APP_NAME="Driver App"
PROJECT_ROOT="/workspaces/mata/drivermobileapp"
TARGET_DIR="${PROJECT_ROOT}/src"
source "$(dirname "$0")/../scripts/audit-core.sh"
run_full_audit
