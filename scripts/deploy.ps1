<#
.SYNOPSIS
    Basic production deploy script for Agendia backend.

.DESCRIPTION
    1. Verifies required environment variables.
    2. Installs dependencies.
    3. Generates the Prisma client.
    4. Builds the TypeScript project.
    5. Applies pending migrations to the remote/production database.
    6. Starts the server.

.EXAMPLE
    .\scripts\deploy.ps1

.NOTES
    Make sure the production .env file is loaded before running this script.
    In production you usually want to run this inside a process manager (PM2,
    systemd, Docker, etc.) instead of starting the server directly.
#>

$ErrorActionPreference = 'Stop'

$requiredEnvVars = @('DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')
foreach ($var in $requiredEnvVars) {
    if (-not [Environment]::GetEnvironmentVariable($var)) {
        Write-Error "Missing required environment variable: $var"
        exit 1
    }
}

Write-Host 'Installing dependencies...'
npm ci

Write-Host 'Generating Prisma client...'
npx prisma generate

Write-Host 'Building project...'
npm run build

Write-Host 'Applying migrations to production database...'
npx prisma migrate deploy

Write-Host 'Starting server...'
npm run start
