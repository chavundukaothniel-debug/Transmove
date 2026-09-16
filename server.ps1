$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "TransMove Server running at http://localhost:$port" -ForegroundColor Green

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($urlPath)) {
            $urlPath = "index.html"
        }

        # Route Netlify serverless functions locally
        if ($urlPath -match "^\.netlify/functions/trusted-api" -or $urlPath -match "^api/trusted-api") {
            $bodyStr = ""
            if ($request.HasEntityBody) {
                $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                $bodyStr = $reader.ReadToEnd()
                $reader.Close()
            }
            $authHeader = $request.Headers["Authorization"]
            if (-not $authHeader) { $authHeader = "" }
            $eventObj = @{
                httpMethod = $request.HttpMethod
                headers = @{
                    authorization = $authHeader
                    "content-type" = $request.Headers["Content-Type"]
                }
                body = $bodyStr
            } | ConvertTo-Json -Compress

            $nodeCmd = (Get-Command node -ErrorAction SilentlyContinue)?.Source
            if (-not $nodeCmd) {
                $fallbackNode = "C:\Users\PC\AppData\Local\OpenAI\Codex\runtimes\cua_node\b474a88d5d105afa\bin\node.exe"
                if (Test-Path $fallbackNode) { $nodeCmd = $fallbackNode }
            }
            $runnerPath = Join-Path (Get-Location) "scripts\run-trusted-api.js"
            $resJson = $eventObj | & $nodeCmd $runnerPath
            $resObj = $resJson | ConvertFrom-Json
            $response.StatusCode = $resObj.statusCode
            $response.ContentType = "application/json; charset=utf-8"
            if ($resObj.headers."Access-Control-Allow-Origin") {
                $response.AddHeader("Access-Control-Allow-Origin", $resObj.headers."Access-Control-Allow-Origin")
            }
            if ($resObj.headers."Access-Control-Allow-Headers") {
                $response.AddHeader("Access-Control-Allow-Headers", $resObj.headers."Access-Control-Allow-Headers")
            }
            if ($resObj.headers."Access-Control-Allow-Methods") {
                $response.AddHeader("Access-Control-Allow-Methods", $resObj.headers."Access-Control-Allow-Methods")
            }
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($resObj.body)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.OutputStream.Close()
            continue
        }
        
        $filePath = Join-Path (Get-Location) $urlPath
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($ext) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                ".json" { $response.ContentType = "application/json; charset=utf-8" }
                ".png"  { $response.ContentType = "image/png" }
                ".jpg"  { $response.ContentType = "image/jpeg" }
                ".svg"  { $response.ContentType = "image/svg+xml" }
                default { $response.ContentType = "application/octet-stream" }
            }
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $err.Length
            $response.OutputStream.Write($err, 0, $err.Length)
        }
        $response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
}
