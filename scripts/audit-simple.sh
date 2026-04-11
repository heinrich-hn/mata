#!/bin/bash

# Simple standalone audit script for all projects

WORKSPACE="/workspaces/mata"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  MATA Fleet Management - TypeScript Audit${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# Function to audit a project
audit_project() {
    local name="$1"
    local dir="$2"
    local src_dir="$3"
    
    echo -e "${BOLD}${BLUE}━━━ ${name} ━━━${NC}"
    
    if [[ ! -d "$src_dir" ]]; then
        echo -e "${RED}  ✗ src directory not found${NC}"
        echo ""
        return
    fi
    
    cd "$dir"
    
    # Create audit directory
    AUDIT_DIR="${dir}/typescript-audit-reports"
    mkdir -p "$AUDIT_DIR"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    
    # TypeScript check
    echo -n "  TypeScript: "
    if [[ -f "tsconfig.json" ]]; then
        if npx tsc --noEmit > "${AUDIT_DIR}/ts_errors_${TIMESTAMP}.txt" 2>&1; then
            echo -e "${GREEN}✓ 0 errors${NC}"
            TS_ERRORS=0
        else
            TS_ERRORS=$(grep -c "error TS" "${AUDIT_DIR}/ts_errors_${TIMESTAMP}.txt" 2>/dev/null || echo "0")
            echo -e "${RED}✗ ${TS_ERRORS} errors${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ no tsconfig.json${NC}"
        TS_ERRORS=0
    fi
    
    # Code quality metrics
    ANY_COUNT=$(grep -r ": any\b" "$src_dir" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    CONSOLE_COUNT=$(grep -r "console\.log" "$src_dir" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    TODO_COUNT=$(grep -r -E "TODO|FIXME" "$src_dir" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    TS_FILES=$(find "$src_dir" -name "*.ts" 2>/dev/null | wc -l)
    TSX_FILES=$(find "$src_dir" -name "*.tsx" 2>/dev/null | wc -l)
    
    echo "  Files:      ${TS_FILES} .ts, ${TSX_FILES} .tsx"
    echo "  any types:  ${ANY_COUNT}"
    echo "  console.log: ${CONSOLE_COUNT}"
    echo "  TODOs:      ${TODO_COUNT}"
    
    # Determine status
    if [[ $TS_ERRORS -eq 0 ]]; then
        echo -e "  Status:     ${GREEN}✓ PASS${NC}"
    else
        echo -e "  Status:     ${RED}✗ FAIL${NC}"
    fi
    
    echo ""
    
    # Return metrics for summary
    echo "${name}|${TS_ERRORS}|${ANY_COUNT}|${CONSOLE_COUNT}|${TODO_COUNT}|${TS_FILES}|${TSX_FILES}"
}

# Run audits and collect results
RESULTS=()

echo -e "${CYAN}Auditing Dashboard...${NC}"
RESULT=$(audit_project "Dashboard" "$WORKSPACE" "$WORKSPACE/src")
RESULTS+=("$RESULT")

echo -e "${CYAN}Auditing Mobile App...${NC}"
RESULT=$(audit_project "Mobile" "$WORKSPACE/mobile" "$WORKSPACE/mobile/src")
RESULTS+=("$RESULT")

echo -e "${CYAN}Auditing Driver App...${NC}"
RESULT=$(audit_project "Driver App" "$WORKSPACE/drivermobileapp" "$WORKSPACE/drivermobileapp/src")
RESULTS+=("$RESULT")

echo -e "${CYAN}Auditing Load Planner...${NC}"
RESULT=$(audit_project "Load Planner" "$WORKSPACE/loadplanner" "$WORKSPACE/loadplanner/src")
RESULTS+=("$RESULT")

# Summary table
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  SUMMARY${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

printf "  %-20s %8s %8s %8s %8s\n" "App" "TS Err" "any" "console" "TODOs"
printf "  %-20s %8s %8s %8s %8s\n" "────────────────────" "──────" "─────" "───────" "─────"

for result in "${RESULTS[@]}"; do
    IFS='|' read -r name ts_err any console todos ts_files tsx_files <<< "$result"
    printf "  %-20s %8s %8s %8s %8s\n" "$name" "$ts_err" "$any" "$console" "$todos"
done

echo ""
echo -e "${GREEN}Audit complete!${NC}"
echo ""