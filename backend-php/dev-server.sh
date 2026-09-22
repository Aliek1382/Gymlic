#!/usr/bin/env bash
# Local development only. Shared-host deploys edit config.php instead.
set -euo pipefail

export GYMLIC_DB_NAME="${GYMLIC_DB_NAME:-gymlic_dev}"
export GYMLIC_DB_USER="${GYMLIC_DB_USER:-gymlic}"
export GYMLIC_DB_PASS="${GYMLIC_DB_PASS:-gymlic_pw}"
export GYMLIC_CORS_ORIGINS="${GYMLIC_CORS_ORIGINS:-http://localhost:3000}"

exec php -S "${1:-127.0.0.1:8099}" -t "$(dirname "$0")/public" "$(dirname "$0")/public/index.php"
