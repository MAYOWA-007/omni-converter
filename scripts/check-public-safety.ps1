[CmdletBinding()]
param(
    [Parameter()]
    [string]$Root
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $scriptRoot = if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) {
        Split-Path -Parent $MyInvocation.MyCommand.Path
    } else {
        $PSScriptRoot
    }
    $Root = Split-Path -Parent $scriptRoot
}

$resolvedRoot = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath $resolvedRoot -PathType Container)) {
    throw "Public safety root is not a directory: $resolvedRoot"
}

$rootPrefix = $resolvedRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$textExtensions = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
@(
    ".bat", ".cmd", ".css", ".csv", ".html", ".ini", ".js", ".jsx", ".json",
    ".md", ".mjs", ".cjs", ".properties", ".ps1", ".py", ".sh", ".toml", ".ts",
    ".tsx", ".txt", ".webmanifest", ".xml", ".yml", ".yaml"
) | ForEach-Object { [void]$textExtensions.Add($_) }

$excludedPathPattern = '^(?:\.git|node_modules|dist|output|test-results|playwright-report|coverage|\.vercel|\.superpowers)(?:/|$)|^public/assets/(?:ffmpeg|ocr)(?:/|$)'
$safetyToolPattern = '^scripts/(?:check|test)-public-safety\.ps1$'
$privateDocumentationPattern = '(?i)(?:^|/)(?:docs/(?:private|internal|superpowers)|private-docs?)(?:/|$)|(?:^|/)ULTIMATE_CONVERSION_MATRIX\.md$'

$contentRules = @(
    @{
        Label = "company branding"
        Pattern = '(?i)(?:knight\s*ai\s*\+\s*av|knightaiav(?:\.com)?|knight-ai-av|knight-helm)'
    },
    @{
        Label = "local absolute path"
        Pattern = '(?i)(?:[A-Z]:[\\/](?:Users|Documents and Settings)[\\/]|/(?:Users|home)/[A-Za-z0-9._ -]+/|(?<!\\)\\\\[A-Za-z0-9][A-Za-z0-9._-]*\\[A-Za-z0-9$][A-Za-z0-9$._ -]*)'
    },
    @{
        Label = "credential-like value"
        Pattern = '(?im)\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key|password|secret)\b\s*[:=]\s*["'']([A-Za-z0-9_./+=-]{12,})["'']|\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk_(?:live|test)_[A-Za-z0-9]{12,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
    }
)

$findings = [Collections.Generic.List[object]]::new()

function Add-Finding {
    param(
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)][string]$Path,
        [Parameter()][int]$Line = 0
    )

    $findings.Add([pscustomobject]@{
        Label = $Label
        Path = $Path
        Line = $Line
    })
}

foreach ($file in Get-ChildItem -LiteralPath $resolvedRoot -Recurse -File -Force) {
    if (-not $file.FullName.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Safety scan escaped the requested root: $($file.FullName)"
    }

    $relativePath = $file.FullName.Substring($rootPrefix.Length).Replace("\", "/")
    if ($relativePath -match $excludedPathPattern -or $relativePath -match $safetyToolPattern) {
        continue
    }

    if ($relativePath -match $privateDocumentationPattern) {
        Add-Finding -Label "private documentation" -Path $relativePath
    }

    foreach ($rule in $contentRules) {
        if ($relativePath -match $rule.Pattern) {
            Add-Finding -Label $rule.Label -Path $relativePath
        }
    }

    $isKnownExtensionlessText = $relativePath -match '(?i)(?:^|/)(?:Dockerfile|Makefile|LICENSE|\.gitignore|\.npmrc|\.env\.example)$'
    if (-not $textExtensions.Contains($file.Extension) -and -not $isKnownExtensionlessText) {
        continue
    }

    $content = [IO.File]::ReadAllText($file.FullName)
    foreach ($rule in $contentRules) {
        foreach ($match in [regex]::Matches($content, $rule.Pattern)) {
            $line = 1 + [regex]::Matches($content.Substring(0, $match.Index), "`n").Count
            Add-Finding -Label $rule.Label -Path $relativePath -Line $line
        }
    }
}

if ($findings.Count -gt 0) {
    Write-Host "Public safety scan failed with $($findings.Count) finding(s)."
    foreach ($finding in $findings | Sort-Object Path, Line, Label -Unique) {
        $location = if ($finding.Line -gt 0) { "$($finding.Path):$($finding.Line)" } else { $finding.Path }
        Write-Host "  [$($finding.Label)] $location"
    }
    throw "Public safety scan failed."
}

Write-Host "Public safety scan passed: $resolvedRoot"
