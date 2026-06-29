#!/usr/bin/env bash
# ----------------------------------------------------------------------
# fetch_openrouter_models.sh
# Fetch OpenRouter model data with different sort orders and save as
# a combined JSON file.
#
# Usage:
#   ./fetch_openrouter_models.sh [output_file]
#
# Default output file: openrouter_models.json
# ----------------------------------------------------------------------

set -euo pipefail

# --- configuration ---
OUTPUT_FILE="${1:-openrouter_models.json}"

# API endpoints to fetch
declare -A ENDPOINTS=(
    [cheapest]="https://openrouter.ai/api/v1/models?sort=pricing-low-to-high"
    [newest]="https://openrouter.ai/api/v1/models?sort=newest"
    [throughput_tools]="https://openrouter.ai/api/v1/models?sort=throughput-high-to-low&supported_parameters=tools"
)

# --- prerequisite checks ---
if ! command -v curl &>/dev/null; then
    echo "Error: curl is required but not installed." >&2
    exit 1
fi

if ! command -v jq &>/dev/null; then
    echo "Error: jq is required but not installed." >&2
    exit 1
fi

# --- fetch data ---
echo "Fetching model data from OpenRouter..." >&2

# Create a temporary directory for raw responses
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Fetch each endpoint and save raw JSON to a temp file
for key in "${!ENDPOINTS[@]}"; do
    url="${ENDPOINTS[$key]}"
    tmpfile="$TMPDIR/${key}.json"

    echo "  -> $key ($url)" >&2
    if curl -sS --fail --max-time 30 -o "$tmpfile" "$url"; then
        :
    else
        echo "     WARNING: fetch failed for $key, storing error placeholder" >&2
        echo '{"error": "Failed to fetch from API"}' > "$tmpfile"
    fi
done

# --- combine into a single JSON object ---
echo "Combining results into $OUTPUT_FILE ..." >&2

jq -n \
    --slurpfile cheapest "$TMPDIR/cheapest.json" \
    --slurpfile newest "$TMPDIR/newest.json" \
    --slurpfile throughput_tools "$TMPDIR/throughput_tools.json" \
'{
    cheapest: $cheapest[0],
    newest: $newest[0],
    throughput_tools: $throughput_tools[0]
}' > "$OUTPUT_FILE"

echo "Done. Output written to $OUTPUT_FILE" >&2