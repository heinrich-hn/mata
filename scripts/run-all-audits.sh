#!/bin/bash

# Run audits for all projects
# This script sets up environment variables and runs audits for each project

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="/workspaces/mata"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║     MATA Fleet Management - Full Audit          ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo -e "  Date: $(date)"
echo ""

# Track results
declare -A AUDIT_RESULTS

# Function to run audit for a single app
run_single_audit() {
    local app_name="$1"
    local app_path="$2"
    local src_path="$3"
    
    echo -e "${BOLD}${BLUE}━━━ ${app_name} ━━━${NC}"
    
    # Check if src directory exists
    if [[ ! -d "$src_path" ]]; then
        echo -e "${RED}  ✗ src directory not found at: ${src_path}${NC}"
        AUDIT_RESULTS[$app_name]="SKIP"
        echo ""
        return 1
    fi
    
    # Set environment variables for audit-core
    export APP_NAME="$app_name"
    export PROJECT_ROOT="$app_path"
    export TARGET_DIR="$src_path"
    
    # Source the audit core and run
    source "${SCRIPT_DIR}/audit-core.sh"
    run_full_audit
    
    # Store result
    if [[ $TS_ERROR_COUNT -eq 0 ]] && [[ $ESLINT_ERROR_COUNT -eq 0 ]]; then
        AUDIT_RESULTS[$app_name]="PASS"
    elif [[ $TS_ERROR_COUNT -eq 0 ]]; then
        AUDIT_RESULTS[$app_name]="WARN"
    else
        AUDIT_RESULTS[$app_name]="FAIL"
    fi
    
    echo ""
}

# Run audit for each app
run_single_audit "Dashboard (Main)" "$WORKSPACE_ROOT" "$WORKSPACE_ROOT/src"
run_single_audit "Workshop Mobile" "$WORKSPACE_ROOT/mobile" "$WORKSPACE_ROOT/mobile/src"
run_single_audit "Driver App" "$WORKSPACE_ROOT/drivermobileapp" "$WORKSPACE_ROOT/drivermobileapp/src"
run_single_audit "Load Planner" "$WORKSPACE_ROOT/loadplanner" "$WORKSPACE_ROOT/loadplanner/src"

# Final summary
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  FINAL SUMMARY${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

printf "  %-25s %-10s\n" "App" "Status"
printf "  %-25s %-10s\n" "─────────────────────────" "──────────"

for app in "Dashboard (Main)" "Workshop Mobile" "Driver App" "Load Planner"; do
    status="${AUDIT_RESULTS[$app]:-UNKNOWN}"
    case "$status" in
        PASS) status_display="${GREEN}✅ PASS${NC}" ;;
        WARN) status_display="${YELLOW}⚠️  WARN${NC}" ;;
        FAIL) status_display="${RED}❌ FAIL${NC}" ;;
        SKIP) status_display="${YELLOW}⏭️  SKIP${NC}" ;;
        *)    status_display="${RED}UNKNOWN${NC}" ;;
    esac
    printf "  %-25s %b\n" "$app" "$status_display"
done

echo ""
echo -e "${GREEN}All audits completed!${NC}"
echo -e "Reports are in: ${WORKSPACE_ROOT}/*/typescript-audit-reports/"
echo ""