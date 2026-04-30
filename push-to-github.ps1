$ErrorActionPreference = "Stop"

param(
  [string]$CommitMessage = "Update project",
  [string]$ProjectPath = "C:\Users\Jmlel\OneDrive\Documents\CHESS",
  [string]$Branch = "main"
)

function Resolve-GitExe {
  $candidates = @(
    (Get-Command git -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
    "$env:ProgramFiles\GitHub Desktop\resources\app\git\cmd\git.exe"
  ) | Where-Object { $_ -and (Test-Path $_) }

  if ($candidates.Count -gt 0) {
    return $candidates[0]
  }

  throw "Git was not found. Install Git for Windows or GitHub Desktop first, then run this script again."
}

function Invoke-Git {
  param(
    [string[]]$Arguments
  )

  & $script:GitExe @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

if (-not (Test-Path $ProjectPath)) {
  throw "Project path '$ProjectPath' does not exist."
}

$script:GitExe = Resolve-GitExe
Set-Location $ProjectPath

$isRepo = $false
try {
  & $script:GitExe rev-parse --is-inside-work-tree *> $null
  $isRepo = ($LASTEXITCODE -eq 0)
} catch {
  $isRepo = $false
}

if (-not $isRepo) {
  Write-Host "Initializing Git repository..."
  Invoke-Git -Arguments @("init")
}

$remoteUrl = ""
try {
  $remoteUrl = (& $script:GitExe remote get-url origin 2>$null).Trim()
} catch {
  $remoteUrl = ""
}

if (-not $remoteUrl) {
  Write-Host "No 'origin' remote is configured yet."
  Write-Host "Connect your GitHub repo first, for example:"
  Write-Host 'git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git'
  throw "Missing GitHub remote."
}

try {
  $currentBranch = (& $script:GitExe branch --show-current 2>$null).Trim()
} catch {
  $currentBranch = ""
}

if (-not $currentBranch) {
  $currentBranch = $Branch
}

if ($currentBranch -ne $Branch) {
  try {
    Invoke-Git -Arguments @("checkout", $Branch)
  } catch {
    Write-Host "Creating branch '$Branch'..."
    Invoke-Git -Arguments @("checkout", "-b", $Branch)
  }
}

Invoke-Git -Arguments @("add", "-A")

$status = (& $script:GitExe status --porcelain).Trim()
if (-not $status) {
  Write-Host "No changes to commit."
} else {
  Invoke-Git -Arguments @("commit", "-m", $CommitMessage)
}

Invoke-Git -Arguments @("push", "-u", "origin", $Branch)

Write-Host ""
Write-Host "Done."
Write-Host "Project: $ProjectPath"
Write-Host "Branch:  $Branch"
Write-Host "Remote:  $remoteUrl"
