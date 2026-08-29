using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Linq;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace EventModelServer.Tests;

/// <summary>
/// Integration tests use a temp directory as the root so they are fully isolated.
/// </summary>
public class EndpointTests : IDisposable
{
    private readonly string _tempRoot;
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public EndpointTests()
    {
        _tempRoot = Path.Combine(Path.GetTempPath(), "ems-test-" + Guid.NewGuid());
        Directory.CreateDirectory(_tempRoot);

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Replace FileService with one pointing at our temp root
                    services.AddSingleton<FileService>(_ => new FileService(_tempRoot));
                });
            });

        _client = _factory.CreateClient();
    }

    // ── GET / ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Root_Returns_Html()
    {
        var response = await _client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var ct = response.Content.Headers.ContentType?.MediaType;
        Assert.Equal("text/html", ct);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("<html", body, StringComparison.OrdinalIgnoreCase);
    }

    // ── GET /files ───────────────────────────────────────────────────────────

    [Fact]
    public async Task GetFiles_Returns_EmptyList_When_NoFiles()
    {
        var response = await _client.GetAsync("/files");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        var files = doc.GetProperty("files").EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Empty(files);
        Assert.False(doc.GetProperty("truncated").GetBoolean());
    }

    [Fact]
    public async Task GetFiles_Returns_JsonFiles()
    {
        File.WriteAllText(Path.Combine(_tempRoot, "a.emj"), "{}");
        File.WriteAllText(Path.Combine(_tempRoot, "b.emj"), "{}");

        var response = await _client.GetAsync("/files");
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        var files = doc.GetProperty("files").EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Contains("a.emj", files);
        Assert.Contains("b.emj", files);
    }

    [Fact]
    public async Task GetFiles_Returns_YamlFiles()
    {
        File.WriteAllText(Path.Combine(_tempRoot, "a.emj"), "{}");
        File.WriteAllText(Path.Combine(_tempRoot, "b.emy"), "{}");

        var response = await _client.GetAsync("/files");
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        var files = doc.GetProperty("files").EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Contains("a.emj", files);
        Assert.Contains("b.emy", files);
    }

    [Fact]
    public async Task GetFiles_Returns_Files_In_Subdirectories()
    {
        var sub = Path.Combine(_tempRoot, "sub");
        Directory.CreateDirectory(sub);
        File.WriteAllText(Path.Combine(sub, "nested.emj"), "{}");

        var response = await _client.GetAsync("/files");
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        var files = doc.GetProperty("files").EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Contains("sub/nested.emj", files);
    }

    // ── POST /select ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Select_Returns_BadRequest_For_Nonexistent_File()
    {
        var response = await _client.PostAsJsonAsync("/select", new { path = "nope.emj" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Select_Returns_Ok_For_Existing_File()
    {
        File.WriteAllText(Path.Combine(_tempRoot, "test.emj"), "{}");

        var response = await _client.PostAsJsonAsync("/select", new { path = "test.emj" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Select_Returns_BadRequest_When_Path_Missing()
    {
        var response = await _client.PostAsJsonAsync("/select", new { });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── GET /selected ────────────────────────────────────────────────────────

    [Fact]
    public async Task GetSelected_Returns_NotFound_When_Nothing_Selected()
    {
        var response = await _client.GetAsync("/selected");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetSelected_Returns_File_Content()
    {
        var content = """{"key":"value"}""";
        File.WriteAllText(Path.Combine(_tempRoot, "data.emj"), content);
        await _client.PostAsJsonAsync("/select", new { path = "data.emj" });

        var response = await _client.GetAsync("/selected");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(content, body);
    }

    [Fact]
    public async Task GetSelected_Returns_Json_ContentType_For_Emj_File()
    {
        File.WriteAllText(Path.Combine(_tempRoot, "data.emj"), "{}");
        await _client.PostAsJsonAsync("/select", new { path = "data.emj" });

        var response = await _client.GetAsync("/selected");
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task GetSelected_Returns_Yaml_ContentType_For_Emy_File()
    {
        var content = "key: value\n";
        File.WriteAllText(Path.Combine(_tempRoot, "data.emy"), content);
        await _client.PostAsJsonAsync("/select", new { path = "data.emy" });

        var response = await _client.GetAsync("/selected");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/x-yaml", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(content, body);
    }

    // ── PUT /selected ────────────────────────────────────────────────────────

    [Fact]
    public async Task PutSelected_Returns_BadRequest_When_Nothing_Selected()
    {
        var response = await _client.PutAsync("/selected",
            new StringContent("{}", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutSelected_Updates_File_Content()
    {
        File.WriteAllText(Path.Combine(_tempRoot, "edit.emj"), "{}");
        await _client.PostAsJsonAsync("/select", new { path = "edit.emj" });

        var newContent = """{"updated":true}""";
        var put = await _client.PutAsync("/selected",
            new StringContent(newContent, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var disk = File.ReadAllText(Path.Combine(_tempRoot, "edit.emj"));
        Assert.Equal(newContent, disk);
    }

    [Fact]
    public async Task PutSelected_Updates_Emy_File_Content()
    {
        File.WriteAllText(Path.Combine(_tempRoot, "edit.emy"), "{}");
        await _client.PostAsJsonAsync("/select", new { path = "edit.emy" });

        var newContent = "updated: true\n";
        var put = await _client.PutAsync("/selected",
            new StringContent(newContent, Encoding.UTF8, "application/x-yaml"));
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var disk = File.ReadAllText(Path.Combine(_tempRoot, "edit.emy"));
        Assert.Equal(newContent, disk);
    }

    // ── GET /events (SSE) ────────────────────────────────────────────────────

    [Fact]
    public async Task Events_Endpoint_Returns_SSE_Headers()
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        using var request = new HttpRequestMessage(HttpMethod.Get, "/events");
        var response = await _client.SendAsync(request,
            HttpCompletionOption.ResponseHeadersRead, cts.Token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var ct = response.Content.Headers.ContentType?.MediaType;
        Assert.Equal("text/event-stream", ct);
    }

    [Fact]
    public async Task Events_Broadcast_Received_By_Client()
    {
        // Test SseService directly — HTTP stream buffering in TestServer is unreliable
        var sseService = _factory.Services.GetRequiredService<SseService>();
        var channel = sseService.Subscribe();
        try
        {
            sseService.Broadcast("test-event", """{"x":1}""");

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            var (evt, data) = await channel.Reader.ReadAsync(cts.Token);
            Assert.Equal("test-event", evt);
            Assert.Equal("""{"x":1}""", data);
        }
        finally
        {
            sseService.Unsubscribe(channel);
        }
    }

    // ── POST /files ──────────────────────────────────────────────────────────

    [Fact]
    public async Task PostFiles_Creates_File_In_Root()
    {
        var response = await _client.PostAsJsonAsync("/files", new { name = "new.emj" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.True(File.Exists(Path.Combine(_tempRoot, "new.emj")));
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("new.emj", body);
    }

    [Fact]
    public async Task PostFiles_Creates_Emy_File_In_Root()
    {
        var response = await _client.PostAsJsonAsync("/files", new { name = "new.emy" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.True(File.Exists(Path.Combine(_tempRoot, "new.emy")));
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("new.emy", body);
    }

    [Fact]
    public async Task PostFiles_Returns_BadRequest_For_Duplicate()
    {
        File.WriteAllText(Path.Combine(_tempRoot, "exists.emj"), "{}");
        var response = await _client.PostAsJsonAsync("/files", new { name = "exists.emj" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostFiles_Returns_BadRequest_For_Empty_Name()
    {
        var response = await _client.PostAsJsonAsync("/files", new { name = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostFiles_Returns_BadRequest_For_Path_Traversal()
    {
        var response = await _client.PostAsJsonAsync("/files", new { name = "../escape.emj" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostFiles_Returns_BadRequest_When_Name_Missing()
    {
        var response = await _client.PostAsJsonAsync("/files", new { });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── GET /root ────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRoot_Returns_Current_Root_Path()
    {
        var response = await _client.GetAsync("/root");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(Path.GetFullPath(_tempRoot), doc.GetProperty("path").GetString());
    }

    // ── GET /root/browse ─────────────────────────────────────────────────────

    [Fact]
    public async Task BrowseRoot_Empty_Path_Lists_Drives()
    {
        var response = await _client.GetAsync("/root/browse?path=");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(string.Empty, doc.GetProperty("path").GetString());
        Assert.Equal(JsonValueKind.Null, doc.GetProperty("parent").ValueKind);
        Assert.True(doc.GetProperty("folders").GetArrayLength() > 0);
    }

    [Fact]
    public async Task BrowseRoot_Returns_Subfolders_And_Parent()
    {
        var sub = Path.Combine(_tempRoot, "sub");
        Directory.CreateDirectory(sub);

        var response = await _client.GetAsync($"/root/browse?path={Uri.EscapeDataString(_tempRoot)}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(Path.GetFullPath(_tempRoot), doc.GetProperty("path").GetString());
        Assert.NotEqual(JsonValueKind.Null, doc.GetProperty("parent").ValueKind);
        var folders = doc.GetProperty("folders").EnumerateArray().Select(f => f.GetProperty("name").GetString());
        Assert.Contains("sub", folders);
    }

    [Fact]
    public async Task BrowseRoot_Returns_BadRequest_For_Nonexistent_Path()
    {
        var missing = Path.Combine(_tempRoot, "does-not-exist");
        var response = await _client.GetAsync($"/root/browse?path={Uri.EscapeDataString(missing)}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── POST /root ───────────────────────────────────────────────────────────

    [Fact]
    public async Task PostRoot_Switches_Active_Root()
    {
        var newRoot = Path.Combine(Path.GetTempPath(), "ems-test-newroot-" + Guid.NewGuid());
        Directory.CreateDirectory(newRoot);
        try
        {
            File.WriteAllText(Path.Combine(newRoot, "other.emj"), "{}");

            var response = await _client.PostAsJsonAsync("/root", new { path = newRoot });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var rootResponse = await _client.GetAsync("/root");
            var doc = await rootResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(Path.GetFullPath(newRoot), doc.GetProperty("path").GetString());

            var filesResponse = await _client.GetAsync("/files");
            var filesDoc = await filesResponse.Content.ReadFromJsonAsync<JsonElement>();
            var files = filesDoc.GetProperty("files").EnumerateArray().Select(e => e.GetString()).ToList();
            Assert.Contains("other.emj", files);
        }
        finally
        {
            Directory.Delete(newRoot, recursive: true);
        }
    }

    [Fact]
    public async Task PostRoot_Does_Not_Scan_Files_Synchronously()
    {
        // POST /root should only return the new root path, not a file list — scanning
        // for .emj files is a separate, decoupled step (GET /files) so switching root
        // stays fast even for huge folder trees.
        var newRoot = Path.Combine(Path.GetTempPath(), "ems-test-newroot-" + Guid.NewGuid());
        Directory.CreateDirectory(newRoot);
        try
        {
            var response = await _client.PostAsJsonAsync("/root", new { path = newRoot });
            var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.False(doc.TryGetProperty("files", out _));
        }
        finally
        {
            Directory.Delete(newRoot, recursive: true);
        }
    }

    [Fact]
    public async Task PostRoot_Returns_BadRequest_For_Nonexistent_Folder()
    {
        var missing = Path.Combine(_tempRoot, "does-not-exist");
        var response = await _client.PostAsJsonAsync("/root", new { path = missing });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostRoot_Returns_BadRequest_When_Path_Missing()
    {
        var response = await _client.PostAsJsonAsync("/root", new { });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── POST /export ─────────────────────────────────────────────────────────

    [Fact]
    public async Task PostExport_Writes_Files_To_Target_Folder()
    {
        var target = Path.Combine(_tempRoot, "export-out");
        Directory.CreateDirectory(target);

        var response = await _client.PostAsJsonAsync("/export", new
        {
            path = target,
            files = new[]
            {
                new { name = "index.md", content = "# Index" },
                new { name = "001-add-item.md", content = "# Add item" }
            }
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        var written = doc.GetProperty("written").EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Contains("index.md", written);
        Assert.Contains("001-add-item.md", written);
        Assert.Equal("# Index", await File.ReadAllTextAsync(Path.Combine(target, "index.md")));
    }

    [Fact]
    public async Task PostExport_Returns_BadRequest_For_Nonexistent_Folder()
    {
        var missing = Path.Combine(_tempRoot, "does-not-exist");
        var response = await _client.PostAsJsonAsync("/export", new
        {
            path = missing,
            files = new[] { new { name = "a.md", content = "x" } }
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostExport_Returns_BadRequest_When_Path_Missing()
    {
        var response = await _client.PostAsJsonAsync("/export", new
        {
            files = new[] { new { name = "a.md", content = "x" } }
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostExport_Returns_BadRequest_When_Files_Missing()
    {
        var response = await _client.PostAsJsonAsync("/export", new { path = _tempRoot });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostExport_Overwrites_Existing_File()
    {
        var target = Path.Combine(_tempRoot, "export-out2");
        Directory.CreateDirectory(target);
        await File.WriteAllTextAsync(Path.Combine(target, "index.md"), "old");

        var response = await _client.PostAsJsonAsync("/export", new
        {
            path = target,
            files = new[] { new { name = "index.md", content = "new" } }
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("new", await File.ReadAllTextAsync(Path.Combine(target, "index.md")));
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
        if (Directory.Exists(_tempRoot))
            Directory.Delete(_tempRoot, recursive: true);
    }
}
