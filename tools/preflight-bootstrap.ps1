param(
  [switch]$RunBuild,
  [switch]$RunTests,
  [switch]$CheckChrome,
  [string]$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
)

$ErrorActionPreference = "Continue"

function Write-Status([string]$Label, [bool]$Ok, [string]$Detail) {
  $prefix = if ($Ok) { "[PASS]" } else { "[FAIL]" }
  Write-Host "$prefix $Label - $Detail"
}

$userRgDir = Join-Path $HOME ".codex\bin"
$userRg = Join-Path $userRgDir "rg.exe"

if (Test-Path -LiteralPath $userRg) {
  $pathParts = $env:PATH -split ";"
  if ($pathParts[0] -ne $userRgDir) {
    $env:PATH = "$userRgDir;$env:PATH"
  }
  Write-Status "rg PATH priority" $true "Current session prepended $userRgDir"
} else {
  Write-Status "rg PATH priority" $false "Missing $userRg. Run rg self-heal first."
}

try {
  $nodeVersion = node -v
  Write-Status "Node.js" $true $nodeVersion
} catch {
  Write-Status "Node.js" $false $_.Exception.Message
}

try {
  $npmVersion = npm -v
  Write-Status "npm" $true $npmVersion
} catch {
  Write-Status "npm" $false $_.Exception.Message
}

try {
  $pythonVersion = python --version
  Write-Status "Python" $true $pythonVersion
} catch {
  Write-Status "Python" $false $_.Exception.Message
}

try {
  $rgVersion = rg --version | Select-Object -First 1
  Write-Status "rg" $true $rgVersion
} catch {
  Write-Status "rg" $false $_.Exception.Message
}

if ($CheckChrome) {
  $chromeExists = Test-Path -LiteralPath $ChromePath
  Write-Status "Chrome" $chromeExists $ChromePath
}

if ($RunBuild) {
  npm run runtime:build
  Write-Status "runtime:build" ($LASTEXITCODE -eq 0) "Exit code: $LASTEXITCODE"
}

if ($RunTests) {
  npm test
  Write-Status "npm test" ($LASTEXITCODE -eq 0) "Exit code: $LASTEXITCODE"
}
