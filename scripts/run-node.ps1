# Load environment variables from .env
$envFile = Join-Path (Get-Location) ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()

        # Ignore blank lines and comments
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split "=", 2

            if ($parts.Count -eq 2) {
                $name = $parts[0].Trim()
                $value = $parts[1].Trim()

                # Remove surrounding quotes if present
                if (
                    ($value.StartsWith('"') -and $value.EndsWith('"')) -or
                    ($value.StartsWith("'") -and $value.EndsWith("'"))
                ) {
                    $value = $value.Substring(1, $value.Length - 2)
                }

                Set-Item -Path "Env:$name" -Value $value
            }
        }
    }

    Write-Host "[run-node] Loaded environment variables from .env"
} else {
    Write-Warning "[run-node] .env file not found"
}

$nodeItem = Get-ChildItem "C:\Users\PC\AppData\Local\OpenAI\Codex\runtimes\cua_node\*\bin\node.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$nodeExe = if ($nodeItem) { $nodeItem.FullName } else { $null }

if (-not $nodeExe -or -not (Test-Path $nodeExe)) {
    $env:ELECTRON_RUN_AS_NODE = "1"
    $nodeExe = "C:\Users\PC\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe"
}

& $nodeExe @args