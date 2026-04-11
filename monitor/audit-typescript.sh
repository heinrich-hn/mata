#!/bin/bash
# Monitor (monitor/src) - TypeScript & Code Quality Audit
APP_NAME="Monitor"
PROJECT_ROOT="/workspaces/mata/monitor"
TARGET_DIR="${PROJECT_ROOT}/src"
source "$(dirname "$0")/../scripts/audit-core.sh"
run_full_audit
