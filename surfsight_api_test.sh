#!/bin/bash

# Surfsight API Testing Script for Matanuska Distribution (DE Cloud)
# Environment: Europe (DE) - https://api.de.surfsight.net

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="https://api.de.surfsight.net"
API_VERSION="v2"
EMAIL="heinrich@matanuska.co.za"
PASSWORD="0824656647@Hj"
ORG_ID="14478"
DEVICE_IMEI="357660104031307"
USER_ID="23084"

# Tokens (from successful authentication)
BEARER_TOKEN="reZkK6ZtFZjZJErVYLFkhYoa3BuS2Nwj2urzEWOlqgS"
MEDIA_TOKEN="e845589e-89a6-4017-a72b-a380e7d0b1bf"

# Create output directories
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_DIR="surfsight_api_output_${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"/{auth,devices,events,organizations,users,media,responses}

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     Surfsight API Testing - Matanuska Distribution (DE Cloud)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "Output Directory: ${GREEN}$OUTPUT_DIR${NC}"
echo -e "Timestamp: ${YELLOW}$TIMESTAMP${NC}"
echo ""

# Function to make API calls and save responses
make_request() {
    local method=$1
    local endpoint=$2
    local token=$3
    local data=$4
    local output_file=$5
    local description=$6
    
    echo -e "${YELLOW}➜ ${description}${NC}"
    echo -e "  Method: ${method}"
    echo -e "  Endpoint: ${endpoint}"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X ${method} \
            "${API_BASE}${endpoint}" \
            -H "Authorization: Bearer ${token}" \
            -H "Content-Type: application/json" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X ${method} \
            "${API_BASE}${endpoint}" \
            -H "Authorization: Bearer ${token}" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Save to file
    echo "=== Request ===" > "$output_file"
    echo "Method: $method" >> "$output_file"
    echo "Endpoint: $endpoint" >> "$output_file"
    echo "Token: ${token:0:20}..." >> "$output_file"
    echo "" >> "$output_file"
    echo "=== Response (HTTP $http_code) ===" >> "$output_file"
    echo "$body" >> "$output_file"
    
    # Display result
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo -e "  ${GREEN}✓ Success (HTTP $http_code)${NC}"
        echo -e "  Saved to: ${output_file}"
    elif [ "$http_code" -eq 401 ]; then
        echo -e "  ${RED}✗ Unauthorized (HTTP $http_code) - Token may be expired${NC}"
    elif [ "$http_code" -eq 404 ]; then
        echo -e "  ${RED}✗ Not Found (HTTP $http_code) - Invalid endpoint${NC}"
    else
        echo -e "  ${RED}✗ Failed (HTTP $http_code)${NC}"
    fi
    echo ""
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. AUTHENTICATION TESTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 1: Authenticate with email/password
make_request "POST" "/${API_VERSION}/authenticate" "" \
    "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
    "$OUTPUT_DIR/auth/authenticate.json" \
    "Authenticating with email/password"

# Test 2: Get current user info
make_request "GET" "/${API_VERSION}/users/${USER_ID}" "$BEARER_TOKEN" \
    "" "$OUTPUT_DIR/users/current_user.json" \
    "Get current user details"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. ORGANIZATION TESTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 3: Get organization details
make_request "GET" "/${API_VERSION}/organizations/${ORG_ID}" "$BEARER_TOKEN" \
    "" "$OUTPUT_DIR/organizations/org_details.json" \
    "Get organization details for ID: ${ORG_ID}"

# Test 4: List all organizations (may require partner access)
make_request "GET" "/${API_VERSION}/organizations" "$BEARER_TOKEN" \
    "" "$OUTPUT_DIR/organizations/all_orgs.json" \
    "List all organizations (partner access may be required)"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. DEVICE TESTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 5: List devices by organization
make_request "GET" "/${API_VERSION}/devices?organizationId=${ORG_ID}" "$BEARER_TOKEN" \
    "" "$OUTPUT_DIR/devices/devices_by_org.json" \
    "List devices for organization ${ORG_ID}"

# Test 6: Get specific device details
make_request "GET" "/${API_VERSION}/devices/${DEVICE_IMEI}" "$BEARER_TOKEN" \
    "" "$OUTPUT_DIR/devices/device_details.json" \
    "Get details for device IMEI: ${DEVICE_IMEI}"

# Test 7: Get device events
make_request "GET" "/${API_VERSION}/devices/${DEVICE_IMEI}/events" "$BEARER_TOKEN" \
    "" "$OUTPUT_DIR/devices/device_events.json" \
    "Get events for device IMEI: ${DEVICE_IMEI}"

# Test 8: Alternative events endpoint (POST)
make_request "POST" "/${API_VERSION}/events/list" "$BEARER_TOKEN" \
    "{\"deviceId\":\"${DEVICE_IMEI}\"}" \
    "$OUTPUT_DIR/events/events_by_device_post.json" \
    "Get events via POST with deviceId"

# Test 9: Events by organization (POST)
make_request "POST" "/${API_VERSION}/events/list" "$BEARER_TOKEN" \
    "{\"organizationId\":${ORG_ID}}" \
    "$OUTPUT_DIR/events/events_by_org_post.json" \
    "Get events via POST with organizationId"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. MEDIA & STREAMING TESTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 10: Generate media auth token
make_request "GET" "/mediacore_api/api/generate_authtoken" "$BEARER_TOKEN" \
    "" "$OUTPUT_DIR/media/generate_token.json" \
    "Generate MediaCore authentication token"

# Test 11: Test media token with events
make_request "GET" "/mediacore_api/api/events?device_id=${DEVICE_IMEI}" "$MEDIA_TOKEN" \
    "" "$OUTPUT_DIR/media/media_events.json" \
    "Get events using media token"

# Test 12: Test media devices endpoint
make_request "GET" "/mediacore_api/api/devices" "$MEDIA_TOKEN" \
    "" "$OUTPUT_DIR/media/media_devices.json" \
    "List devices using media token"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5. ADDITIONAL ENDPOINT DISCOVERY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test various endpoint patterns
declare -a test_endpoints=(
    "/${API_VERSION}/vehicles"
    "/${API_VERSION}/vehicles?organizationId=${ORG_ID}"
    "/${API_VERSION}/vehicles/${DEVICE_IMEI}"
    "/${API_VERSION}/recordings?deviceId=${DEVICE_IMEI}"
    "/${API_VERSION}/alarms?organizationId=${ORG_ID}"
    "/${API_VERSION}/fleet?organizationId=${ORG_ID}"
    "/api/${API_VERSION}/devices"
    "/rest/${API_VERSION}/devices"
)

counter=1
for endpoint in "${test_endpoints[@]}"; do
    make_request "GET" "$endpoint" "$BEARER_TOKEN" \
        "" "$OUTPUT_DIR/responses/endpoint_${counter}.json" \
        "Testing endpoint: $endpoint"
    ((counter++))
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}6. SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Generate summary report
SUMMARY_FILE="$OUTPUT_DIR/SUMMARY.txt"
cat > "$SUMMARY_FILE" << EOF
Surfsight API Test Summary
==========================
Date: $(date)
Environment: Europe (DE) - api.de.surfsight.net
Organization: Matanuska Distribution (ID: $ORG_ID)
User: $EMAIL (ID: $USER_ID)
Device IMEI: $DEVICE_IMEI

Test Results Directory: $OUTPUT_DIR

Files Generated:
----------------
Authentication:
- $OUTPUT_DIR/auth/authenticate.json

Users:
- $OUTPUT_DIR/users/current_user.json

Organizations:
- $OUTPUT_DIR/organizations/org_details.json
- $OUTPUT_DIR/organizations/all_orgs.json

Devices:
- $OUTPUT_DIR/devices/devices_by_org.json
- $OUTPUT_DIR/devices/device_details.json
- $OUTPUT_DIR/devices/device_events.json

Events:
- $OUTPUT_DIR/events/events_by_device_post.json
- $OUTPUT_DIR/events/events_by_org_post.json

Media:
- $OUTPUT_DIR/media/generate_token.json
- $OUTPUT_DIR/media/media_events.json
- $OUTPUT_DIR/media/media_devices.json

Additional Endpoint Tests:
- $OUTPUT_DIR/responses/endpoint_*.json

Key Information:
----------------
- API Base URL: $API_BASE/${API_VERSION}/
- Bearer Token: ${BEARER_TOKEN:0:30}...
- Media Token: ${MEDIA_TOKEN:0:30}...
- Token Expiry: 24 hours from generation

Notes:
------
- All 404 responses indicate endpoints that don't exist or require different paths
- 401 responses indicate expired tokens or insufficient permissions
- 200/201 responses indicate successful API calls
- The mediacore_api endpoints work but require the media token

Next Steps:
-----------
1. Review successful responses for data structure
2. Check 404 responses - these endpoints may need different paths
3. Refer to API documentation at: https://developer.surfsight.net/openapi/surfsight/overview
4. For partner-level access, request partner credentials from Surfsight

EOF

echo -e "${GREEN}✓ Summary report saved to: $SUMMARY_FILE${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}All tests completed!${NC}"
echo -e "Output saved in directory: ${YELLOW}$OUTPUT_DIR${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Display quick stats
success_count=$(find "$OUTPUT_DIR" -name "*.json" -exec grep -l '"status"' {} \; | wc -l)
total_count=$(find "$OUTPUT_DIR" -name "*.json" | wc -l)
echo -e "\nQuick Stats:"
echo -e "  Total requests: ${total_count}"
echo -e "  Successful (with status field): ${success_count}"
echo ""

# Optional: Create a simple config file for reuse
CONFIG_FILE="$OUTPUT_DIR/config.sh"
cat > "$CONFIG_FILE" << EOF
#!/bin/bash
# Surfsight API Configuration
export SURFSIGHT_API_BASE="$API_BASE"
export SURFSIGHT_API_VERSION="$API_VERSION"
export SURFSIGHT_BEARER_TOKEN="$BEARER_TOKEN"
export SURFSIGHT_MEDIA_TOKEN="$MEDIA_TOKEN"
export SURFSIGHT_ORG_ID="$ORG_ID"
export SURFSIGHT_DEVICE_IMEI="$DEVICE_IMEI"
export SURFSIGHT_USER_ID="$USER_ID"
EOF

chmod +x "$CONFIG_FILE"
echo -e "${GREEN}✓ Configuration file saved: $CONFIG_FILE${NC}"
echo -e "  Source this file to use variables: ${YELLOW}source $CONFIG_FILE${NC}"