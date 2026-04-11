#!/bin/bash
# Load Planner (loadplanner/src) - TypeScript & Code Quality Audit
APP_NAME="Load Planner"
PROJECT_ROOT="/workspaces/mata/loadplanner"
TARGET_DIR="${PROJECT_ROOT}/src"
source "$(dirname "$0")/../scripts/audit-core.sh"
run_full_audit
