using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;

var options = LauncherOptions.Parse(args);

if (options.ShowHelp)
{
    Console.WriteLine("InvestNavigatorDemo.exe [--port 5500] [--no-open]");
    return;
}

var assets = SiteAssets.Load();
using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    cts.Cancel();
};

var listener = ServerPort.Bind(options, out var port);
using (listener)
{
    var url = $"http://127.0.0.1:{port}/";
    Console.Title = "Invest Navigator Demo";
    Console.WriteLine("Invest Navigator demo is running.");
    Console.WriteLine(url);
    Console.WriteLine();
    Console.WriteLine("Close this window or press Ctrl+C to stop.");

    if (!options.NoOpen)
    {
        OpenBrowser(url);
    }

    try
    {
        await ServeAsync(listener, assets, cts.Token);
    }
    catch (OperationCanceledException)
    {
        // Normal shutdown.
    }
}

static async Task ServeAsync(TcpListener listener, IReadOnlyDictionary<string, SiteAsset> assets, CancellationToken token)
{
    while (!token.IsCancellationRequested)
    {
        var client = await listener.AcceptTcpClientAsync(token);
        _ = Task.Run(() => HandleClientAsync(client, assets, token), token);
    }
}

static async Task HandleClientAsync(TcpClient client, IReadOnlyDictionary<string, SiteAsset> assets, CancellationToken token)
{
    try
    {
        using (client)
        {
            client.NoDelay = true;
            await using var stream = client.GetStream();
            using var reader = new StreamReader(stream, Encoding.ASCII, detectEncodingFromByteOrderMarks: false, bufferSize: 4096, leaveOpen: true);

            var requestLine = await reader.ReadLineAsync(token);
            if (string.IsNullOrWhiteSpace(requestLine))
            {
                return;
            }

            string? headerLine;
            do
            {
                headerLine = await reader.ReadLineAsync(token);
            }
            while (!string.IsNullOrEmpty(headerLine));

            var parts = requestLine.Split(' ', 3, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2)
            {
                await WriteTextResponseAsync(stream, 400, "Bad Request", "text/plain; charset=utf-8", "Bad request", isHead: false, token);
                return;
            }

            var method = parts[0].ToUpperInvariant();
            if (method is not ("GET" or "HEAD"))
            {
                await WriteTextResponseAsync(stream, 405, "Method Not Allowed", "text/plain; charset=utf-8", "Method not allowed", isHead: false, token);
                return;
            }

            var assetPath = NormalizeAssetPath(parts[1]);
            if (assetPath is null || !assets.TryGetValue(assetPath, out var asset))
            {
                await WriteTextResponseAsync(stream, 404, "Not Found", "text/plain; charset=utf-8", "Not found", method == "HEAD", token);
                return;
            }

            await WriteResponseAsync(stream, 200, "OK", asset.ContentType, asset.Bytes, method == "HEAD", token);
        }
    }
    catch
    {
        // Browsers can close localhost sockets early; this launcher should stay quiet and keep serving.
    }
}

static string? NormalizeAssetPath(string rawTarget)
{
    var queryIndex = rawTarget.IndexOfAny(['?', '#']);
    var path = queryIndex >= 0 ? rawTarget[..queryIndex] : rawTarget;

    try
    {
        path = Uri.UnescapeDataString(path);
    }
    catch
    {
        return null;
    }

    path = path.Replace('\\', '/').TrimStart('/');
    if (string.IsNullOrEmpty(path))
    {
        return "index.html";
    }

    if (path.EndsWith('/'))
    {
        path += "index.html";
    }

    return path.Contains("..", StringComparison.Ordinal) ? null : path;
}

static async Task WriteTextResponseAsync(
    NetworkStream stream,
    int statusCode,
    string reason,
    string contentType,
    string body,
    bool isHead,
    CancellationToken token)
{
    await WriteResponseAsync(stream, statusCode, reason, contentType, Encoding.UTF8.GetBytes(body), isHead, token);
}

static async Task WriteResponseAsync(
    NetworkStream stream,
    int statusCode,
    string reason,
    string contentType,
    byte[] body,
    bool isHead,
    CancellationToken token)
{
    var headers = Encoding.ASCII.GetBytes(
        $"HTTP/1.1 {statusCode} {reason}\r\n" +
        $"Content-Type: {contentType}\r\n" +
        $"Content-Length: {body.Length}\r\n" +
        "Cache-Control: no-store\r\n" +
        "Connection: close\r\n" +
        "\r\n");

    await stream.WriteAsync(headers, token);
    if (!isHead)
    {
        await stream.WriteAsync(body, token);
    }
}

static void OpenBrowser(string url)
{
    try
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = url,
            UseShellExecute = true
        });
    }
    catch (Exception exception)
    {
        Console.WriteLine($"Could not open browser automatically: {exception.Message}");
    }
}

sealed record LauncherOptions(int PreferredPort, bool IsPortExplicit, bool NoOpen, bool ShowHelp)
{
    public static LauncherOptions Parse(string[] args)
    {
        var port = 5500;
        var explicitPort = false;
        var noOpen = false;
        var showHelp = false;

        for (var index = 0; index < args.Length; index++)
        {
            var arg = args[index];
            if (arg is "--help" or "-h" or "/?")
            {
                showHelp = true;
            }
            else if (arg == "--no-open")
            {
                noOpen = true;
            }
            else if (arg == "--port" && index + 1 < args.Length && int.TryParse(args[index + 1], out var parsedPort))
            {
                port = parsedPort;
                explicitPort = true;
                index++;
            }
        }

        if (port is < 0 or > 65535)
        {
            port = 5500;
            explicitPort = false;
        }

        return new LauncherOptions(port, explicitPort, noOpen, showHelp);
    }
}

static class ServerPort
{
    public static TcpListener Bind(LauncherOptions options, out int port)
    {
        IEnumerable<int> ports = options.IsPortExplicit
            ? new[] { options.PreferredPort }
            : Enumerable.Range(options.PreferredPort, 100).Append(0);

        foreach (var candidate in ports)
        {
            try
            {
                var listener = new TcpListener(IPAddress.Loopback, candidate);
                listener.Start();
                port = ((IPEndPoint)listener.LocalEndpoint).Port;
                return listener;
            }
            catch (SocketException) when (!options.IsPortExplicit)
            {
                continue;
            }
        }

        throw new InvalidOperationException($"Could not bind local port {options.PreferredPort}.");
    }
}

static class SiteAssets
{
    public static IReadOnlyDictionary<string, SiteAsset> Load()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var assets = new ConcurrentDictionary<string, SiteAsset>(StringComparer.OrdinalIgnoreCase);

        foreach (var resourceName in assembly.GetManifestResourceNames())
        {
            using var resource = assembly.GetManifestResourceStream(resourceName);
            if (resource is null)
            {
                continue;
            }

            using var memory = new MemoryStream();
            resource.CopyTo(memory);
            var path = resourceName.Replace('\\', '/');
            assets[path] = new SiteAsset(path, GetContentType(path), memory.ToArray());
        }

        if (!assets.ContainsKey("index.html"))
        {
            throw new InvalidOperationException("Embedded site files were not found. Rebuild the launcher.");
        }

        return assets;
    }

    private static string GetContentType(string path)
    {
        return Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".html" => "text/html; charset=utf-8",
            ".css" => "text/css; charset=utf-8",
            ".js" => "text/javascript; charset=utf-8",
            ".json" => "application/json; charset=utf-8",
            ".svg" => "image/svg+xml",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".ico" => "image/x-icon",
            _ => "application/octet-stream"
        };
    }
}

sealed record SiteAsset(string Path, string ContentType, byte[] Bytes);
