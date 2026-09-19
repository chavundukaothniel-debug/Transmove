$nodeExe = "C:\Users\PC\AppData\Local\OpenAI\Codex\runtimes\cua_node\b474a88d5d105afa\bin\node.exe"
if (-not (Test-Path $nodeExe)) {
    $env:ELECTRON_RUN_AS_NODE = "1"
    $nodeExe = "C:\Users\PC\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe"
}
& $nodeExe @args
