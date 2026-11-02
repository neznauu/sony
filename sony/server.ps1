$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot

Add-Type -TypeDefinition @'
using System;
using System.Globalization;
using System.IO;
using System.Net;
using System.Threading;

public static class ProjectStaticServer
{
    private static HttpListener activeListener;

    public static void Serve(HttpListener listener, string root)
    {
        activeListener = listener;
        Console.CancelKeyPress += StopListener;
        try
        {
            while (listener.IsListening)
            {
                HttpListenerContext context;
                try
                {
                    context = listener.GetContext();
                }
                catch (HttpListenerException)
                {
                    if (!listener.IsListening) break;
                    throw;
                }

                ThreadPool.QueueUserWorkItem(delegate(object state)
                {
                    object[] request = (object[])state;
                    Handle((HttpListenerContext)request[0], (string)request[1]);
                }, new object[] { context, root });
            }
        }
        finally
        {
            Console.CancelKeyPress -= StopListener;
            activeListener = null;
        }
    }

    private static void StopListener(object sender, ConsoleCancelEventArgs args)
    {
        args.Cancel = true;
        if (activeListener != null) activeListener.Stop();
    }

    private static void Handle(HttpListenerContext context, string root)
    {
        HttpListenerResponse response = context.Response;
        try
        {
            if (context.Request.HttpMethod != "GET" && context.Request.HttpMethod != "HEAD")
            {
                response.StatusCode = 405;
                return;
            }

            string relativePath = Uri.UnescapeDataString(context.Request.Url.LocalPath).TrimStart('/');
            if (String.IsNullOrWhiteSpace(relativePath)) relativePath = "index.html";
            relativePath = relativePath.Replace('/', Path.DirectorySeparatorChar);

            string rootPath = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            string filePath = Path.GetFullPath(Path.Combine(rootPath, relativePath));
            if (!filePath.StartsWith(rootPath, StringComparison.OrdinalIgnoreCase))
            {
                response.StatusCode = 403;
                return;
            }
            if (!File.Exists(filePath))
            {
                response.StatusCode = 404;
                return;
            }

            response.ContentType = ContentType(Path.GetExtension(filePath));
            response.Headers.Add("Access-Control-Allow-Origin", "*");
            response.Headers.Add("Accept-Ranges", "bytes");
            response.Headers.Add("Cache-Control", "no-cache");

            long totalLength = new FileInfo(filePath).Length;
            long start = 0;
            long end = totalLength - 1;
            string rangeHeader = context.Request.Headers["Range"];
            if (!String.IsNullOrEmpty(rangeHeader))
            {
                if (!TryParseRange(rangeHeader, totalLength, out start, out end))
                {
                    response.StatusCode = 416;
                    response.Headers.Add("Content-Range", "bytes */" + totalLength.ToString(CultureInfo.InvariantCulture));
                    return;
                }
                response.StatusCode = 206;
                response.Headers.Add("Content-Range", "bytes " +
                    start.ToString(CultureInfo.InvariantCulture) + "-" +
                    end.ToString(CultureInfo.InvariantCulture) + "/" +
                    totalLength.ToString(CultureInfo.InvariantCulture));
            }
            else
            {
                response.StatusCode = 200;
            }

            long contentLength = end - start + 1;
            response.ContentLength64 = contentLength;
            if (context.Request.HttpMethod == "HEAD") return;

            using (FileStream stream = File.OpenRead(filePath))
            {
                stream.Seek(start, SeekOrigin.Begin);
                byte[] buffer = new byte[65536];
                long remaining = contentLength;
                while (remaining > 0)
                {
                    int read = stream.Read(buffer, 0, (int)Math.Min(buffer.Length, remaining));
                    if (read == 0) break;
                    response.OutputStream.Write(buffer, 0, read);
                    remaining -= read;
                }
            }
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine("HTTP request failed: " + exception.Message);
            try { response.StatusCode = 500; } catch { }
        }
        finally
        {
            try { response.Close(); } catch { }
        }
    }

    private static bool TryParseRange(string header, long length, out long start, out long end)
    {
        start = 0;
        end = length - 1;
        if (length <= 0 || !header.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase)) return false;

        string[] parts = header.Substring(6).Split('-');
        if (parts.Length != 2 || header.IndexOf(',') >= 0) return false;

        long value;
        if (parts[0].Length == 0)
        {
            if (!Int64.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out value) || value <= 0) return false;
            start = Math.Max(0, length - value);
        }
        else
        {
            if (!Int64.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out start)) return false;
            if (parts[1].Length > 0 && !Int64.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out end)) return false;
        }

        if (start >= length || end < start) return false;
        end = Math.Min(end, length - 1);
        return true;
    }

    private static string ContentType(string extension)
    {
        switch (extension.ToLowerInvariant())
        {
            case ".html": return "text/html; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".js": return "application/javascript; charset=utf-8";
            case ".png": return "image/png";
            case ".jpg":
            case ".jpeg": return "image/jpeg";
            case ".svg": return "image/svg+xml";
            case ".json": return "application/json; charset=utf-8";
            case ".mp3": return "audio/mpeg";
            default: return "application/octet-stream";
        }
    }
}
'@

$portsToTry = @(8080, 8081, 8082, 8083, 3000, 5000, 8000, 8888, 9000)
$listener = $null
$port = $null
$activeUrl = $null

foreach ($p in $portsToTry) {
    try {
        $l = New-Object System.Net.HttpListener
        $l.Prefixes.Add("http://localhost:$p/")
        $l.Start()
        $listener = $l
        $port = $p
        $activeUrl = "http://localhost:$p/"
        break
    } catch {
        if ($l) { try { $l.Close() } catch {} }
    }
}

if (-not $listener) {
    # Попробуем префикс 127.0.0.1
    foreach ($p in $portsToTry) {
        try {
            $l = New-Object System.Net.HttpListener
            $l.Prefixes.Add("http://127.0.0.1:$p/")
            $l.Start()
            $listener = $l
            $port = $p
            $activeUrl = "http://127.0.0.1:$p/"
            break
        } catch {
            if ($l) { try { $l.Close() } catch {} }
        }
    }
}

if (-not $listener) {
    Write-Host "Не удалось запустить локальный HTTP-сервер: все стандартные порты заняты." -ForegroundColor Red
    Write-Host "Закройте другой экземпляр проекта и запустите start.bat ещё раз." -ForegroundColor Yellow
    exit 1
}

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Локальный сервер запущен: $activeUrl" -ForegroundColor Green
Write-Host "  Не закрывайте это окно во время игры." -ForegroundColor DarkGray
Write-Host "===================================================" -ForegroundColor Cyan

try {
    Start-Process $activeUrl
} catch {
    Write-Host "Откройте в браузере адрес: $activeUrl" -ForegroundColor Yellow
}

try {
    [ProjectStaticServer]::Serve($listener, $root)
} finally {
    try { $listener.Stop() } catch {}
    try { $listener.Close() } catch {}
}
