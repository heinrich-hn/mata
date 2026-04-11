#!/bin/bash
# ================================================
# Reusable Audit Core - Shared by all per-app scripts
# Source this file, then call: run_full_audit
#
# Required env vars (set before sourcing):
#   APP_NAME    - e.g., "Dashboard"
#   PROJECT_ROOT - e.g., "/workspaces/mata"
#   TARGET_DIR   - e.g., "/workspaces/mata/src"
# ================================================

# Ensure PROJECT_ROOT is set
if [ -z "$PROJECT_ROOT" ]; then
    echo "ERROR: PROJECT_ROOT is not set. Please set it before sourcing this script."
    echo "Example: export PROJECT_ROOT=\"/workspaces/mata\""
    exit 1
fi

# Ensure TARGET_DIR is set
if [ -z "$TARGET_DIR" ]; then
    echo "ERROR: TARGET_DIR is not set. Please set it before sourcing this script."
    echo "Example: export TARGET_DIR=\"\${PROJECT_ROOT}/src\""
    exit 1
fi

# Create audit directory with proper path
AUDIT_DIR="${PROJECT_ROOT}/typescript-audit-reports"
mkdir -p "${AUDIT_DIR}"

# Check if we can write to the directory
if [ ! -w "${AUDIT_DIR}" ]; then
    echo "ERROR: Cannot write to ${AUDIT_DIR}"
    exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${AUDIT_DIR}/audit_${APP_NAME}_${TIMESTAMP}.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Result tracking
TS_ERROR_COUNT=0
ESLINT_ERROR_COUNT=0
ESLINT_WARN_COUNT=0
ANY_COUNT=0
TS_IGNORE_COUNT=0
TS_NOCHECK_COUNT=0
TS_EXPECT_COUNT=0
CONSOLE_LOG_COUNT=0
CONSOLE_ERROR_COUNT=0
CONSOLE_WARN_COUNT=0
DEBUGGER_COUNT=0
TODO_COUNT=0

log() { 
    echo -e "$1" | tee -a "${LOG_FILE}"
}

# ──────────────────────────────────────────────────────────────
# [1] TypeScript Compiler Check
# ──────────────────────────────────────────────────────────────
run_ts_checks() {
    log "${BLUE}[1/5] TypeScript Compiler Check${NC}"
    local errors_file="${AUDIT_DIR}/type_errors_${APP_NAME}_${TIMESTAMP}.txt"

    cd "${PROJECT_ROOT}" || return 1

    # Check if tsconfig exists
    if [ ! -f "tsconfig.json" ]; then
        log "  ${YELLOW}⚠ No tsconfig.json found, skipping TypeScript check${NC}"
        TS_ERROR_COUNT=0
        echo "No tsconfig.json found" > "$errors_file"
        echo ""
        return
    fi

    local tsc_output
    tsc_output=$(npx tsc --noEmit 2>&1)
    local exit_code=$?

    echo "$tsc_output" > "$errors_file"

    if [[ $exit_code -eq 0 ]]; then
        log "  ${GREEN}✓ No TypeScript errors${NC}"
        TS_ERROR_COUNT=0
    else
        TS_ERROR_COUNT=$(echo "$tsc_output" | grep -c "error TS" 2>/dev/null || echo "0")
        log "  ${RED}✗ ${TS_ERROR_COUNT} TypeScript error(s)${NC}"
        echo "$tsc_output" | grep "error TS" | head -10 | while IFS= read -r line; do
            log "    ${RED}${line}${NC}"
        done
        if [[ $TS_ERROR_COUNT -gt 10 ]]; then
            log "    ${YELLOW}... and $((TS_ERROR_COUNT - 10)) more (see ${errors_file})${NC}"
        fi
    fi
    echo ""
}

# ──────────────────────────────────────────────────────────────
# [2] ESLint Check
# ──────────────────────────────────────────────────────────────
run_eslint_checks() {
    log "${BLUE}[2/5] ESLint Check${NC}"
    local eslint_file="${AUDIT_DIR}/eslint_report_${APP_NAME}_${TIMESTAMP}.txt"

    cd "${PROJECT_ROOT}" || return 1

    # Check for ESLint config in this dir or any parent
    local has_config=false
    local check_dir="${PROJECT_ROOT}"
    while [[ "$check_dir" != "/" ]]; do
        for cfg in eslint.config.js eslint.config.mjs .eslintrc.js .eslintrc.cjs .eslintrc.json .eslintrc.yaml .eslintrc.yml .eslintrc; do
            [[ -f "${check_dir}/${cfg}" ]] && has_config=true && break 2
        done
        check_dir=$(dirname "$check_dir")
    done

    if [[ "$has_config" == "false" ]]; then
        log "  ${YELLOW}– No ESLint config found, skipping${NC}"
        echo "No ESLint config found" > "$eslint_file"
        echo ""
        return
    fi

    # Check if src directory exists
    if [ ! -d "src" ]; then
        log "  ${YELLOW}– No src directory found, skipping ESLint${NC}"
        echo "No src directory" > "$eslint_file"
        echo ""
        return
    fi

    local eslint_output
    eslint_output=$(npx eslint src/ --ext .ts,.tsx 2>&1)
    local exit_code=$?
    echo "$eslint_output" > "$eslint_file"

    if [[ $exit_code -eq 0 ]]; then
        log "  ${GREEN}✓ No ESLint issues${NC}"
    else
        # Parse error and warning counts
        ESLINT_ERROR_COUNT=$(echo "$eslint_output" | grep -oE '[0-9]+ error' | grep -oE '[0-9]+' | tail -1 || echo "0")
        ESLINT_WARN_COUNT=$(echo "$eslint_output" | grep -oE '[0-9]+ warning' | grep -oE '[0-9]+' | tail -1 || echo "0")
        [[ -z "$ESLINT_ERROR_COUNT" ]] && ESLINT_ERROR_COUNT=0
        [[ -z "$ESLINT_WARN_COUNT" ]] && ESLINT_WARN_COUNT=0

        if [[ $ESLINT_ERROR_COUNT -gt 0 ]]; then
            log "  ${RED}✗ ${ESLINT_ERROR_COUNT} error(s), ${ESLINT_WARN_COUNT} warning(s)${NC}"
        else
            log "  ${YELLOW}⚠ ${ESLINT_WARN_COUNT} warning(s)${NC}"
        fi

        # Show top issues
        echo "$eslint_output" | grep -E "error|warning" | head -5 | while IFS= read -r line; do
            log "    ${line}"
        done
    fi
    echo ""
}

# ──────────────────────────────────────────────────────────────
# [3] Code Quality Metrics
# ──────────────────────────────────────────────────────────────
check_code_quality() {
    log "${BLUE}[3/5] Code Quality Metrics${NC}"
    local details_file="${AUDIT_DIR}/quality_details_${APP_NAME}_${TIMESTAMP}.txt"

    if [ ! -d "${TARGET_DIR}" ]; then
        log "  ${YELLOW}⚠ Target directory not found: ${TARGET_DIR}${NC}"
        echo ""
        return
    fi

    ANY_COUNT=$(grep -rn ": any\b\|as any\b" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    TS_IGNORE_COUNT=$(grep -rn "@ts-ignore" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    TS_NOCHECK_COUNT=$(grep -rn "@ts-nocheck" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    TS_EXPECT_COUNT=$(grep -rn "@ts-expect-error" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    CONSOLE_LOG_COUNT=$(grep -rn "console\.log" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    CONSOLE_ERROR_COUNT=$(grep -rn "console\.error" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    CONSOLE_WARN_COUNT=$(grep -rn "console\.warn" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    DEBUGGER_COUNT=$(grep -rn "debugger;" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    TODO_COUNT=$(grep -rn -E "TODO|FIXME|HACK|XXX" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)

    {
        echo "=== ${APP_NAME} Code Quality Details ==="
        echo "Generated: $(date)"
        echo "Target: ${TARGET_DIR}"
        echo ""
        echo "--- any types (${ANY_COUNT}) ---"
        grep -rn ": any\b\|as any\b" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | head -20
        echo ""
        echo "--- @ts-ignore (${TS_IGNORE_COUNT}) ---"
        grep -rn "@ts-ignore" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | head -20
        echo ""
        echo "--- @ts-nocheck (${TS_NOCHECK_COUNT}) ---"
        grep -rn "@ts-nocheck" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null
        echo ""
        echo "--- TODO/FIXME (${TODO_COUNT}) ---"
        grep -rn -E "TODO|FIXME|HACK|XXX" "${TARGET_DIR}" --include="*.ts" --include="*.tsx" 2>/dev/null | head -20
    } > "$details_file"

    log "  any types:       ${ANY_COUNT}"
    log "  @ts-ignore:      ${TS_IGNORE_COUNT}"
    log "  @ts-nocheck:     ${TS_NOCHECK_COUNT}"
    log "  @ts-expect-error: ${TS_EXPECT_COUNT}"
    log "  console.log:     ${CONSOLE_LOG_COUNT}"
    log "  console.error:   ${CONSOLE_ERROR_COUNT}"
    log "  console.warn:    ${CONSOLE_WARN_COUNT}"
    
    if [[ $DEBUGGER_COUNT -gt 0 ]]; then
        log "  ${RED}debugger:      ${DEBUGGER_COUNT}${NC}"
    else
        log "  debugger:       ${DEBUGGER_COUNT}"
    fi
    
    log "  TODO/FIXME:      ${TODO_COUNT}"
    echo ""
}

# ──────────────────────────────────────────────────────────────
# [4] Security Scan
# ──────────────────────────────────────────────────────────────
run_security_scan() {
    log "${BLUE}[4/5] Security Scan${NC}"

    if [ ! -d "${TARGET_DIR}" ]; then
        log "  ${YELLOW}⚠ Target directory not found, skipping security scan${NC}"
        echo ""
        return
    fi

    # Hardcoded secrets (rough heuristic - skip imports, comments, type definitions)
    local suspicious=$(grep -rn "password\|secret\|api_key\|apikey\|private_key" "${TARGET_DIR}" \
        --include="*.ts" --include="*.tsx" 2>/dev/null \
        | grep -v "import\|//\|interface\|type \|\.env\|process\.env\|import\.meta" \
        | grep -v "password.*:" \
        | grep -v "PasswordInput\|passwordRegex\|passwordSchema" \
        | wc -l)

    if [[ $suspicious -gt 0 ]]; then
        log "  ${YELLOW}⚠ ${suspicious} lines with potential secret patterns (review manually)${NC}"
    else
        log "  ${GREEN}✓ No obvious hardcoded secrets${NC}"
    fi

    # Check for dangerouslySetInnerHTML
    local dangerous_html=$(grep -rn "dangerouslySetInnerHTML" "${TARGET_DIR}" --include="*.tsx" 2>/dev/null | wc -l)
    if [[ $dangerous_html -gt 0 ]]; then
        log "  ${YELLOW}⚠ ${dangerous_html} dangerouslySetInnerHTML usage(s)${NC}"
    else
        log "  ${GREEN}✓ No dangerouslySetInnerHTML usage${NC}"
    fi

    echo ""
}

# ──────────────────────────────────────────────────────────────
# [5] Summary Report
# ──────────────────────────────────────────────────────────────
generate_summary() {
    log "${BLUE}[5/5] Generating Summary${NC}"

    local summary_file="${AUDIT_DIR}/summary_${APP_NAME}_${TIMESTAMP}.md"
    
    local ts_files=0
    local tsx_files=0
    
    if [ -d "${TARGET_DIR}" ]; then
        ts_files=$(find "${TARGET_DIR}" -type f -name "*.ts" 2>/dev/null | wc -l)
        tsx_files=$(find "${TARGET_DIR}" -type f -name "*.tsx" 2>/dev/null | wc -l)
    fi
    
    local total=$((ts_files + tsx_files))

    cat > "${summary_file}" << EOF
# ${APP_NAME} - TypeScript & Code Quality Audit
**Date:** $(date)
**Target:** ${TARGET_DIR}
**Audit ID:** ${TIMESTAMP}

## File Statistics
| Category | Count |
|----------|-------|
| .ts files | ${ts_files} |
| .tsx files | ${tsx_files} |
| **Total** | **${total}** |

## Issues
| Check | Count | Status |
|-------|-------|--------|
| TypeScript Errors | ${TS_ERROR_COUNT} | $([ ${TS_ERROR_COUNT} -eq 0 ] && echo "✅" || echo "❌") |
| ESLint Errors | ${ESLINT_ERROR_COUNT} | $([ ${ESLINT_ERROR_COUNT} -eq 0 ] && echo "✅" || echo "❌") |
| ESLint Warnings | ${ESLINT_WARN_COUNT} | $([ ${ESLINT_WARN_COUNT} -eq 0 ] && echo "✅" || echo "⚠️") |

## Code Quality
| Metric | Count |
|--------|-------|
| \`any\` types | ${ANY_COUNT} |
| \`@ts-ignore\` | ${TS_IGNORE_COUNT} |
| \`@ts-nocheck\` | ${TS_NOCHECK_COUNT} |
| \`@ts-expect-error\` | ${TS_EXPECT_COUNT} |
| \`console.log\` | ${CONSOLE_LOG_COUNT} |
| \`console.error\` | ${CONSOLE_ERROR_COUNT} |
| \`console.warn\` | ${CONSOLE_WARN_COUNT} |
| \`debugger;\` | ${DEBUGGER_COUNT} |
| TODO/FIXME/HACK | ${TODO_COUNT} |

## Reports
- Type errors: \`type_errors_${APP_NAME}_${TIMESTAMP}.txt\`
- ESLint report: \`eslint_report_${APP_NAME}_${TIMESTAMP}.txt\`
- Quality details: \`quality_details_${APP_NAME}_${TIMESTAMP}.txt\`
EOF

    log "  ${GREEN}✓ Summary: ${summary_file}${NC}"
    echo ""
}

# ──────────────────────────────────────────────────────────────
# Main entry point
# ──────────────────────────────────────────────────────────────
run_full_audit() {
    # Validate required variables
    if [ -z "$APP_NAME" ]; then
        echo "ERROR: APP_NAME is not set"
        return 1
    fi
    
    if [ -z "$PROJECT_ROOT" ]; then
        echo "ERROR: PROJECT_ROOT is not set"
        return 1
    fi
    
    if [ -z "$TARGET_DIR" ]; then
        echo "ERROR: TARGET_DIR is not set"
        return 1
    fi
    
    echo ""
    log "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
    log "${BOLD}  ${APP_NAME} - TypeScript & Code Quality Audit${NC}"
    log "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
    log "  Date:   $(date)"
    log "  Target: ${TARGET_DIR}"
    log "  Output: ${AUDIT_DIR}"
    echo ""

    run_ts_checks
    run_eslint_checks
    check_code_quality
    run_security_scan
    generate_summary

    log "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
    if [[ $TS_ERROR_COUNT -eq 0 ]] && [[ $ESLINT_ERROR_COUNT -eq 0 ]]; then
        log "${BOLD}  ${GREEN}✅ AUDIT PASSED${NC} — ${APP_NAME}"
    elif [[ $TS_ERROR_COUNT -eq 0 ]]; then
        log "${BOLD}  ${YELLOW}⚠️  AUDIT WARNINGS${NC} — ${APP_NAME}"
    else
        log "${BOLD}  ${RED}❌ AUDIT FAILED${NC} — ${APP_NAME}"
    fi
    log "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
    log "  TS Errors: ${TS_ERROR_COUNT} | ESLint: ${ESLINT_ERROR_COUNT}e/${ESLINT_WARN_COUNT}w | any: ${ANY_COUNT}"
    log "  Reports:   ${AUDIT_DIR}/"
    echo ""
}