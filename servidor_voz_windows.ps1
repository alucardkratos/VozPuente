# Servidor local de texto a voz para Windows 10/11.
# Usa un socket TCP limitado a 127.0.0.1 para no requerir permisos de administrador.

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Video a Español - Voz Windows"

try {
    Add-Type -AssemblyName System.Speech
} catch {
    Write-Host "No se pudo cargar System.Speech." -ForegroundColor Red
    Write-Host "Ejecuta este archivo con Windows PowerShell 5.1, no con PowerShell 7." -ForegroundColor Yellow
    Read-Host "Presiona ENTER para cerrar"
    exit 1
}

function Get-VoiceInventory {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
        $defaultVoice = $synth.Voice.Name
        $voices = @(
            $synth.GetInstalledVoices() |
                Where-Object { $_.Enabled } |
                ForEach-Object {
                    $info = $_.VoiceInfo
                    [PSCustomObject]@{
                        name = $info.Name
                        culture = $info.Culture.Name
                        gender = $info.Gender.ToString()
                        age = $info.Age.ToString()
                    }
                }
        )
        return [PSCustomObject]@{
            engine = "Windows SAPI"
            default = $defaultVoice
            voices = $voices
        }
    } finally {
        $synth.Dispose()
    }
}

function Find-HeaderEnd {
    param([byte[]] $Bytes)
    for ($index = 0; $index -le $Bytes.Length - 4; $index++) {
        if ($Bytes[$index] -eq 13 -and $Bytes[$index + 1] -eq 10 -and
            $Bytes[$index + 2] -eq 13 -and $Bytes[$index + 3] -eq 10) {
            return $index
        }
    }
    return -1
}

function Read-HttpRequest {
    param([System.Net.Sockets.NetworkStream] $Stream)

    $memory = New-Object System.IO.MemoryStream
    $buffer = New-Object byte[] 8192
    $headerEnd = -1
    $raw = $null

    try {
        while ($headerEnd -lt 0) {
            $read = $Stream.Read($buffer, 0, $buffer.Length)
            if ($read -le 0) { throw "La conexión se cerró antes de recibir la solicitud." }
            $memory.Write($buffer, 0, $read)
            if ($memory.Length -gt 131072) { throw "Los encabezados de la solicitud son demasiado grandes." }
            $raw = $memory.ToArray()
            $headerEnd = Find-HeaderEnd -Bytes $raw
        }
    } finally {
        $memory.Dispose()
    }

    $headerText = [System.Text.Encoding]::ASCII.GetString($raw, 0, $headerEnd)
    $lines = $headerText -split "`r`n"
    $requestParts = $lines[0] -split " ", 3
    if ($requestParts.Count -lt 2) { throw "Solicitud HTTP inválida." }

    $headers = @{}
    for ($lineIndex = 1; $lineIndex -lt $lines.Count; $lineIndex++) {
        $line = $lines[$lineIndex]
        $colon = $line.IndexOf(":")
        if ($colon -gt 0) {
            $name = $line.Substring(0, $colon).Trim().ToLowerInvariant()
            $value = $line.Substring($colon + 1).Trim()
            $headers[$name] = $value
        }
    }

    $contentLength = 0
    if ($headers.ContainsKey("content-length")) {
        if (-not [int]::TryParse($headers["content-length"], [ref]$contentLength)) {
            throw "Content-Length inválido."
        }
    }
    if ($contentLength -lt 0 -or $contentLength -gt 131072) {
        throw "El cuerpo de la solicitud es demasiado grande."
    }

    $body = New-Object byte[] $contentLength
    $bodyStart = $headerEnd + 4
    $available = [Math]::Max(0, $raw.Length - $bodyStart)
    $copied = [Math]::Min($available, $contentLength)
    if ($copied -gt 0) {
        [Array]::Copy($raw, $bodyStart, $body, 0, $copied)
    }

    while ($copied -lt $contentLength) {
        $read = $Stream.Read($body, $copied, $contentLength - $copied)
        if ($read -le 0) { throw "La conexión se cerró antes de recibir el texto completo." }
        $copied += $read
    }

    return [PSCustomObject]@{
        Method = $requestParts[0].ToUpperInvariant()
        Target = $requestParts[1]
        Headers = $headers
        Body = $body
    }
}

function Get-QueryParameters {
    param([string] $Query)
    $values = @{}
    if ([string]::IsNullOrWhiteSpace($Query)) { return $values }

    foreach ($pair in $Query.TrimStart("?") -split "&") {
        if ([string]::IsNullOrWhiteSpace($pair)) { continue }
        $parts = $pair -split "=", 2
        $key = [Uri]::UnescapeDataString(($parts[0] -replace "\+", " "))
        $value = ""
        if ($parts.Count -gt 1) {
            $value = [Uri]::UnescapeDataString(($parts[1] -replace "\+", " "))
        }
        $values[$key] = $value
    }
    return $values
}

function Write-HttpResponse {
    param(
        [System.Net.Sockets.NetworkStream] $Stream,
        [int] $StatusCode,
        [string] $ContentType,
        [byte[]] $Body,
        [hashtable] $ExtraHeaders = @{}
    )

    $reason = switch ($StatusCode) {
        200 { "OK" }
        204 { "No Content" }
        400 { "Bad Request" }
        404 { "Not Found" }
        405 { "Method Not Allowed" }
        413 { "Payload Too Large" }
        default { "Internal Server Error" }
    }

    if ($null -eq $Body) { $Body = New-Object byte[] 0 }
    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append("HTTP/1.1 $StatusCode $reason`r`n")
    [void]$builder.Append("Content-Type: $ContentType`r`n")
    [void]$builder.Append("Content-Length: $($Body.Length)`r`n")
    [void]$builder.Append("Access-Control-Allow-Origin: *`r`n")
    [void]$builder.Append("Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n")
    [void]$builder.Append("Access-Control-Allow-Headers: Content-Type`r`n")
    [void]$builder.Append("Access-Control-Expose-Headers: X-Voice-Used`r`n")
    [void]$builder.Append("Cache-Control: no-store`r`n")
    foreach ($name in $ExtraHeaders.Keys) {
        [void]$builder.Append("$name`: $($ExtraHeaders[$name])`r`n")
    }
    [void]$builder.Append("Connection: close`r`n`r`n")

    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($builder.ToString())
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
    $Stream.Flush()
}

function Write-JsonResponse {
    param(
        [System.Net.Sockets.NetworkStream] $Stream,
        [object] $Value,
        [int] $StatusCode = 200
    )
    $json = $Value | ConvertTo-Json -Depth 6 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    Write-HttpResponse -Stream $Stream -StatusCode $StatusCode -ContentType "application/json; charset=utf-8" -Body $bytes
}

function Write-JsonError {
    param(
        [System.Net.Sockets.NetworkStream] $Stream,
        [string] $Message,
        [int] $StatusCode = 500
    )
    Write-JsonResponse -Stream $Stream -Value @{ error = $Message } -StatusCode $StatusCode
}

function Handle-Request {
    param(
        [object] $Request,
        [System.Net.Sockets.NetworkStream] $Stream
    )

    if ($Request.Method -eq "OPTIONS") {
        Write-HttpResponse -Stream $Stream -StatusCode 204 -ContentType "text/plain" -Body (New-Object byte[] 0)
        return
    }

    $uri = [System.Uri]::new("http://127.0.0.1" + $Request.Target)
    $path = $uri.AbsolutePath.ToLowerInvariant()
    $query = Get-QueryParameters -Query $uri.Query

    if ($path -eq "/" -or $path -eq "/health") {
        Write-JsonResponse -Stream $Stream -Value @{ ok = $true; engine = "Windows SAPI" }
        return
    }

    if ($path -eq "/voices") {
        if ($Request.Method -ne "GET") {
            Write-JsonError -Stream $Stream -Message "Método no permitido." -StatusCode 405
            return
        }
        Write-JsonResponse -Stream $Stream -Value (Get-VoiceInventory)
        return
    }

    if ($path -ne "/synthesize") {
        Write-JsonError -Stream $Stream -Message "Ruta no encontrada." -StatusCode 404
        return
    }
    if ($Request.Method -ne "POST") {
        Write-JsonError -Stream $Stream -Message "Usa POST para generar la voz." -StatusCode 405
        return
    }

    $text = [System.Text.Encoding]::UTF8.GetString($Request.Body)
    if ([string]::IsNullOrWhiteSpace($text)) {
        Write-JsonError -Stream $Stream -Message "El texto está vacío." -StatusCode 400
        return
    }
    if ($text.Length -gt 30000) {
        Write-JsonError -Stream $Stream -Message "El texto supera 30,000 caracteres." -StatusCode 413
        return
    }

    $rate = 0
    if ($query.ContainsKey("rate")) { $null = [int]::TryParse($query["rate"], [ref]$rate) }
    $rate = [Math]::Max(-10, [Math]::Min(10, $rate))

    $volume = 100
    if ($query.ContainsKey("volume")) { $null = [int]::TryParse($query["volume"], [ref]$volume) }
    $volume = [Math]::Max(0, [Math]::Min(100, $volume))

    $requestedVoice = ""
    if ($query.ContainsKey("voice")) { $requestedVoice = $query["voice"] }
    $tempFile = Join-Path $env:TEMP ("texto-video-voz-" + [Guid]::NewGuid().ToString("N") + ".wav")
    $synth = $null

    try {
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        if (-not [string]::IsNullOrWhiteSpace($requestedVoice)) { $synth.SelectVoice($requestedVoice) }
        $synth.Rate = $rate
        $synth.Volume = $volume
        $voiceUsed = $synth.Voice.Name
        $synth.SetOutputToWaveFile($tempFile)
        $synth.Speak($text)
        $synth.SetOutputToNull()
        $synth.Dispose()
        $synth = $null

        $audioBytes = [System.IO.File]::ReadAllBytes($tempFile)
        $headers = @{ "X-Voice-Used" = [Uri]::EscapeDataString($voiceUsed) }
        Write-HttpResponse -Stream $Stream -StatusCode 200 -ContentType "audio/wav" -Body $audioBytes -ExtraHeaders $headers
        Write-Host ((Get-Date -Format "HH:mm:ss") + "  Voz creada: " + $text.Length + " caracteres") -ForegroundColor DarkGray
    } finally {
        if ($null -ne $synth) { $synth.Dispose() }
        Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
    }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8765)
try {
    $listener.Start()
} catch {
    Write-Host "No se pudo iniciar el servidor local en el puerto 8765." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    Write-Host "Cierra otra copia de esta ventana si ya estaba abierta." -ForegroundColor Yellow
    Read-Host "Presiona ENTER para cerrar"
    exit 1
}

Clear-Host
Write-Host "====================================================" -ForegroundColor DarkCyan
Write-Host "  VIDEO A ESPAÑOL - VOZ WINDOWS ACTIVA" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor DarkCyan
Write-Host "Servidor local: http://127.0.0.1:8765" -ForegroundColor Green
Write-Host "No usa internet, no requiere administrador y no recibe conexiones externas." -ForegroundColor Gray
Write-Host "Deja esta ventana abierta mientras exportas." -ForegroundColor White
Write-Host "Para detener: cierra la ventana o presiona Ctrl+C." -ForegroundColor Gray
Write-Host ""

try {
    $inventory = Get-VoiceInventory
    Write-Host ("Voces encontradas: " + $inventory.voices.Count) -ForegroundColor Green
    foreach ($voice in $inventory.voices) {
        Write-Host (" - " + $voice.name + " [" + $voice.culture + "]") -ForegroundColor DarkGray
    }
    Write-Host ""
} catch {
    Write-Host "El servidor inició, pero no pude enumerar las voces." -ForegroundColor Yellow
}

try {
    while ($true) {
        $client = $null
        $stream = $null
        try {
            $client = $listener.AcceptTcpClient()
            $client.ReceiveTimeout = 15000
            $client.SendTimeout = 15000
            $stream = $client.GetStream()
            $request = Read-HttpRequest -Stream $stream
            Handle-Request -Request $request -Stream $stream
        } catch {
            if ($null -ne $stream) {
                try { Write-JsonError -Stream $stream -Message $_.Exception.Message -StatusCode 500 } catch { }
            }
            Write-Host ((Get-Date -Format "HH:mm:ss") + "  Error: " + $_.Exception.Message) -ForegroundColor Red
        } finally {
            if ($null -ne $stream) { try { $stream.Dispose() } catch { } }
            if ($null -ne $client) { try { $client.Close() } catch { } }
        }
    }
} finally {
    $listener.Stop()
}
