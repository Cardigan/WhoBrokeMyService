[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$ProjectPath = (Get-Location).Path,

    [ValidateRange(0, 65535)]
    [int]$Port = 4173,

    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$AppRoot = Join-Path $PSScriptRoot "app"
$PackageLockPath = Join-Path $AppRoot "package-lock.json"
$NodeModulesPath = Join-Path $AppRoot "node_modules"
$InstallStampPath = Join-Path $NodeModulesPath ".wbms-package-lock.sha256"

if (-not (Test-Path -LiteralPath $AppRoot -PathType Container)) {
    throw "WBMS application files are missing: $AppRoot"
}

$ResolvedProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$AiDirectory = if ((Split-Path -Leaf $ResolvedProjectPath) -eq ".ai") {
    $ResolvedProjectPath
} else {
    Join-Path $ResolvedProjectPath ".ai"
}

if (-not (Test-Path -LiteralPath $AiDirectory -PathType Container)) {
    throw "Expected an .ai directory at: $AiDirectory"
}

$NpmCommand = Get-Command npm -ErrorAction Stop
$LockHash = (Get-FileHash -LiteralPath $PackageLockPath -Algorithm SHA256).Hash
$InstalledLockHash = if (Test-Path -LiteralPath $InstallStampPath -PathType Leaf) {
    (Get-Content -LiteralPath $InstallStampPath -Raw).Trim()
} else {
    ""
}

Push-Location $AppRoot
try {
    if (-not (Test-Path -LiteralPath $NodeModulesPath -PathType Container) -or $InstalledLockHash -ne $LockHash) {
        Write-Host "Installing WBMS dependencies..."
        & $NpmCommand.Source ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed with exit code $LASTEXITCODE."
        }
        Set-Content -LiteralPath $InstallStampPath -Value $LockHash -NoNewline
    }

    Write-Host "Building WBMS..."
    & $NpmCommand.Source run build
    if ($LASTEXITCODE -ne 0) {
        throw "WBMS build failed with exit code $LASTEXITCODE."
    }

    $StartArguments = @("start", "--", $ResolvedProjectPath, "--port", $Port.ToString())
    if ($NoOpen) {
        $StartArguments += "--no-open"
    }

    Write-Host "Starting WBMS for $AiDirectory on http://127.0.0.1:$Port"
    & $NpmCommand.Source @StartArguments
    if ($LASTEXITCODE -ne 0) {
        throw "WBMS server exited with code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}
