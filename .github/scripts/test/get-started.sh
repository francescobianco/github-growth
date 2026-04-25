#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GET_STARTED="${SCRIPT_DIR}/../get-started.sh"

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

cd "$WORK_DIR"
echo "Running get-started.sh from: $(pwd)"
echo ""

bash "$GET_STARTED"