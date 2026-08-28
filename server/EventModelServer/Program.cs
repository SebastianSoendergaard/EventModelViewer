using System.Collections.Concurrent;
using System.Diagnostics;
using System.Reflection;
using System.Text;
using System.Text.Json;
using EventModelServer;

var builder = WebApplication.CreateBuilder(args);

// Root folder starts at the exe directory. Any previously-picked folder lives in the
// client's localStorage; the client applies it via POST /root right after the page loads.
var rootFolder = AppContext.BaseDirectory;

// Prefer a fixed port so the browser origin (and therefore localStorage) stays stable
// across launches, which is what makes remembering the selected root folder possible.
// Fall back to an OS-assigned ephemeral port if the fixed one is already in use.
const int PreferredPort = 55231;
var port = IsPortAvailable(PreferredPort) ? PreferredPort : 0;

builder.WebHost.ConfigureKestrel(o =>
{
    o.Listen(System.Net.IPAddress.Loopback, port);
});
builder.Services.AddSingleton<FileService>(_ => new FileService(rootFolder));
builder.Services.AddSingleton<SseService>();

var app = builder.Build();

var fileService = app.Services.GetRequiredService<FileService>();
var sseService = app.Services.GetRequiredService<SseService>();

// Wire watchers → SSE broadcasts
fileService.OnSelectedFileChanged += () => sseService.Broadcast("file-changed", "{}");
fileService.OnFolderContentsChanged += () => sseService.Broadcast("files-changed", "{}");

// GET / — serve embedded viewer HTML
app.MapGet("/", () =>
{
    var asm = Assembly.GetExecutingAssembly();
    using var stream = asm.GetManifestResourceStream("event-model-viewer.html")!;
    using var reader = new StreamReader(stream);
    return Results.Content(reader.ReadToEnd(), "text/html");
});

// GET /files — list all .emj/.emy files under root (relative paths), bounded scan
app.MapGet("/files", () =>
{
    var result = fileService.GetFiles();
    return Results.Json(new { files = result.Files, truncated = result.Truncated });
});

// GET /root — the currently active root folder
app.MapGet("/root", () => Results.Json(new { path = fileService.Root }));

// GET /root/browse?path=... — list subfolders of path (or drives, when path is empty)
app.MapGet("/root/browse", (string? path) =>
{
    var result = fileService.Browse(path);
    if (result is null) return Results.BadRequest("Invalid or inaccessible path");
    return Results.Json(result);
});

// POST /root — body: { "path": "C:\\my-models" } — switch the active root folder.
// Fast: only validates the folder and rewires watchers. It does NOT scan for
// .emj/.emy files — that happens separately via GET /files, so switching root never
// blocks on a large tree.
app.MapPost("/root", async (HttpRequest request) =>
{
    using var doc = await JsonDocument.ParseAsync(request.Body);
    if (!doc.RootElement.TryGetProperty("path", out var pathEl))
        return Results.BadRequest("Missing 'path'");

    var path = pathEl.GetString() ?? string.Empty;
    if (!fileService.TrySetRoot(path, out var error))
        return Results.BadRequest(error);

    sseService.Broadcast("root-changed", "{}");
    return Results.Ok(new { root = fileService.Root });
});

// POST /select — body: { "path": "relative/path.emj" } (or .emy)
app.MapPost("/select", async (HttpRequest request) =>
{
    using var doc = await JsonDocument.ParseAsync(request.Body);
    if (!doc.RootElement.TryGetProperty("path", out var pathEl))
        return Results.BadRequest("Missing 'path'");

    var rel = pathEl.GetString() ?? string.Empty;
    if (!fileService.TrySelect(rel, out var error))
        return Results.BadRequest(error);

    return Results.Ok(new { selected = rel });
});

// GET /selected — return content of selected file. Content-Type reflects the file's
// encoding (.emj -> JSON, .emy -> YAML) but the server never parses either — it's a
// pass-through so the client's Codec module can pick the right parser.
app.MapGet("/selected", () =>
{
    var content = fileService.GetSelectedContent();
    if (content is null) return Results.NotFound("No file selected");
    var contentType = fileService.SelectedRelative?.EndsWith(".emy", StringComparison.OrdinalIgnoreCase) == true
        ? "application/x-yaml"
        : "application/json";
    return Results.Content(content, contentType);
});

// PUT /selected — update content of selected file
app.MapPut("/selected", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body, Encoding.UTF8);
    var body = await reader.ReadToEndAsync();

    if (!fileService.TryUpdateSelected(body, out var error))
        return Results.BadRequest(error);

    return Results.Ok();
});

// POST /files — create a new empty event model file (name determines .emj/.emy encoding).
// Request body itself is JSON (the API envelope), independent of the created file's format.
app.MapPost("/files", async (HttpRequest request) =>
{
    using var doc = await JsonDocument.ParseAsync(request.Body);
    if (!doc.RootElement.TryGetProperty("name", out var nameEl))
        return Results.BadRequest("Missing 'name'");

    var name = nameEl.GetString() ?? string.Empty;
    if (!fileService.TryCreateFile(name, out var error))
        return Results.BadRequest(error);

    return Results.Created($"/files/{Uri.EscapeDataString(name)}", new { path = name });
});

// GET /events — SSE stream
app.MapGet("/events", async (HttpContext ctx, CancellationToken ct) =>
{
    ctx.Response.Headers.Append("Content-Type", "text/event-stream");
    ctx.Response.Headers.Append("Cache-Control", "no-cache");
    ctx.Response.Headers.Append("X-Accel-Buffering", "no");

    var channel = sseService.Subscribe();
    try
    {
        await foreach (var msg in channel.Reader.ReadAllAsync(ct))
        {
            await ctx.Response.WriteAsync($"event: {msg.evt}\ndata: {msg.data}\n\n", ct);
            await ctx.Response.Body.FlushAsync(ct);
        }
    }
    catch (OperationCanceledException) { /* client disconnected */ }
    finally
    {
        sseService.Unsubscribe(channel);
    }
});

// Open browser after server starts
var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
lifetime.ApplicationStarted.Register(() =>
{
    var address = app.Urls.FirstOrDefault() ?? "http://localhost:5000";
    OpenBrowser(address);
});

await app.RunAsync();

static void OpenBrowser(string url)
{
    try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
    catch { /* best-effort */ }
}

static bool IsPortAvailable(int port)
{
    try
    {
        var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, port);
        listener.Start();
        listener.Stop();
        return true;
    }
    catch (System.Net.Sockets.SocketException)
    {
        return false;
    }
}

// Make Program partial so WebApplicationFactory can reference it in tests
public partial class Program { }
