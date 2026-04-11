#!/bin/bash
# ================================================
# MATA Fleet Management - Full Monorepo Audit
# Runs TypeScript + Code Quality audits for all 5 apps
# ================================================

set -euo pipefail

WORKSPACE="/workspaces/mata"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Track overall results
declare -A APP_TS_ERRORS
declare -A APP_ESLINT_ISSUES
declare -A APP_ANY_COUNT
declare -A APP_STATUS
declare -A APP_CONSOLE_COUNT
declare -A APP_TODO_COUNT

# Define apps with their correct paths
APPS=("dashboard" "mobile" "drivermobileapp" "loadplanner")
APP_DIRS=("$WORKSPACE" "$WORKSPACE/mobile" "$WORKSPACE/drivermobileapp" "$WORKSPACE/loadplanner")
APP_LABELS=("Dashboard (Main)" "Workshop Mobile" "Driver App" "Load Planner")

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║     MATA Fleet Management - Monorepo Audit       ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo -e "  Date: $(date)"
echo ""

run_app_audit() {
    local app_name="$1"
    local project_dir="$2"
    local label="$3"
    local src_dir="${project_dir}/src"

    echo -e "${BOLD}${BLUE}━━━ ${label} ━━━${NC}"

    if [[ ! -d "$src_dir" ]]; then
        echo -e "${RED}  ✗ src/ directory not found at: ${src_dir}${NC}"
        APP_STATUS[$app_name]="SKIP"
        APP_TS_ERRORS[$app_name]="-"
        APP_ESLINT_ISSUES[$app_name]="-"
        APP_ANY_COUNT[$app_name]="-"
        echo ""
        return
    fi

    # --- TypeScript Check ---
    local ts_errors=0
    cd "$project_dir"
    
    # Check if tsconfig exists
    if [[ ! -f "tsconfig.json" ]]; then
        echo -e "  ${YELLOW}⚠${NC} TypeScript: ${YELLOW}no tsconfig.json (skipped)${NC}"
        ts_errors=0
    else
        local tsc_output
        if tsc_output=$(npx tsc --noEmit 2>&1); then
            echo -e "  ${GREEN}✓${NC} TypeScript: ${GREEN}0 errors${NC}"
        else
            ts_errors=$(echo "$tsc_output" | grep -c "error TS" 2>/dev/null || echo "0")
            echo -e "  ${RED}✗${NC} TypeScript: ${RED}${ts_errors} error(s)${NC}"
            # Show first 3 errors
            echo "$tsc_output" | grep "error TS" | head -3 | while IFS= read -r line; do
                # Extract just the error message without the full path
                local short_line=$(echo "$line" | sed 's|/workspaces/mata/[^/]*/||g')
                echo -e "    ${RED}${short_line}${NC}"
            done
            if [[ $ts_errors -gt 3 ]]; then
                echo -e "    ${YELLOW}... and $((ts_errors - 3)) more${NC}"
            fi
        fi
    fi
    APP_TS_ERRORS[$app_name]=$ts_errors

    # --- ESLint Check ---
    local eslint_errors=0
    local eslint_warns=0
    if [[ -f "${project_dir}/eslint.config.js" ]] || [[ -f "${project_dir}/.eslintrc.js" ]] || [[ -f "${project_dir}/.eslintrc.cjs" ]] || [[ -f "${project_dir}/.eslintrc.json" ]]; then
        # Check if src directory has files to lint
        if [[ -d "src" ]] && [[ -n "$(find src -name "*.ts" -o -name "*.tsx" 2>/dev/null | head -1)" ]]; then
            local eslint_output
            if eslint_output=$(npx eslint src/ --ext .ts,.tsx 2>&1); then
                echo -e "  ${GREEN}✓${NC} ESLint:     ${GREEN}0 issues${NC}"
            else
                # Count actual problems
                eslint_errors=$(echo "$eslint_output" | grep -oE '[0-9]+ error' | tail -1 | grep -oE '[0-9]+' || echo "0")
                eslint_warns=$(echo "$eslint_output" | grep -oE '[0-9]+ warning' | tail -1 | grep -oE '[0-9]+' || echo "0")
                [[ -z "$eslint_errors" ]] && eslint_errors=0
                [[ -z "$eslint_warns" ]] && eslint_warns=0
                
                if [[ $eslint_errors -gt 0 ]]; then
                    echo -e "  ${RED}✗${NC} ESLint:     ${RED}${eslint_errors} error(s)${NC}, ${YELLOW}${eslint_warns} warning(s)${NC}"
                else
                    echo -e "  ${YELLOW}⚠${NC} ESLint:     ${YELLOW}${eslint_warns} warning(s)${NC}"
                fi
            fi
        else
            echo -e "  ${YELLOW}–${NC} ESLint:     ${YELLOW}no TypeScript files to lint${NC}"
        fi
    else
        echo -e "  ${YELLOW}–${NC} ESLint:     ${YELLOW}no config (skipped)${NC}"
    fi
    APP_ESLINT_ISSUES[$app_name]=$eslint_errors

    # --- Code Quality Metrics ---
    local any_count=0
    local ts_ignore=0
    local ts_nocheck=0
    local console_log=0
    local console_error=0
    local console_warn=0
    local todo_count=0
    local debugger_count=0
    local ts_files=0
    local tsx_files=0
    
    if [[ -d "$src_dir" ]]; then
        any_count=$(grep -r ": any\b\|as any\b" "$src_dir" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "eslint-disable" | wc -l)
        ts_ignore=$(grep -r "@ts-ignore" "$src_dir" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        ts_nocheck=$(grep -r "@ts-nocheck" "$src_dir" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        console_log=$(grep -r "console\.log" "$src_dir" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        console_error=$(grep -r "console\.error" "$src_dir" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        console_warn=$(grep -r "console\.warn" "$src_dir" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        todo_count=$(grep -r -E "TODO|FIXME|HACK|XXX" "$src_dir" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        debugger_count=$(grep -r "debugger;" "$src_dir" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        ts_files=$(find "$src_dir" -type f -name "*.ts" 2>/dev/null | wc -l)
        tsx_files=$(find "$src_dir" -type f -name "*.tsx" 2>/dev/null | wc -l)
    fi

    APP_ANY_COUNT[$app_name]=$any_count
    APP_CONSOLE_COUNT[$app_name]=$console_log
    APP_TODO_COUNT[$app_name]=$todo_count

    echo -e "  ${CYAN}📊${NC} Files:      ${ts_files} .ts, ${tsx_files} .tsx"
    echo -e "  ${CYAN}📊${NC} any types:  ${any_count}"
    
    if [[ $ts_ignore -gt 0 ]]; then
        echo -e "  ${YELLOW}⚠${NC} @ts-ignore: ${ts_ignore}"
    fi
    if [[ $ts_nocheck -gt 0 ]]; then
        echo -e "  ${YELLOW}⚠${NC} @ts-nocheck: ${ts_nocheck}"
    fi
    if [[ $debugger_count -gt 0 ]]; then
        echo -e "  ${RED}✗${NC} debugger:   ${debugger_count}"
    fi
    
    echo -e "  ${CYAN}📊${NC} console:    log:${console_log} error:${console_error} warn:${console_warn}"
    echo -e "  ${CYAN}📊${NC} TODOs:      ${todo_count}"

    # Determine status
    if [[ $ts_errors -eq 0 ]] && [[ $eslint_errors -eq 0 ]]; then
        APP_STATUS[$app_name]="PASS"
    elif [[ $ts_errors -eq 0 ]]; then
        APP_STATUS[$app_name]="WARN"
    else
        APP_STATUS[$app_name]="FAIL"
    fi

    echo ""
}

# Run each app
for i in "${!APPS[@]}"; do
    run_app_audit "${APPS[$i]}" "${APP_DIRS[$i]}" "${APP_LABELS[$i]}"
done

# --- Summary Table ---
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║                                    SUMMARY                                    ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

printf "  %-22s %-8s %-10s %-8s %-8s %-8s %-8s\n" "App" "TS Err" "ESLint" "any" "console" "TODOs" "Status"
printf "  %-22s %-8s %-10s %-8s %-8s %-8s %-8s\n" "──────────────────────" "──────" "──────────" "──────" "───────" "─────" "──────"

for i in "${!APPS[@]}"; do
    local_name="${APPS[$i]}"
    local_label="${APP_LABELS[$i]}"
    ts_e="${APP_TS_ERRORS[$local_name]:-0}"
    es_e="${APP_ESLINT_ISSUES[$local_name]:-0}"
    any_c="${APP_ANY_COUNT[$local_name]:-0}"
    console_c="${APP_CONSOLE_COUNT[$local_name]:-0}"
    todo_c="${APP_TODO_COUNT[$local_name]:-0}"
    status="${APP_STATUS[$local_name]:-SKIP}"

    case "$status" in
        PASS) status_display="${GREEN}✅ PASS${NC}" ;;
        WARN) status_display="${YELLOW}⚠️  WARN${NC}" ;;
        FAIL) status_display="${RED}❌ FAIL${NC}" ;;
        SKIP) status_display="${YELLOW}⏭️  SKIP${NC}" ;;
        *)    status_display="${YELLOW}– UNK${NC}" ;;
    esac

    # Colorize numbers
    ts_color=""
    if [[ "$ts_e" -eq 0 ]]; then ts_color="${GREEN}"; else ts_color="${RED}"; fi
    
    es_color=""
    if [[ "$es_e" -eq 0 ]]; then es_color="${GREEN}"; else es_color="${RED}"; fi
    
    any_color=""
    if [[ "$any_c" -eq 0 ]]; then any_color="${GREEN}"; else any_color="${YELLOW}"; fi

    printf "  %-22s " "${APP_LABELS[$i]}"
    echo -ne "${ts_color}%6s${NC}   " "$ts_e"
    echo -ne "${es_color}%8s${NC}   " "$es_e"
    echo -ne "${any_color}%6s${NC}   " "$any_c"
    echo -ne "${CYAN}%7s${NC}   " "$console_c"
    echo -ne "${CYAN}%5s${NC}   " "$todo_c"
    echo -e "$status_display"
done

echo ""
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════════════════════${NC}"

# Calculate overall statistics
total_ts_errors=0
total_any=0
total_console=0
pass_count=0
warn_count=0
fail_count=0

for i in "${!APPS[@]}"; do
    local_name="${APPS[$i]}"
    total_ts_errors=$((total_ts_errors + ${APP_TS_ERRORS[$local_name]:-0}))
    total_any=$((total_any + ${APP_ANY_COUNT[$local_name]:-0}))
    total_console=$((total_console + ${APP_CONSOLE_COUNT[$local_name]:-0}))
    
    case "${APP_STATUS[$local_name]:-SKIP}" in
        PASS) ((pass_count++)) ;;
        WARN) ((warn_count++)) ;;
        FAIL) ((fail_count++)) ;;
    esac
done

echo ""
echo -e "${BOLD}Overall Statistics:${NC}"
echo -e "  ${CYAN}📊${NC} Total TypeScript errors: ${total_ts_errors}"
echo -e "  ${CYAN}📊${NC} Total 'any' types:       ${total_any}"
echo -e "  ${CYAN}📊${NC} Total console.logs:      ${total_console}"
echo ""
echo -e "  ${GREEN}✅ PASS: ${pass_count}${NC}  ${YELLOW}⚠️  WARN: ${warn_count}${NC}  ${RED}❌ FAIL: ${fail_count}${NC}"
echo ""

# Recommendations
echo -e "${BOLD}Recommendations:${NC}"
if [[ $total_ts_errors -gt 0 ]]; then
    echo -e "  ${RED}🔴 Fix ${total_ts_errors} TypeScript error(s) across all apps${NC}"
fi
if [[ $total_any -gt 0 ]]; then
    echo -e "  ${YELLOW}🟡 Replace ${total_any} 'any' type(s) with proper types${NC}"
fi
if [[ $total_console -gt 0 ]]; then
    echo -e "  ${YELLOW}🟡 Remove ${total_console} console.log statement(s) or use a logger${NC}"
fi

if [[ $total_ts_errors -eq 0 ]] && [[ $total_any -eq 0 ]] && [[ $total_console -eq 0 ]]; then
    echo -e "  ${GREEN}🎉 Perfect! No issues found across all applications!${NC}"
fi

echo ""
echo -e "${BOLD}Audit completed at: $(date)${NC}"
echo ""

# Create a summary report file
REPORT_DIR="${WORKSPACE}/audit-reports"
mkdir -p "${REPORT_DIR}"
REPORT_FILE="${REPORT_DIR}/audit-summary-$(date +%Y%m%d_%H%M%S).md"

cat > "$REPORT_FILE" << EOF
# MATA Fleet Management - Monorepo Audit Summary

**Date:** $(date)
**Generated by:** audit-all.sh

## Quick Overview

| App | TS Errors | ESLint Errors | 'any' Types | console.log | TODOs | Status |
|-----|-----------|---------------|-------------|-------------|-------|--------|
EOF

for i in "${!APPS[@]}"; do
    local_name="${APPS[$i]}"
    cat >> "$REPORT_FILE" << EOF
| ${APP_LABELS[$i]} | ${APP_TS_ERRORS[$local_name]:-0} | ${APP_ESLINT_ISSUES[$local_name]:-0} | ${APP_ANY_COUNT[$local_name]:-0} | ${APP_CONSOLE_COUNT[$local_name]:-0} | ${APP_TODO_COUNT[$local_name]:-0} | ${APP_STATUS[$local_name]:-SKIP} |
EOF
done

cat >> "$REPORT_FILE" << EOF

## Overall Statistics

- **Total TypeScript Errors:** ${total_ts_errors}
- **Total 'any' Types:** ${total_any}
- **Total console.logs:** ${total_console}
- **Passing Apps:** ${pass_count}
- **Warnings:** ${warn_count}
- **Failing:** ${fail_count}

## Audit completed at: $(date)
EOF

echo -e "  ${GREEN}📄 Summary report saved to: ${REPORT_FILE}${NC}"
echo ""