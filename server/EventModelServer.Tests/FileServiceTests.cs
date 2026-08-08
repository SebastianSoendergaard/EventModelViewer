namespace EventModelServer.Tests;

public class FileServiceTests : IDisposable
{
    private readonly string _root;
    private readonly FileService _svc;

    public FileServiceTests()
    {
        _root = Path.Combine(Path.GetTempPath(), "ems-unit-" + Guid.NewGuid());
        Directory.CreateDirectory(_root);
        _svc = new FileService(_root);
    }

    [Fact]
    public void GetFiles_Returns_Empty_When_No_Json_Files()
    {
        Assert.Empty(_svc.GetFiles());
    }

    [Fact]
    public void GetFiles_Returns_Only_Json_Files()
    {
        File.WriteAllText(Path.Combine(_root, "a.emj"), "{}");
        File.WriteAllText(Path.Combine(_root, "b.txt"), "text");

        var files = _svc.GetFiles();
        Assert.Single(files);
        Assert.Equal("a.emj", files[0]);
    }

    [Fact]
    public void GetFiles_Returns_Relative_Paths_With_Forward_Slashes()
    {
        var sub = Path.Combine(_root, "sub");
        Directory.CreateDirectory(sub);
        File.WriteAllText(Path.Combine(sub, "c.emj"), "{}");

        var files = _svc.GetFiles();
        Assert.Single(files);
        Assert.Equal("sub/c.emj", files[0]);
    }

    [Fact]
    public void TrySelect_Fails_For_Missing_File()
    {
        var result = _svc.TrySelect("ghost.emj", out var error);
        Assert.False(result);
        Assert.NotEmpty(error);
    }

    [Fact]
    public void TrySelect_Succeeds_For_Existing_File()
    {
        File.WriteAllText(Path.Combine(_root, "x.emj"), "{}");
        var result = _svc.TrySelect("x.emj", out var error);
        Assert.True(result);
        Assert.Empty(error);
        Assert.Equal("x.emj", _svc.SelectedRelative);
    }

    [Fact]
    public void GetSelectedContent_Returns_Null_When_Nothing_Selected()
    {
        Assert.Null(_svc.GetSelectedContent());
    }

    [Fact]
    public void GetSelectedContent_Returns_File_Content()
    {
        File.WriteAllText(Path.Combine(_root, "y.emj"), """{"hello":"world"}""");
        _svc.TrySelect("y.emj", out _);
        Assert.Equal("""{"hello":"world"}""", _svc.GetSelectedContent());
    }

    [Fact]
    public void TryUpdateSelected_Fails_When_Nothing_Selected()
    {
        Assert.False(_svc.TryUpdateSelected("{}", out var error));
        Assert.NotEmpty(error);
    }

    [Fact]
    public void TryUpdateSelected_Writes_Content_To_Disk()
    {
        File.WriteAllText(Path.Combine(_root, "z.emj"), "{}");
        _svc.TrySelect("z.emj", out _);

        _svc.TryUpdateSelected("""{"updated":true}""", out _);

        var disk = File.ReadAllText(Path.Combine(_root, "z.emj"));
        Assert.Equal("""{"updated":true}""", disk);
    }

    [Fact]
    public async Task OnSelectedFileChanged_Fires_When_File_Changes_Externally()
    {
        File.WriteAllText(Path.Combine(_root, "watch.emj"), "{}");
        _svc.TrySelect("watch.emj", out _);

        var fired = new TaskCompletionSource<bool>();
        _svc.OnSelectedFileChanged += () => fired.TrySetResult(true);

        // Write directly (bypassing service) to simulate external editor
        File.WriteAllText(Path.Combine(_root, "watch.emj"), """{"changed":true}""");

        var completed = await Task.WhenAny(fired.Task, Task.Delay(TimeSpan.FromSeconds(3)));
        Assert.True(fired.Task.IsCompletedSuccessfully, "file-changed event did not fire within 3s");
    }

    [Fact]
    public async Task OnFolderContentsChanged_Fires_When_File_Added()
    {
        var fired = new TaskCompletionSource<bool>();
        _svc.OnFolderContentsChanged += () => fired.TrySetResult(true);

        File.WriteAllText(Path.Combine(_root, "new.emj"), "{}");

        var completed = await Task.WhenAny(fired.Task, Task.Delay(TimeSpan.FromSeconds(3)));
        Assert.True(fired.Task.IsCompletedSuccessfully, "files-changed event did not fire within 3s");
    }

    public void Dispose()
    {
        _svc.Dispose();
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);
    }
}
