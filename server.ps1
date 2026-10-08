param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$Root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$Sep = [System.IO.Path]::DirectorySeparatorChar.ToString()
$RootPrefix = $Root
if (-not $RootPrefix.EndsWith($Sep)) {
    $RootPrefix += $Sep
}

function Get-MimeType {
    param([string]$Path)

    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html' { return 'text/html; charset=utf-8' }
        '.htm'  { return 'text/html; charset=utf-8' }
        '.css'  { return 'text/css; charset=utf-8' }
        '.js'   { return 'application/javascript; charset=utf-8' }
        '.mjs'  { return 'application/javascript; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.txt'  { return 'text/plain; charset=utf-8' }
        '.svg'  { return 'image/svg+xml' }
        '.png'  { return 'image/png' }
        '.jpg'  { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.webp' { return 'image/webp' }
        '.gif'  { return 'image/gif' }
        '.ico'  { return 'image/x-icon' }
        '.woff' { return 'font/woff' }
        '.woff2' { return 'font/woff2' }
        '.ttf'  { return 'font/ttf' }
        '.wasm' { return 'application/wasm' }
        '.zip'  { return 'application/zip' }
        '.stl'  { return 'model/stl' }
        '.webmanifest' { return 'application/manifest+json; charset=utf-8' }
        '.pdf'  { return 'application/pdf' }
        '.webm' { return 'video/webm' }
        '.mp4'  { return 'video/mp4' }
        '.wav'  { return 'audio/wav' }
        '.ogg'  { return 'audio/ogg' }
        '.mp3'  { return 'audio/mpeg' }
        default { return 'application/octet-stream' }
    }
}

function Send-Headers {
    param(
        [System.IO.Stream]$Stream,
        [string]$Status,
        [hashtable]$Headers
    )

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append("HTTP/1.1 $Status" + [char]13 + [char]10)

    foreach ($key in $Headers.Keys) {
        [void]$builder.Append($key + ': ' + $Headers[$key] + [char]13 + [char]10)
    }

    [void]$builder.Append([char]13 + [char]10)

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

    $candidate = [System.IO.Path]::GetFullPath(
        [System.IO.Path]::Combine($Root, $relative)
    )

    $insideRoot = (
        $candidate.Equals($Root, [System.StringComparison]::OrdinalIgnoreCase) -or
        $candidate.StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
    )

    if (-not $insideRoot) {
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
    $candidateListener = $null

    try {
        $candidateListener = [System.Net.Sockets.TcpListener]::new(
            [System.Net.IPAddress]::Loopback,
            $tryPort
        )
        $candidateListener.Start()

        $listener = $candidateListener
        $actualPort = $tryPort
        break
    }
    catch {
        if ($candidateListener) {
            try { $candidateListener.Stop() } catch {}
        }
    }
}

if (-not $listener) {
    Write-Host ''
    Write-Host "Unable to open ports $Port-$($Port + 20)." -ForegroundColor Red
    Write-Host 'Close another local server or run:' -ForegroundColor Yellow
    Write-Host '.\server.ps1 -Port 9000'
    exit 1
}

$url = "http://127.0.0.1:$actualPort/"

Write-Host ''
Write-Host '=============================================' -ForegroundColor DarkCyan
Write-Host '  XR Tour Editor - Local Windows Server' -ForegroundColor Cyan
Write-Host '=============================================' -ForegroundColor DarkCyan
Write-Host ''
Write-Host "Folder: $Root"
Write-Host "URL:    $url" -ForegroundColor Green

if ($actualPort -ne $Port) {
    Write-Host "Port $Port is busy. Using port $actualPort." -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Press Ctrl+C to stop the server.' -ForegroundColor DarkGray
Write-Host ''

if (-not $NoBrowser) {
    try {
        Start-Process $url
    }
    catch {
        Write-Host "Open this URL manually: $url" -ForegroundColor Yellow
    }
}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $client.NoDelay = $true

        $stream = $null
        $reader = $null
        $fileStream = $null

        try {
            $stream = $client.GetStream()

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
            $totalLength = [int64]$fileInfo.Length
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

            if (
                $headers.ContainsKey('range') -and
                $headers['range'] -match '^bytes=(\d*)-(\d*)$'
            ) {
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

            $buffer = New-Object byte[] 65536
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
            Write-Host ("Request error: " + $_.Exception.Message) -ForegroundColor DarkYellow
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
