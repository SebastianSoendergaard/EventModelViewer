using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace EventModelServer.Tests;

public sealed class FileConversionEndpointTests : IDisposable
{
    private readonly string _root;
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public FileConversionEndpointTests()
    {
        _root = Path.Combine(Path.GetTempPath(), "ems-conversion-api-" + Guid.NewGuid());
        Directory.CreateDirectory(_root);
        Directory.CreateDirectory(Path.Combine(_root, "nested"));

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                    services.AddSingleton<FileService>(_ => new FileService(_root)));
            });
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task ConvertEndpoint_CreatesNestedFileAndRejectsOverwrite()
    {
        const string content = "title: Cart\nslices: []\n";
        var request = new { path = "nested/cart.emy", content };

        var created = await _client.PostAsJsonAsync("/files/convert", request);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var createdFile = Path.Combine(_root, "nested", "cart.emy");
        Assert.Equal(content, await File.ReadAllTextAsync(createdFile));

        var duplicate = await _client.PostAsJsonAsync("/files/convert", request);

        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        Assert.Equal(content, await File.ReadAllTextAsync(createdFile));
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
        Directory.Delete(_root, recursive: true);
    }
}
