using System.Collections.Concurrent;
using System.Diagnostics;
using System.Reflection;
using System.Text;
using System.Text.Json;
using EventModelServer;

var builder = WebApplication.CreateBuilder(args);

// Resolve root folder: --root arg or exe directory
var rootArg = args.SkipWhile(a => a != "--root").Skip(1).FirstOrDefault();
var rootFolder = rootArg is not null
    ? Path.GetFullPath(rootArg)
    : AppContext.BaseDirectory;

builder.WebHost.ConfigureKestrel(o => o.ListenLocalhost(0)); // port 0 = OS picks free port
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

// GET /files — list all .json files under root (relative paths)
app.MapGet("/files", () =>
{
    var files = fileService.GetFiles();
    return Results.Json(files);
});

// POST /select — body: { "path": "relative/path.json" }
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

// GET /selected — return content of selected file
app.MapGet("/selected", () =>
{
    var content = fileService.GetSelectedContent();
    if (content is null) return Results.NotFound("No file selected");
    return Results.Content(content, "application/json");
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

// Make Program partial so WebApplicationFactory can reference it in tests
public partial class Program { }
