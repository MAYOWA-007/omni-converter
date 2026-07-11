[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scanner = Join-Path $PSScriptRoot "check-public-safety.ps1"
$shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) {
    (Get-Command pwsh).Source
} else {
    (Get-Command powershell -ErrorAction Stop).Source
}
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testRoot = Join-Path $tempBase ("omni-public-safety-" + [guid]::NewGuid().ToString("N"))

function Invoke-Scanner {
    param([Parameter(Mandatory)][string]$Root)

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $shell
    $startInfo.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scanner`" -Root `"$Root`""
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $output = @($stdout.Result, $stderr.Result) -join [Environment]::NewLine
    return @{
        ExitCode = $process.ExitCode
        Output = $output
    }
}

function Write-Fixture {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][string]$Content
    )

    $path = Join-Path $Root $RelativePath
    $directory = Split-Path -Parent $path
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    Set-Content -LiteralPath $path -Value $Content -NoNewline
}

try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null

    $cleanRoot = Join-Path $testRoot "clean"
    Write-Fixture -Root $cleanRoot -RelativePath "src/app.ts" -Content 'export const product = "Omni Converter";'
    $cleanResult = Invoke-Scanner -Root $cleanRoot
    if ($cleanResult.ExitCode -ne 0) {
        throw "Clean fixture failed:`n$($cleanResult.Output)"
    }

    $blockedFixtures = @(
        @{
            Name = "company URL"
            RelativePath = "src/company.ts"
            Content = 'export const site = "https://www.knightaiav.com";'
            Expected = "company branding"
        },
        @{
            Name = "local absolute path"
            RelativePath = "src/path.ts"
            Content = 'export const source = "C:\Users\Example\Desktop\source.pdf";'
            Expected = "local absolute path"
        },
        @{
            Name = "credential"
            RelativePath = "src/config.ts"
            Content = 'export const apiKey = "sk_test_1234567890abcdef";'
            Expected = "credential-like value"
        },
        @{
            Name = "private documentation"
            RelativePath = "docs/private/release.md"
            Content = "Internal release routing"
            Expected = "private documentation"
        }
    )

    foreach ($fixture in $blockedFixtures) {
        $root = Join-Path $testRoot (($fixture.Name -replace "[^a-zA-Z0-9]+", "-").Trim("-"))
        Write-Fixture -Root $root -RelativePath $fixture.RelativePath -Content $fixture.Content
        $result = Invoke-Scanner -Root $root

        if ($result.ExitCode -eq 0) {
            throw "The $($fixture.Name) fixture was accepted."
        }
        if ($result.Output -notmatch [regex]::Escape($fixture.Expected)) {
            throw "The $($fixture.Name) fixture did not report '$($fixture.Expected)':`n$($result.Output)"
        }
    }

    Write-Host "Public safety fixtures passed: 1 clean, $($blockedFixtures.Count) blocked."
    $global:LASTEXITCODE = 0
} finally {
    $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
    if ($resolvedTestRoot.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTestRoot)) {
        Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
    }
}
