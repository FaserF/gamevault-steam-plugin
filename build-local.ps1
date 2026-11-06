<#
.SYNOPSIS
    Local builder & packager for GameVault Steam Plugin.
.DESCRIPTION
    Compiles TypeScript to ESM with esbuild, runs Node.js unit tests,
    and optionally packages release zip archives for deployment.
.EXAMPLE
    .\build-local.ps1
    .\build-local.ps1 -Package
#>
param (
    [switch]$Package,
    [switch]$SkipTests,
    [string]$TargetDir
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

Write-Host "[BUILD] Building GameVault Steam Plugin..." -ForegroundColor Cyan

# 1. Compile source files via npm run build
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}
Write-Host "[SUCCESS] ESM build completed successfully." -ForegroundColor Green

# 2. Run unit tests
if (-not $SkipTests) {
    Write-Host "[TEST] Running unit tests..." -ForegroundColor Cyan
    npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Unit tests failed!"
        exit $LASTEXITCODE
    }
    Write-Host "[SUCCESS] All unit tests passed." -ForegroundColor Green
}

# 3. Packaging
if ($Package) {
    Write-Host "[PACKAGE] Packaging release ZIP archive..." -ForegroundColor Cyan
    $pkg = Get-Content "package.json" | ConvertFrom-Json
    $version = $pkg.version
    $artifactsDir = Join-Path $RepoRoot "artifacts"
    if (-not (Test-Path $artifactsDir)) {
        New-Item -ItemType Directory -Path $artifactsDir | Out-Null
    }

    $zipName = "gamevault-steam-plugin-v$version.zip"
    $zipPath = Join-Path $artifactsDir $zipName

    $staging = Join-Path $artifactsDir "staging"
    if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
    New-Item -ItemType Directory -Path $staging | Out-Null

    Get-ChildItem -Path "dist" | Copy-Item -Destination $staging -Recurse
    if (Test-Path (Join-Path $staging "types")) { Remove-Item -Recurse -Force (Join-Path $staging "types") }
    Copy-Item "manifest.json" $staging -ErrorAction SilentlyContinue
    Copy-Item "README.md" $staging -ErrorAction SilentlyContinue
    Copy-Item "LICENSE.md" $staging -ErrorAction SilentlyContinue
    Copy-Item "CHANGELOG.md" $staging -ErrorAction SilentlyContinue

    if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
    tar -a -cf "$zipPath" -C "$staging" .

    # Compute SHA-256
    $hash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()
    Set-Content -Path "$zipPath.sha256" -Value "$hash  $zipName"

    Remove-Item -Recurse -Force $staging
    Write-Host "[PACKAGE] Release archive created at: $zipPath" -ForegroundColor Green
    Write-Host "[HASH] SHA-256: $hash" -ForegroundColor Yellow
}

# 4. Optional copy to target
if ($TargetDir -and (Test-Path $TargetDir)) {
    Write-Host "[DEPLOY] Deploying to target: $TargetDir" -ForegroundColor Cyan
    Copy-Item -Recurse -Force "dist\*" $TargetDir
    Write-Host "[SUCCESS] Deployed to $TargetDir" -ForegroundColor Green
}

Write-Host "[DONE] Local workflow finished successfully!" -ForegroundColor Green
