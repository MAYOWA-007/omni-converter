[CmdletBinding()]
param(
    [Parameter()]
    [switch]$Public
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$npmCommand = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
    (Get-Command npm.cmd).Source
} else {
    (Get-Command npm -ErrorAction Stop).Source
}

function Invoke-VerificationStep {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][scriptblock]$Action
    )

    Write-Host "`n==> $Name"
    $global:LASTEXITCODE = 0
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE."
    }
}

Push-Location $projectRoot
try {
    Invoke-VerificationStep -Name "Public safety fixtures" -Action {
        & (Join-Path $PSScriptRoot "test-public-safety.ps1")
    }

    if ($Public) {
        Invoke-VerificationStep -Name "Public repository safety scan" -Action {
            & (Join-Path $PSScriptRoot "check-public-safety.ps1") -Root $projectRoot
        }
    }

    Invoke-VerificationStep -Name "TypeScript typecheck" -Action { & $npmCommand run typecheck }
    Invoke-VerificationStep -Name "Production build" -Action { & $npmCommand run build }
    Invoke-VerificationStep -Name "Initial bundle budget" -Action { & $npmCommand run test:bundle }
    Invoke-VerificationStep -Name "Unit and contract tests" -Action { & $npmCommand run test:unit }
    Invoke-VerificationStep -Name "Browser workflow tests" -Action { & $npmCommand run test:e2e }
    Invoke-VerificationStep -Name "Offline PWA tests" -Action { & $npmCommand run test:pwa }

    Write-Host "`nOmni Converter verification passed."
} finally {
    Pop-Location
}
