using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
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
                builder.UseSetting("args", $"--root {_tempRoot}");
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
        var files = await response.Content.ReadFromJsonAsync<List<string>>();
        Assert.NotNull(files);
        Assert.Empty(files);
    }

    [Fact]
    public async Task GetFiles_Returns_JsonFiles()
    {
        File.WriteAllText(Path.Combine(_tempRoot, "a.json"), "{}");
        File.WriteAllText(Path.Combine(_tempRoot, "b.json"), "{}");

        var response = await _client.GetAsync("/files");
        var files = await response.Content.ReadFromJsonAsync<List<string>>();
        Assert.NotNull(files);
        Assert.Contains("a.json", files);
        Assert.Contains("b.json", files);
    }

    [Fact]
    public async Task GetFiles_Returns_Files_In_Subdirectories()
    {
        var sub = Path.Combine(_tempRoot, "sub");
        Directory.CreateDirectory(sub);
        File.WriteAllText(Path.Combine(sub, "nested.json"), "{}");

        var response = await _client.GetAsync("/files");
        var files = await response.Content.ReadFromJsonAsync<List<string>>();
        Assert.NotNull(files);
        Assert.Contains("sub/nested.json", files);
    }

    // ── POST /select ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Select_Returns_BadRequest_For_Nonexistent_File()
    {
        var response = await _client.PostAsJsonAsync("/select", new { path = "nope.json" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Select_Returns_Ok_For_Existing_File()
    {
        File.WriteAllText(Path.Combine(_tempRoot, "test.json"), "{}");

        var response = await _client.PostAsJsonAsync("/select", new { path = "test.json" });
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
        File.WriteAllText(Path.Combine(_tempRoot, "data.json"), content);
        await _client.PostAsJsonAsync("/select", new { path = "data.json" });

        var response = await _client.GetAsync("/selected");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
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
        File.WriteAllText(Path.Combine(_tempRoot, "edit.json"), "{}");
        await _client.PostAsJsonAsync("/select", new { path = "edit.json" });

        var newContent = """{"updated":true}""";
        var put = await _client.PutAsync("/selected",
            new StringContent(newContent, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var disk = File.ReadAllText(Path.Combine(_tempRoot, "edit.json"));
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

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
        if (Directory.Exists(_tempRoot))
            Directory.Delete(_tempRoot, recursive: true);
    }
}
