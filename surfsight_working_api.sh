#!/bin/bash

# Surfsight API - Working Endpoints Script
# Based on successful manual testing
# Environment: Europe (DE) - https://api.de.surfsight.net/v2/

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# CONFIGURATION
# ============================================================================

API_BASE="https://api.de.surfsight.net"
API_VERSION="v2"
EMAIL="heinrich@matanuska.co.za"
PASSWORD="0824656647@Hj"
ORG_ID="14478"
DEVICE_IMEI="357660104031307"
USER_ID="23084"

# Your working token
BEARER_TOKEN="reZkK6ZtFZjZJErVYLFkhYoa3BuS2Nwj2urzEWOlqgS"

# ============================================================================
# OUTPUT DIRECTORY
# ============================================================================

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_DIR="surfsight_working_${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"/{auth,devices,events,organizations,recordings,streaming,telemetry,groups,users,health,alarms}

echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     Surfsight API - Working Endpoints - Matanuska Distribution${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"
echo -e "📁 Output: ${GREEN}$OUTPUT_DIR${NC}"
echo -e "🏢 Org: ${CYAN}$ORG_ID${NC} | 📱 Device: ${CYAN}$DEVICE_IMEI${NC}"
echo ""

# Function to make API calls
call_api() {
    local method=$1
    local endpoint=$2
    local output_file=$3
    local description=$4
    local data=$5
    
    echo -e "${YELLOW}➜ ${description}${NC}"
    echo -e "   ${CYAN}${method} ${endpoint}${NC}"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X ${method} \
            "${API_BASE}/${API_VERSION}${endpoint}" \
            -H "Authorization: Bearer ${BEARER_TOKEN}" \
            -H "Content-Type: application/json" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X ${method} \
            "${API_BASE}/${API_VERSION}${endpoint}" \
            -H "Authorization: Bearer ${BEARER_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    {
        echo "=== REQUEST ==="
        echo "Method: $method"
        echo "Endpoint: ${API_BASE}/${API_VERSION}${endpoint}"
        echo ""
        echo "=== RESPONSE (HTTP $http_code) ==="
        echo "$body"
    } > "$output_file"
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo -e "   ${GREEN}✓ Success (HTTP $http_code)${NC}"
    elif [ "$http_code" -eq 400 ]; then
        echo -e "   ${YELLOW}⚠ Bad Request (HTTP $http_code) - Check parameters${NC}"
    elif [ "$http_code" -eq 401 ]; then
        echo -e "   ${RED}✗ Unauthorized (HTTP $http_code) - Token expired${NC}"
    elif [ "$http_code" -eq 404 ]; then
        echo -e "   ${RED}✗ Not Found (HTTP $http_code)${NC}"
    else
        echo -e "   ${RED}✗ Failed (HTTP $http_code)${NC}"
    fi
    echo ""
}

# ============================================================================
# 1. AUTHENTICATION
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 1. AUTHENTICATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

call_api "POST" "/authenticate" \
    "$OUTPUT_DIR/auth/authenticate.json" \
    "Authenticate (POST /authenticate)" \
    "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"

call_api "GET" "/me" \
    "$OUTPUT_DIR/auth/me.json" \
    "Get current user info (GET /me)"

# ============================================================================
# 2. ORGANIZATIONS
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 2. ORGANIZATIONS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

call_api "GET" "/organizations" \
    "$OUTPUT_DIR/organizations/list.json" \
    "List organizations (GET /organizations)"

call_api "GET" "/organizations/${ORG_ID}" \
    "$OUTPUT_DIR/organizations/details.json" \
    "Get organization details (GET /organizations/${ORG_ID})"

call_api "GET" "/organizations/${ORG_ID}/default-settings" \
    "$OUTPUT_DIR/organizations/default_settings.json" \
    "Get default settings (GET /organizations/${ORG_ID}/default-settings)"

# ============================================================================
# 3. DEVICES (WORKING ENDPOINTS)
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 3. DEVICES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# CORRECT endpoint for listing devices
call_api "GET" "/organizations/${ORG_ID}/devices" \
    "$OUTPUT_DIR/devices/list.json" \
    "List all devices (GET /organizations/${ORG_ID}/devices)"

call_api "GET" "/devices/${DEVICE_IMEI}" \
    "$OUTPUT_DIR/devices/details.json" \
    "Get device details (GET /devices/${DEVICE_IMEI})"

call_api "GET" "/devices/${DEVICE_IMEI}/device-config" \
    "$OUTPUT_DIR/devices/config.json" \
    "Get device config (GET /devices/${DEVICE_IMEI}/device-config)"

call_api "GET" "/devices/${DEVICE_IMEI}/telemetry" \
    "$OUTPUT_DIR/devices/telemetry.json" \
    "Get device telemetry (GET /devices/${DEVICE_IMEI}/telemetry)"

# ============================================================================
# 4. EVENTS (WORKING ENDPOINTS)
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 4. EVENTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

END_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
START_DATE=$(date -u -d "7 days ago" +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -v-7d +"%Y-%m-%dT%H:%M:%S.000Z")

# CORRECT endpoint for device events
call_api "GET" "/devices/${DEVICE_IMEI}/events?start=${START_DATE}&end=${END_DATE}&limit=100" \
    "$OUTPUT_DIR/events/device_events.json" \
    "Get device events (GET /devices/${DEVICE_IMEI}/events)"

# CORRECT endpoint for organization events
call_api "POST" "/organizations/${ORG_ID}/events?start=${START_DATE}&end=${END_DATE}&limit=100" \
    "$OUTPUT_DIR/events/organization_events.json" \
    "Get organization events (POST /organizations/${ORG_ID}/events)" \
    "{}"

call_api "GET" "/devices/${DEVICE_IMEI}/event-config" \
    "$OUTPUT_DIR/events/config.json" \
    "Get event config (GET /devices/${DEVICE_IMEI}/event-config)"

# ============================================================================
# 5. EVENT MEDIA DOWNLOAD (WORKING)
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 5. EVENT MEDIA DOWNLOAD${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# First, get an event that has media files
event_data=$(curl -s "${API_BASE}/${API_VERSION}/devices/${DEVICE_IMEI}/events?start=${START_DATE}&end=${END_DATE}&limit=50" \
    -H "Authorization: Bearer ${BEARER_TOKEN}")

# Find first event with files
file_id=$(echo "$event_data" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(e['files'][0]['fileId']) for e in d.get('data',[]) if e.get('files')]" 2>/dev/null | head -1)
camera_id=$(echo "$event_data" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(e['files'][0]['cameraId']) for e in d.get('data',[]) if e.get('files')]" 2>/dev/null | head -1)

if [ -n "$file_id" ] && [ -n "$camera_id" ]; then
    echo -e "${GREEN}✓ Found event with media: fileId=$file_id, cameraId=$camera_id${NC}"
    echo ""
    
    call_api "GET" "/devices/${DEVICE_IMEI}/event-file-link?fileId=${file_id}&cameraId=${camera_id}&fileType=snapshot" \
        "$OUTPUT_DIR/events/media_link_snapshot.json" \
        "Get snapshot download link (fileId=${file_id})"
    
    call_api "GET" "/devices/${DEVICE_IMEI}/event-file-link?fileId=${file_id}&cameraId=${camera_id}&fileType=video" \
        "$OUTPUT_DIR/events/media_link_video.json" \
        "Get video download link (fileId=${file_id})"
else
    echo -e "${YELLOW}⚠ No events with media found in the last 7 days${NC}"
    echo ""
fi

# ============================================================================
# 6. RECORDINGS
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 6. RECORDINGS & STREAMING${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

call_api "GET" "/devices/${DEVICE_IMEI}/retention-config" \
    "$OUTPUT_DIR/recordings/retention.json" \
    "Get retention config (GET /devices/${DEVICE_IMEI}/retention-config)"

call_api "POST" "/devices/${DEVICE_IMEI}/connect-media" \
    "$OUTPUT_DIR/streaming/connect_media.json" \
    "Connect to media server (POST /devices/${DEVICE_IMEI}/connect-media)"

# ============================================================================
# 7. TELEMETRY
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 7. TELEMETRY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

call_api "GET" "/devices/${DEVICE_IMEI}/gps?start=${START_DATE}&end=${END_DATE}&limit=100" \
    "$OUTPUT_DIR/telemetry/gps.json" \
    "Get GPS data (GET /devices/${DEVICE_IMEI}/gps)"

call_api "GET" "/devices/${DEVICE_IMEI}/trips?start=${START_DATE}&end=${END_DATE}" \
    "$OUTPUT_DIR/telemetry/trips.json" \
    "Get trips (GET /devices/${DEVICE_IMEI}/trips)"

call_api "GET" "/devices/${DEVICE_IMEI}/score?start=${START_DATE}&end=${END_DATE}" \
    "$OUTPUT_DIR/telemetry/score.json" \
    "Get safety score (GET /devices/${DEVICE_IMEI}/score)"

# ============================================================================
# 8. GROUPS & USERS
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 8. GROUPS & USERS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

call_api "GET" "/organizations/${ORG_ID}/groups" \
    "$OUTPUT_DIR/groups/list.json" \
    "List groups (GET /organizations/${ORG_ID}/groups)"

call_api "GET" "/organizations/${ORG_ID}/users" \
    "$OUTPUT_DIR/users/list.json" \
    "List users (GET /organizations/${ORG_ID}/users)"

# ============================================================================
# 9. HEALTH & ALARMS
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 9. HEALTH & ALARMS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

call_api "GET" "/device-health?limit=50" \
    "$OUTPUT_DIR/health/devices.json" \
    "Get device health (GET /device-health)"

call_api "GET" "/alarms?limit=50" \
    "$OUTPUT_DIR/alarms/list.json" \
    "Get alarms (GET /alarms)"

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Generate summary
SUMMARY_FILE="$OUTPUT_DIR/SUMMARY.txt"
{
    echo "Surfsight API - Working Endpoints Test Summary"
    echo "=============================================="
    echo ""
    echo "Date: $(date)"
    echo "Environment: ${API_BASE}/${API_VERSION}/"
    echo "Organization: Matanuska Distribution (ID: $ORG_ID)"
    echo "Device IMEI: $DEVICE_IMEI"
    echo ""
    echo "Output Directory: $OUTPUT_DIR"
    echo ""
    echo "Files Generated:"
    find "$OUTPUT_DIR" -name "*.json" -type f | sort | while read -r f; do
        echo "  - ${f#$OUTPUT_DIR/}"
    done
    echo ""
    echo "Working Endpoints Confirmed:"
    echo "----------------------------"
    echo "  POST   /authenticate                      - Authentication"
    echo "  GET    /me                                - Current user"
    echo "  GET    /organizations                     - List orgs"
    echo "  GET    /organizations/{id}                - Org details"
    echo "  GET    /organizations/{id}/devices        - List devices ✓"
    echo "  GET    /devices/{imei}                    - Device details"
    echo "  GET    /devices/{imei}/device-config      - Device config"
    echo "  GET    /devices/{imei}/telemetry          - Telemetry"
    echo "  GET    /devices/{imei}/events             - Device events ✓"
    echo "  POST   /organizations/{id}/events         - Org events ✓"
    echo "  GET    /devices/{imei}/event-file-link    - Download media ✓"
    echo "  POST   /devices/{imei}/connect-media      - Media server"
    echo "  GET    /device-health                     - Health reports"
    echo "  GET    /alarms                            - Alarms"
    echo ""
    echo "Token Validity: 24 hours"
} > "$SUMMARY_FILE"

echo -e "${GREEN}✓ Summary saved: $SUMMARY_FILE${NC}"
echo ""

# Count results
total=$(find "$OUTPUT_DIR" -name "*.json" -type f | wc -l)
echo -e "📊 ${CYAN}Statistics:${NC}"
echo -e "   Total requests: ${YELLOW}$total${NC}"
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Test Complete! Output saved to: ${YELLOW}$OUTPUT_DIR${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"