#!/bin/bash
# Workshop Mobile (mobile/src) - TypeScript & Code Quality Audit
APP_NAME="Workshop Mobile"
PROJECT_ROOT="/workspaces/mata/mobile"
TARGET_DIR="${PROJECT_ROOT}/src"
source "$(dirname "$0")/../scripts/audit-core.sh"
run_full_audit
