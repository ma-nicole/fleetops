$base = 'http://127.0.0.1:8000'
Write-Output 'GET /docs'
try {
    $r = Invoke-WebRequest -Uri "$base/docs" -UseBasicParsing
    Write-Output $r.StatusCode
} catch {
    Write-Output "Error: $_"
}

Write-Output "\nPOST /api/auth/register (invalid)"
$body = @{
    email = 'smoke_invalid@example.com'
    password = 'short'
    full_name = 'Sm'
} | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "$base/api/auth/register" -Method Post -Body $body -ContentType 'application/json' -UseBasicParsing
    Write-Output $r.StatusCode
    Write-Output $r.Content
} catch {
    Write-Output $_.Exception.Response.StatusCode.Value__
    if ($_.Exception.Response) {
        $resp = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output $resp.ReadToEnd()
    }
}

Write-Output "\nPOST /api/auth/register (valid)"
$body = @{
    email = 'smoke_test_user@example.com'
    password = 'strongpassword123'
    full_name = 'Smoke Test User'
} | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "$base/api/auth/register" -Method Post -Body $body -ContentType 'application/json' -UseBasicParsing
    Write-Output $r.StatusCode
    Write-Output $r.Content
} catch {
    Write-Output $_.Exception.Response.StatusCode.Value__
    if ($_.Exception.Response) {
        $resp = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output $resp.ReadToEnd()
    }
}

Write-Output "\nPOST /api/auth/login (form)"
$pair = @{ username = 'smoke_test_user@example.com'; password = 'strongpassword123' }
$body = ($pair.GetEnumerator() | ForEach-Object { $_.Key + '=' + [System.Web.HttpUtility]::UrlEncode($_.Value) }) -join '&'
try {
    $r = Invoke-WebRequest -Uri "$base/api/auth/login" -Method Post -Body $body -ContentType 'application/x-www-form-urlencoded' -UseBasicParsing
    Write-Output $r.StatusCode
    Write-Output $r.Content
    $token = ($r.Content | ConvertFrom-Json).access_token
} catch {
    Write-Output 'Login failed'
    Write-Output $_.Exception.Response.StatusCode.Value__
    if ($_.Exception.Response) {
        $resp = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output $resp.ReadToEnd()
    }
    exit 1
}

Write-Output "\nPOST /api/bookings (invalid payload)"
$headers = @{ Authorization = "Bearer $token" }
$body = @{
    pickup_location = 'A'
    dropoff_location = 'B'
    service_type = 'fixed'
    scheduled_date = '2026-05-02'
    cargo_weight_tons = -5
} | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "$base/api/bookings" -Method Post -Body $body -Headers $headers -ContentType 'application/json' -UseBasicParsing
    Write-Output $r.StatusCode
    Write-Output $r.Content
} catch {
    Write-Output $_.Exception.Response.StatusCode.Value__
    if ($_.Exception.Response) {
        $resp = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output $resp.ReadToEnd()
    }
}

Write-Output "\nPOST /api/bookings (valid payload)"
$body = @{
    pickup_location = 'Warehouse 1'
    dropoff_location = 'Warehouse 2'
    service_type = 'fixed'
    scheduled_date = '2026-05-02'
    cargo_weight_tons = 2.5
} | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "$base/api/bookings" -Method Post -Body $body -Headers $headers -ContentType 'application/json' -UseBasicParsing
    Write-Output $r.StatusCode
    Write-Output $r.Content
} catch {
    Write-Output $_.Exception.Response.StatusCode.Value__
    if ($_.Exception.Response) {
        $resp = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output $resp.ReadToEnd()
    }
}

Write-Output "\nDone"
