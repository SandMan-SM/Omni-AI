#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "== git status =="
git status --short --branch

echo "== sanity checks =="
git diff --check
if npm run | grep -qE '^  check$|^    check$| check$'; then
  npm run check
else
  echo "No npm check script detected; skipping npm run check"
fi

echo "== staging Mafi dashboard access changes =="
git add \
  lib/mafi-access.ts \
  app/api/dashboard/businesses/route.ts \
  app/api/dashboard/leads/route.ts \
  app/api/dashboard/aggregate-analytics/route.ts \
  hooks/use-profile.tsx \
  app/dashboard/companies/page.tsx \
  docs/plans/2026-05-27-client-agent-dashboards.md

echo "== staged diff =="
git diff --cached --stat

git commit -m "fix: grant Mafi platform dashboard access" \
  -m "Centralize Mafi identity checks and apply platform-level access across dashboard APIs and UI gates."

echo "== pushing =="
git push origin main

echo "== done =="
git status --short --branch
