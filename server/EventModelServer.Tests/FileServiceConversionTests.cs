namespace EventModelServer.Tests;

public sealed class FileServiceConversionTests : IDisposable
{
    private readonly string _root;
    private readonly FileService _service;

    public FileServiceConversionTests()
    {
        _root = Path.Combine(Path.GetTempPath(), "ems-conversion-" + Guid.NewGuid());
        Directory.CreateDirectory(_root);
        _service = new FileService(_root);
    }

    [Fact]
    public void TryCreateFileWithContent_CreatesNestedFileWithoutOverwriting()
    {
        var folder = Path.Combine(_root, "nested");
        Directory.CreateDirectory(folder);
        const string original = "title: Cart\nslices: []\n";

        Assert.True(_service.TryCreateFileWithContent("nested/cart.emy", original, out var error), error);
        Assert.Equal(original, File.ReadAllText(Path.Combine(folder, "cart.emy")));

        Assert.False(_service.TryCreateFileWithContent(
            "nested/cart.emy", "different content", out error));
        Assert.Contains("already exists", error);
        Assert.Equal(original, File.ReadAllText(Path.Combine(folder, "cart.emy")));
    }

    [Theory]
    [InlineData("../outside.emj")]
    [InlineData("nested/../../outside.emy")]
    [InlineData("/absolute/file.emj")]
    public void TryCreateFileWithContent_RejectsPathsOutsideRoot(string path)
    {
        Assert.False(_service.TryCreateFileWithContent(path, "{}", out var error));
        Assert.NotEmpty(error);
        Assert.Empty(Directory.GetFiles(_root, "*", SearchOption.AllDirectories));
    }

    public void Dispose()
    {
        _service.Dispose();
        Directory.Delete(_root, recursive: true);
    }
}
