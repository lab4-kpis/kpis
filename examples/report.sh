#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${SUPABASE_PUBLISHABLE_KEY:?Set SUPABASE_PUBLISHABLE_KEY}"
: "${PROJECT_KEY:?Set PROJECT_KEY}"

curl --fail-with-body --silent --show-error \
  --request POST \
  "${SUPABASE_URL}/rest/v1/measurement?on_conflict=project_id,kpi_id,date,env" \
  --header "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
  --header "X-Project-Key: ${PROJECT_KEY}" \
  --header "Content-Type: application/json" \
  --header "Prefer: resolution=ignore-duplicates" \
  --data '[
    {
      "kpi_id": "publicaciones_activas",
      "date": "2026-10-09",
      "env": "prod",
      "value": 42,
      "run_id": "0192d36a-7b35-7cc4-b1bd-2d55f0d61a56"
    }
  ]'
