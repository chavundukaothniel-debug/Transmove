$SUPABASE_URL = "https://mhghjurlwmgeiuhcxieg.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZ2hqdXJsd21nZWl1aGN4aWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTczNjgsImV4cCI6MjEwNDk3MzM2OH0.ZkI-ZdrZq-KSCQDEJCEJZ5RoJVK7XGSSzvzNgJu7Ui4"

$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

Write-Host "=== STARTING TRANSMOVE MARKETPLACE FULL LIFECYCLE TEST ==="

# 1. Fetch active profiles
$profiles = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/profiles?select=*" -Headers $headers -Method Get
Write-Host "Fetched $($profiles.Count) user profiles from Supabase."

$passenger = $profiles | Where-Object { $_.role -eq "customer" -or $_.role -eq "passenger" } | Select-Object -First 1
if (-not $passenger) { $passenger = $profiles[0] }

$driver1 = $profiles | Where-Object { $_.role -eq "driver" -or $_.role -eq "owner" } | Select-Object -First 1
if (-not $driver1) { $driver1 = $profiles[1] }

$driver2 = $profiles | Where-Object { $_.id -ne $driver1.id } | Select-Object -First 1

Write-Host "Passenger User: $($passenger.full_name) ($($passenger.id))"
Write-Host "Driver User 1: $($driver1.full_name) ($($driver1.id))"
Write-Host "Driver User 2: $($driver2.full_name) ($($driver2.id))"

# STEP 1: PASSENGER CREATES REQUEST
Write-Host "`n--- STEP 1: Passenger Creates Request ---"
$reqBody = @{
    customer_id = $passenger.id
    request_type = "ride"
    pickup_address = "123 Samora Machel Ave, Harare"
    pickup_lat = -17.8252
    pickup_lng = 31.0335
    destination_address = "Avondale Shopping Centre, Harare"
    dest_lat = -17.7981
    dest_lng = 31.0425
    estimated_distance_km = 4.5
    estimated_duration_mins = 12
    suggested_price = 15.00
    currency = "USD"
    notes = "Passenger lifecycle test request"
    status = "searching"
} | ConvertTo-Json

$createdReq = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/ride_requests" -Headers $headers -Method Post -Body $reqBody
$createdRequest = $createdReq[0]

Write-Host "✅ [CREATED RECORD] public.ride_requests ID: $($createdRequest.id)"
Write-Host "   Status: $($createdRequest.status.ToUpper()) (REQUESTED)"
Write-Host "   Route: $($createdRequest.pickup_address) -> $($createdRequest.destination_address)"
Write-Host "   Price: `$$($createdRequest.suggested_price)"

# STEP 2: PROVIDER 1 SENDS QUOTATION
Write-Host "`n--- STEP 2: Provider 1 Sends Quotation ---"
$offer1Body = @{
    request_id = $createdRequest.id
    driver_id = $driver1.id
    proposed_price = 15.00
    currency = "USD"
    estimated_arrival_mins = 8
    message = "Ready to pick up in 8 minutes with clean sedan."
    status = "pending"
} | ConvertTo-Json

$offer1Arr = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/offers" -Headers $headers -Method Post -Body $offer1Body
$offer1Data = $offer1Arr[0]

Write-Host "✅ [CREATED RECORD] public.offers ID: $($offer1Data.id)"
Write-Host "   Driver: $($driver1.full_name), Price: `$$($offer1Data.proposed_price), Status: PENDING"

# Update request status to offers_received / QUOTED
$patchHeaders = @{ "apikey" = $SUPABASE_KEY; "Authorization" = "Bearer $SUPABASE_KEY"; "Content-Type" = "application/json" }
$reqPatchBody = @{ status = "offers_received"; updated_at = (Get-Date).ToString("o") } | ConvertTo-Json
Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/ride_requests?id=eq.$($createdRequest.id)" -Headers $patchHeaders -Method Patch -Body $reqPatchBody | Out-Null
Write-Host "✅ [UPDATED RECORD] public.ride_requests ID: $($createdRequest.id) -> Status: QUOTED (offers_received)"

# STEP 3: PROVIDER 2 SENDS SECOND QUOTATION
Write-Host "`n--- STEP 3: Provider 2 Sends Second Quotation ---"
$offer2Body = @{
    request_id = $createdRequest.id
    driver_id = $driver2.id
    proposed_price = 18.00
    currency = "USD"
    estimated_arrival_mins = 5
    message = "Premium luxury SUV arriving in 5 mins."
    status = "pending"
} | ConvertTo-Json

$offer2Arr = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/offers" -Headers $headers -Method Post -Body $offer2Body
$offer2Data = $offer2Arr[0]

Write-Host "✅ [CREATED RECORD] public.offers ID: $($offer2Data.id)"
Write-Host "   Driver: $($driver2.full_name), Price: `$$($offer2Data.proposed_price), Status: PENDING"

# STEP 4: PASSENGER ACCEPTS ONE QUOTATION & SINGLE-PROVIDER LOCK
Write-Host "`n--- STEP 4: Passenger Accepts Quotation (Single-Provider Lock) ---"
# Accept Offer 1
$offer1Patch = @{ status = "accepted"; updated_at = (Get-Date).ToString("o") } | ConvertTo-Json
Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/offers?id=eq.$($offer1Data.id)" -Headers $patchHeaders -Method Patch -Body $offer1Patch | Out-Null
Write-Host "✅ [UPDATED RECORD] public.offers ID: $($offer1Data.id) -> Status: ACCEPTED"

# Reject/close other offers for this request
$offer2Patch = @{ status = "rejected"; updated_at = (Get-Date).ToString("o") } | ConvertTo-Json
Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/offers?request_id=eq.$($createdRequest.id)&id=neq.$($offer1Data.id)" -Headers $patchHeaders -Method Patch -Body $offer2Patch | Out-Null
Write-Host "✅ [UPDATED RECORD] public.offers ID: $($offer2Data.id) -> Status: REJECTED (Closed/Declined)"

# Update request status to ACCEPTED
$reqAcceptedPatch = @{ status = "accepted"; accepted_offer_id = $offer1Data.id; updated_at = (Get-Date).ToString("o") } | ConvertTo-Json
Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/ride_requests?id=eq.$($createdRequest.id)" -Headers $patchHeaders -Method Patch -Body $reqAcceptedPatch | Out-Null
Write-Host "✅ [UPDATED RECORD] public.ride_requests ID: $($createdRequest.id) -> Status: ACCEPTED"

# Create confirmed booking
$bookingBody = @{
    request_id = $createdRequest.id
    offer_id = $offer1Data.id
    customer_id = $passenger.id
    driver_id = $driver1.id
    final_price = $offer1Data.proposed_price
    currency = $offer1Data.currency
    trip_pin = "7492"
    status = "confirmed"
} | ConvertTo-Json

$bookArr = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/bookings" -Headers $headers -Method Post -Body $bookingBody
$bookingData = $bookArr[0]

Write-Host "✅ [CREATED RECORD] public.bookings ID: $($bookingData.id)"
Write-Host "   Assigned Provider: $($driver1.full_name), Final Fare: `$$($bookingData.final_price), Status: CONFIRMED (ACCEPTED)"

# Create notification for driver
$notifBody = @{
    user_id = $driver1.id
    title = "Quotation Accepted! 🎉"
    body = "Passenger accepted your quotation of `$15.00. Start trip when ready."
    type = "offer_accepted"
    reference_id = $bookingData.id
} | ConvertTo-Json
Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/notifications" -Headers $headers -Method Post -Body $notifBody | Out-Null
Write-Host "✅ [CREATED RECORD] public.notifications for Provider $($driver1.full_name)"

# STEP 5: PROVIDER STARTS JOB
Write-Host "`n--- STEP 5: Provider Starts Job (In Progress) ---"
$bookingStartPatch = @{ status = "in_progress"; start_time = (Get-Date).ToString("o"); updated_at = (Get-Date).ToString("o") } | ConvertTo-Json
Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/bookings?id=eq.$($bookingData.id)" -Headers $patchHeaders -Method Patch -Body $bookingStartPatch | Out-Null
Write-Host "✅ [UPDATED RECORD] public.bookings ID: $($bookingData.id) -> Status: IN_PROGRESS"

$eventBody = @{ booking_id = $bookingData.id; actor_id = $driver1.id; status = "in_progress"; notes = "PIN verified by driver. Trip started." } | ConvertTo-Json
Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/trip_events" -Headers $headers -Method Post -Body $eventBody | Out-Null
Write-Host "✅ [CREATED RECORD] public.trip_events logged for Booking $($bookingData.id)"

# STEP 6: PROVIDER COMPLETES JOB
Write-Host "`n--- STEP 6: Provider Completes Job ---"
$bookingCompletePatch = @{ status = "completed"; completed_time = (Get-Date).ToString("o"); updated_at = (Get-Date).ToString("o") } | ConvertTo-Json
Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/bookings?id=eq.$($bookingData.id)" -Headers $patchHeaders -Method Patch -Body $bookingCompletePatch | Out-Null
Write-Host "✅ [UPDATED RECORD] public.bookings ID: $($bookingData.id) -> Status: COMPLETED"

$reqCompletePatch = @{ status = "completed"; updated_at = (Get-Date).ToString("o") } | ConvertTo-Json
Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/ride_requests?id=eq.$($createdRequest.id)" -Headers $patchHeaders -Method Patch -Body $reqCompletePatch | Out-Null
Write-Host "✅ [UPDATED RECORD] public.ride_requests ID: $($createdRequest.id) -> Status: COMPLETED"

# STEP 7: PASSENGER REVIEWS AND RATES PROVIDER
Write-Host "`n--- STEP 7: Passenger Reviews & Rates Provider ---"
$reviewBody = @{
    booking_id = $bookingData.id
    reviewer_id = $passenger.id
    reviewee_id = $driver1.id
    rating = 5
    comment = "Excellent, prompt and friendly driver service!"
} | ConvertTo-Json

$reviewArr = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/reviews" -Headers $headers -Method Post -Body $reviewBody
$reviewData = $reviewArr[0]

Write-Host "✅ [CREATED RECORD] public.reviews ID: $($reviewData.id)"
Write-Host "   Reviewer: $($passenger.full_name) -> Reviewee: $($driver1.full_name), Rating: 5/5 Stars"

Write-Host "`n=== FULL TRANSMOVE MARKETPLACE LIFECYCLE COMPLETED SUCCESSFULLY! ==="
