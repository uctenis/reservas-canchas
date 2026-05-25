<#
Simple PowerShell helper to initialize a Git repo and push to a GitHub `staging` branch.
Usage: run from project root (where index.html is)
  .\push-to-github.ps1

It will prompt for the remote URL (ssh or https), create a `staging` branch and push it.
#>

Param()

Write-Host "Push-to-GitHub helper: will initialize repo (if needed) and push branch 'staging'" -ForegroundColor Cyan
$remote = Read-Host 'Enter Git remote URL (e.g. git@github.com:USERNAME/reservas-canchas-staging.git)'
if (-not $remote) { Write-Error "Remote URL required. Aborting."; exit 1 }

if (-not (Test-Path .git)) {
  git init
  Write-Host "Initialized new git repository"
}

# Stage everything and commit
git add -A
try {
  git commit -m "Initial staging copy" -q
} catch {
  Write-Host "No new files to commit or commit failed (existing repo). Continuing..." -ForegroundColor Yellow
}

# Create or switch to staging
try {
  git checkout -B staging
} catch {
  git branch -M staging
}

# Setup remote
git remote remove origin -ErrorAction SilentlyContinue
git remote add origin $remote

# Push
Write-Host "Pushing branch 'staging' to remote..."
git push -u origin staging

Write-Host "Done. If you enabled GitHub Actions (deploy workflow), Pages will publish to branch 'gh-pages' automatically on push to 'staging'." -ForegroundColor Green
