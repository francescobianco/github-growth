#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Generating aggregate data..."
node "${SCRIPT_DIR}/generate-aggregate.js"

echo ""
echo "==> Generating charts..."
node "${SCRIPT_DIR}/generate-charts.js"

echo ""
echo "Open to preview:"
echo "  .github/charts/daily-traffic.svg"
echo "  .github/charts/top-repos.svg"
