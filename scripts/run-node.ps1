# Helper to run scripts using the embedded Node v22 engine
$env:ELECTRON_RUN_AS_NODE = "1"
$nodeExe = "C:\Users\PC\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe"
& $nodeExe @args | Out-String | Write-Host -NoNewline
