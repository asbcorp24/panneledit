param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$RootPrefix = $Root
if (-not $RootPrefix.EndsWith([System.IO.Path]::DirectorySeparatorChar.ToString())) {
    $RootPrefix += [System.IO.Path]::DirectorySeparatorChar
}

function Get-MimeType {
    param([string]$Path)

    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html' { 'text/html; charset=utf-8' }
        '.htm'  { 'text/html; charset=utf-8' }
        '.css'  { 'text/css; charset=utf-8' }
        '.js'   { 'application/javascript; charset=utf-8' }
        '.mjs'  { 'application/javascript; charset=utf-8' }
        '.json' { 'application/json; charset=utf-8' }
        '.txt'  { 'text/plain; charset=utf-8' }
        '.svg'  { 'image/svg+xml' }
        '.png'  { 'image/png' }
        '.jpg'  { 'image/jpeg' }
        '.jpeg' { 'image/jpeg' }
        '.webp' { 'image/webp' }
        '.gif'  { 'image/gif' }
        '.ico'  { 'image/x-icon' }
        '.woff' { 'font/woff' }
        '.woff2' { 'font/woff2' }
        '.ttf'  { 'font/ttf' }
        '.wasm' { 'application/wasm' }
        '.zip'  { 'application/zip' }
        default { 'application/octet-stream' }
    }
}

function Send-Headers {
    param(
        [System.IO.Stream]$Stream,
        [string]$Status,
        [hashtable]$Headers
    )

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append("HTTP/1.1 $Status`r`n")
    foreach ($key in $Headers.Keys) {
        [void]$builder.Append($key + ': ' + $Headers[$key] + "`r`n")
    }
    [void]$builder.Append("`r`n")

    $bytes = [System.Text.Encoding]::ASCII.GetBytes($builder.ToString())
    $Stream.Write($bytes, 0, $bytes.Length)
}

function Send-TextResponse {
    param(
        [System.IO.Stream]$Stream,
        [int]$Code,
        [string]$Reason,
        [string]$Text
    )

    $body = [System.Text.Encoding]::UTF8.GetBytes($Text)
    Send-Headers -Stream $Stream -Status "$Code $Reason" -Headers @{
        'Content-Type'   = 'text/html; charset=utf-8'
        'Content-Length' = $body.Length
        'Cache-Control'  = 'no-cache'
        'Connection'     = 'close'
    }
    $Stream.Write($body, 0, $body.Length)
}

function Resolve-RequestPath {
    param([string]$Target)

    $pathOnly = ($Target -split '\?', 2)[0]
    $decoded = [System.Uri]::UnescapeDataString($pathOnly)
    $relative = $decoded.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)

    if ([string]::IsNullOrWhiteSpace($relative)) {
        $relative = 'index.html'
    }

    $candidate = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, $relative))

    if (-not $candidate.StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and
        -not $candidate.Equals($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }

    if ([System.IO.Directory]::Exists($candidate)) {
        $candidate = [System.IO.Path]::Combine($candidate, 'index.html')
    }

    return $candidate
}

$listener = $null
$actualPort = $Port

for ($tryPort = $Port; $tryPort -le ($Port + 20); $tryPort++) {
    $candidate = $null
    try {
        $candidate = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $tryPort)
        $candidate.Start()
        $listener = $candidate
        $actualPort = $tryPort
        break
    }
    catch {
        if ($candidate) {
            try { $candidate.Stop() } catch {}
        }
    }
}

if (-not $listener) {
    Write-Host ''
    Write-Host "Не удалось открыть порты $Port-$($Port + 20)." -ForegroundColor Red
    Write-Host 'Закройте другой локальный сервер или укажите другой порт:' -ForegroundColor Yellow
    Write-Host '.\server.ps1 -Port 9000'
    exit 1
}

$url = "http://127.0.0.1:$actualPort/"

Write-Host ''
Write-Host '=============================================' -ForegroundColor DarkCyan
Write-Host '  Pannellum Tour Editor - локальный сервер' -ForegroundColor Cyan
Write-Host '=============================================' -ForegroundColor DarkCyan
Write-Host ''
Write-Host "Папка: $Root"
Write-Host "Адрес: $url" -ForegroundColor Green
if ($actualPort -ne $Port) {
    Write-Host "Порт $Port был занят, выбран $actualPort." -ForegroundColor Yellow
}
Write-Host ''
Write-Host 'Для остановки нажмите Ctrl+C.' -ForegroundColor DarkGray
Write-Host ''

if (-not $NoBrowser) {
    try {
        Start-Process $url
    }
    catch {
        Write-Host "Откройте адрес вручную: $url" -ForegroundColor Yellow
    }
}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $client.NoDelay = $true
        $stream = $client.GetStream()
        $reader = $null
        $fileStream = $null

        try {
            $reader = [System.IO.StreamReader]::new(
                $stream,
                [System.Text.Encoding]::ASCII,
                $false,
                8192,
                $true
            )

            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                continue
            }

            $parts = $requestLine.Split(' ')
            if ($parts.Length -lt 2) {
                Send-TextResponse -Stream $stream -Code 400 -Reason 'Bad Request' -Text '<h1>400 Bad Request</h1>'
                continue
            }

            $method = $parts[0].ToUpperInvariant()
            $target = $parts[1]

            $headers = @{}
            while ($true) {
                $line = $reader.ReadLine()
                if ([string]::IsNullOrEmpty($line)) {
                    break
                }

                $separator = $line.IndexOf(':')
                if ($separator -gt 0) {
                    $name = $line.Substring(0, $separator).Trim().ToLowerInvariant()
                    $value = $line.Substring($separator + 1).Trim()
                    $headers[$name] = $value
                }
            }

            if ($method -ne 'GET' -and $method -ne 'HEAD') {
                Send-Headers -Stream $stream -Status '405 Method Not Allowed' -Headers @{
                    'Allow'          = 'GET, HEAD'
                    'Content-Length' = 0
                    'Connection'     = 'close'
                }
                continue
            }

            try {
                $filePath = Resolve-RequestPath -Target $target
            }
            catch {
                $filePath = $null
            }

            if (-not $filePath) {
                Send-TextResponse -Stream $stream -Code 403 -Reason 'Forbidden' -Text '<h1>403 Forbidden</h1>'
                continue
            }

            if (-not [System.IO.File]::Exists($filePath)) {
                Send-TextResponse -Stream $stream -Code 404 -Reason 'Not Found' -Text '<h1>404 Not Found</h1>'
                continue
            }

            $fileInfo = [System.IO.FileInfo]::new($filePath)
            $totalLength = $fileInfo.Length
            $start = [int64]0
            $end = [int64]($totalLength - 1)
            $status = '200 OK'
            $contentLength = $totalLength
            $responseHeaders = @{
                'Content-Type'  = Get-MimeType -Path $filePath
                'Accept-Ranges' = 'bytes'
                'Cache-Control' = 'no-cache'
                'Connection'    = 'close'
            }

            if ($headers.ContainsKey('range') -and $headers['range'] -match '^bytes=(\d*)-(\d*)$') {
                $startText = $Matches[1]
                $endText = $Matches[2]

                if ($startText -ne '') {
                    $start = [int64]$startText
                }
                elseif ($endText -ne '') {
                    $suffixLength = [int64]$endText
                    $start = [Math]::Max([int64]0, $totalLength - $suffixLength)
                }

                if ($endText -ne '' -and $startText -ne '') {
                    $end = [Math]::Min([int64]$endText, $totalLength - 1)
                }

                if ($start -ge $totalLength -or $start -gt $end) {
                    Send-Headers -Stream $stream -Status '416 Range Not Satisfiable' -Headers @{
                        'Content-Range'  = "bytes */$totalLength"
                        'Content-Length' = 0
                        'Connection'     = 'close'
                    }
                    continue
                }

                $contentLength = $end - $start + 1
                $status = '206 Partial Content'
                $responseHeaders['Content-Range'] = "bytes $start-$end/$totalLength"
            }

            $responseHeaders['Content-Length'] = $contentLength
            Send-Headers -Stream $stream -Status $status -Headers $responseHeaders

            if ($method -eq 'HEAD' -or $contentLength -le 0) {
                continue
            }

            $fileStream = [System.IO.File]::Open(
                $filePath,
                [System.IO.FileMode]::Open,
                [System.IO.FileAccess]::Read,
                [System.IO.FileShare]::ReadWrite
            )

            if ($start -gt 0) {
                [void]$fileStream.Seek($start, [System.IO.SeekOrigin]::Begin)
            }

            $buffer = [byte[]]::new(65536)
            $remaining = [int64]$contentLength

            while ($remaining -gt 0) {
                $toRead = [int][Math]::Min([int64]$buffer.Length, $remaining)
                $read = $fileStream.Read($buffer, 0, $toRead)
                if ($read -le 0) {
                    break
                }

                $stream.Write($buffer, 0, $read)
                $remaining -= $read
            }
        }
        catch {
            try {
                if ($stream -and $stream.CanWrite) {
                    Send-TextResponse -Stream $stream -Code 500 -Reason 'Internal Server Error' -Text '<h1>500 Internal Server Error</h1>'
                }
            }
            catch {}
            Write-Host "Ошибка запроса: $($_.Exception.Message)" -ForegroundColor DarkYellow
        }
        finally {
            if ($fileStream) { $fileStream.Dispose() }
            if ($reader) { $reader.Dispose() }
            if ($stream) { $stream.Dispose() }
            if ($client) { $client.Close() }
        }
    }
}
finally {
    if ($listener) {
        $listener.Stop()
    }
}
