#!/usr/bin/env bash
set -euo pipefail

# Basic production deploy script for Agendia backend.
#
# Steps:
#   1. Verifies required environment variables.
#   2. Installs dependencies.
#   3. Generates the Prisma client.
#   4. Builds the TypeScript project.
#   5. Applies pending migrations to the remote/production database.
#   6. Starts the server.
#
# Usage:
#   ./scripts/deploy.sh
#
# Make sure the production .env file is loaded before running this script.
# In production you usually want to run this inside a process manager (PM2,
# systemd, Docker, etc.) instead of starting the server directly.

REQUIRED_VARS=("DATABASE_URL" "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY")
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required environment variable: $var" >&2
    exit 1
  fi
done

echo "Installing dependencies..."
npm ci

echo "Generating Prisma client..."
npx prisma generate

echo "Building project..."
npm run build

echo "Applying migrations to production database..."
npx prisma migrate deploy

echo "Starting server..."
npm run start
