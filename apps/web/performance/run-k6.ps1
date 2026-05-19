param(
  [Parameter(Mandatory = $true)]
  [string]$Script
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = Split-Path -Parent $scriptDir
$envFile = Join-Path $scriptDir ".env.k6"

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()

    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $parts = $line -split "=", 2
    if ($parts.Length -ne 2) {
      return
    }

    $name = $parts[0].Trim()
    $value = $parts[1].Trim()

    [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

$k6Command = Get-Command k6 -ErrorAction SilentlyContinue

if ($k6Command -and $k6Command.Source -and (Test-Path $k6Command.Source)) {
  $k6Path = $k6Command.Source
} elseif (Test-Path "C:\Program Files\k6\k6.exe") {
  $k6Path = "C:\Program Files\k6\k6.exe"
} else {
  throw "Unable to find k6. Install it first or add it to PATH."
}

$resolvedScript = Join-Path $workspaceDir $Script

if (-not (Test-Path $resolvedScript)) {
  throw "k6 script not found: $resolvedScript"
}

Push-Location $workspaceDir
try {
  & "$k6Path" "run" "$resolvedScript"
} finally {
  Pop-Location
}
