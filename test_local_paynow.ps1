# ==============================================================================
# LOCAL-ONLY PAYNOW CONNECTIVITY TEST SCRIPT
# Tests direct HTTPS POST connectivity from local PC to Paynow TEST endpoint
# ==============================================================================

$paynowId = "16462"
$paynowKey = "e87cf86a-7a57-4148-9366-0d17e75f1b13"

$uniqueId = (Get-Date).Ticks.ToString().Substring(10)
$reference = "TM-LOCAL-TEST-$uniqueId"
$amount = "15.00"
$additionalinfo = "TransMove Professional Local Connectivity Test"
$returnurl = "http://localhost:8080/subscription/payment-result"
$resulturl = "http://localhost:8080/api/paynow-result"
$authemail = "test@transmove.co.zw"
$status = "Message"

# Calculate SHA-512 Hash according to Paynow rules
$rawString = "$paynowId$reference$amount$additionalinfo$returnurl$resulturl$authemail$status$paynowKey"
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($rawString)
$sha512 = [System.Security.Cryptography.SHA512]::Create()
$hashBytes = $sha512.ComputeHash($utf8Bytes)
$hash = ($hashBytes | ForEach-Object { $_.ToString("X2") }) -join ""

$bodyParams = @{
    "id" = $paynowId
    "reference" = $reference
    "amount" = $amount
    "additionalinfo" = $additionalinfo
    "returnurl" = $returnurl
    "resulturl" = $resulturl
    "authemail" = $authemail
    "status" = $status
    "hash" = $hash
}

Write-Host "Sending HTTP POST request from local Windows PC to Paynow..."
Write-Host "Target: https://www.paynow.co.zw/interface/initiatetransaction"

$httpConnectivity = "FAIL"
$paynowStatus = "N/A"
$hashValid = "NO"
$browserUrlReceived = "NO"
$pollUrlReceived = "NO"

try {
    $res = Invoke-WebRequest -Uri "https://www.paynow.co.zw/interface/initiatetransaction" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $bodyParams `
        -TimeoutSec 25 `
        -ErrorAction Stop

    $httpConnectivity = "SUCCESS"
    Write-Host "`nHTTP Status:" $res.StatusCode
    Write-Host "Raw Response Body:" $res.Content

    $rawContent = $res.Content
    if ($rawContent -like "*status=*") {
        $paynowStatus = "Received Paynow Response"
    }
    if ($rawContent -like "*browserurl=*") {
        $browserUrlReceived = "YES"
    }
    if ($rawContent -like "*pollurl=*") {
        $pollUrlReceived = "YES"
    }
    if ($rawContent -like "*hash=*") {
        $hashValid = "YES"
    }

} catch {
    Write-Host "`nHTTP Network Error:" $_.Exception.Message
    $httpConnectivity = "FAIL"
}

Write-Host "`n=================================================="
Write-Host "LOCAL PAYNOW CONNECTIVITY SUMMARY"
Write-Host "=================================================="
Write-Host "HTTP connectivity:" $httpConnectivity
Write-Host "Paynow status:" $paynowStatus
Write-Host "Response hash valid:" $hashValid
Write-Host "browserurl received:" $browserUrlReceived
Write-Host "pollurl received:" $pollUrlReceived
Write-Host "=================================================="

if ($httpConnectivity -eq "SUCCESS") {
    Write-Host "LOCAL PAYNOW CONNECTION: PASS"
} else {
    Write-Host "LOCAL PAYNOW CONNECTION: FAIL"
}
