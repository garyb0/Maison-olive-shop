param(
  [string]$ConfigPath = "$PSScriptRoot\cloudflare-ddns.env"
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Config file not found: $Path. Copy cloudflare-ddns.env.example to cloudflare-ddns.env and fill CLOUDFLARE_API_TOKEN."
  }

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $parts = $trimmed.Split("=", 2)
    if ($parts.Count -eq 2) {
      $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"')
    }
  }

  return $values
}

function Invoke-CloudflareApi {
  param(
    [string]$Method,
    [string]$Uri,
    [string]$Token,
    [object]$Body = $null
  )

  $headers = @{
    Authorization = "Bearer $Token"
    "Content-Type" = "application/json"
  }

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
  }

  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -Body ($Body | ConvertTo-Json -Depth 8)
}

$config = Read-DotEnv -Path $ConfigPath
$token = $config["CLOUDFLARE_API_TOKEN"]
$zoneName = $config["CLOUDFLARE_ZONE_NAME"]
$recordsValue = ""
if ($config.ContainsKey("CLOUDFLARE_RECORDS")) {
  $recordsValue = $config["CLOUDFLARE_RECORDS"]
}

$proxiedValue = "false"
if ($config.ContainsKey("CLOUDFLARE_PROXIED")) {
  $proxiedValue = $config["CLOUDFLARE_PROXIED"]
}

$recordNames = $recordsValue.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
$proxied = $proxiedValue.ToLowerInvariant() -eq "true"

if (-not $token -or $token -eq "colle-ton-token-ici") {
  throw "CLOUDFLARE_API_TOKEN is missing in $ConfigPath."
}

if (-not $zoneName) {
  throw "CLOUDFLARE_ZONE_NAME is missing in $ConfigPath."
}

if ($recordNames.Count -eq 0) {
  throw "CLOUDFLARE_RECORDS is missing in $ConfigPath."
}

$publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org?format=text").Trim()
if ($publicIp -notmatch "^\d{1,3}(\.\d{1,3}){3}$") {
  throw "Unable to resolve a valid public IPv4 address. Got: $publicIp"
}

$baseUri = "https://api.cloudflare.com/client/v4"
$zoneResponse = Invoke-CloudflareApi -Method "GET" -Uri "$baseUri/zones?name=$zoneName" -Token $token
$zone = $zoneResponse.result | Select-Object -First 1
if (-not $zone) {
  throw "Cloudflare zone not found for $zoneName."
}

foreach ($recordName in $recordNames) {
  $recordResponse = Invoke-CloudflareApi -Method "GET" -Uri "$baseUri/zones/$($zone.id)/dns_records?type=A&name=$recordName" -Token $token
  $record = $recordResponse.result | Select-Object -First 1

  $payload = @{
    type = "A"
    name = $recordName
    content = $publicIp
    ttl = 1
    proxied = $proxied
  }

  if ($record) {
    if ($record.content -eq $publicIp -and [bool]$record.proxied -eq $proxied) {
      Write-Host "No change: $recordName already points to $publicIp."
      continue
    }

    Invoke-CloudflareApi -Method "PUT" -Uri "$baseUri/zones/$($zone.id)/dns_records/$($record.id)" -Token $token -Body $payload | Out-Null
    Write-Host "Updated: $recordName -> $publicIp."
  } else {
    Invoke-CloudflareApi -Method "POST" -Uri "$baseUri/zones/$($zone.id)/dns_records" -Token $token -Body $payload | Out-Null
    Write-Host "Created: $recordName -> $publicIp."
  }
}
