$SUPABASE_URL = "https://mhghjurlwmgeiuhcxieg.supabase.co"
$token = (Get-Content -Path "$env:TEMP\driver_token.txt" -Raw).Trim()

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "Calling deployed Edge Function paynow-create-subscription..."

try {
    $res = Invoke-WebRequest -Uri "$SUPABASE_URL/functions/v1/paynow-create-subscription" -Headers $headers -Method Post -Body "{}" -TimeoutSec 30 -ErrorAction Stop
    Write-Host "`n--- HTTP RESPONSE ---"
    Write-Host "HTTP Status:" $res.StatusCode
    Write-Host "Response Body:" $res.Content
} catch {
    Write-Host "`n--- HTTP RESPONSE ERROR ---"
    if ($_.Exception.Response) {
        $status = [int]$_.Exception.Response.StatusCode
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "HTTP Status:" $status
        Write-Host "Response Body:" $body
    } else {
        Write-Host "Network/Timeout Error:" $_.Exception.Message
    }
}
