param(
  [string]$ProjectPath = "E:\Workspace\codex\Introduction to Classical Music",
  [switch]$PrintOnly
)

$ErrorActionPreference = "Stop"

function Get-NormalizedProjectPath([string]$PathValue) {
  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    throw "Project path is empty."
  }

  $candidate = $PathValue.Trim()
  if ($candidate.StartsWith("Microsoft.PowerShell.Core\FileSystem::", [System.StringComparison]::OrdinalIgnoreCase)) {
    $candidate = $candidate.Substring("Microsoft.PowerShell.Core\FileSystem::".Length)
  }

  if ($candidate.StartsWith("\\?\")) {
    $candidate = $candidate.Substring(4)
  }

  return [System.IO.Path]::GetFullPath($candidate)
}

$normalized = Get-NormalizedProjectPath $ProjectPath

if (-not (Test-Path -LiteralPath $normalized)) {
  throw "Normalized path does not exist: $normalized"
}

if ($PrintOnly) {
  Write-Output $normalized
  exit 0
}

Set-Location -LiteralPath $normalized
Write-Host "Normalized location: $normalized"
Write-Host "Current location: $((Get-Location).Path)"
