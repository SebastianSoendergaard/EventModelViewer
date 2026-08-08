using System.IO;

namespace EventModelServer;

public class FileService : IDisposable
{
    private readonly string _root;
    private string? _selectedRelative;
    private FileSystemWatcher? _fileWatcher;
    private readonly FileSystemWatcher _folderWatcher;

    public event Action? OnSelectedFileChanged;
    public event Action? OnFolderContentsChanged;

    public FileService(string root)
    {
        _root = root;

        _folderWatcher = new FileSystemWatcher(_root)
        {
            Filter = "*.json",
            IncludeSubdirectories = true,
            EnableRaisingEvents = true,
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName
        };
        _folderWatcher.Created += (_, _) => OnFolderContentsChanged?.Invoke();
        _folderWatcher.Deleted += (_, _) => OnFolderContentsChanged?.Invoke();
        _folderWatcher.Renamed += (_, _) => OnFolderContentsChanged?.Invoke();
    }

    /// <summary>Returns relative paths of all .json files under root.</summary>
    public IReadOnlyList<string> GetFiles()
    {
        if (!Directory.Exists(_root)) return [];

        return Directory
            .EnumerateFiles(_root, "*.json", SearchOption.AllDirectories)
            .Select(f => Path.GetRelativePath(_root, f).Replace('\\', '/'))
            .OrderBy(f => f)
            .ToList();
    }

    /// <summary>Selects a file by relative path. Returns false + error if invalid.</summary>
    public bool TrySelect(string relativePath, out string error)
    {
        var full = FullPath(relativePath);
        if (!File.Exists(full))
        {
            error = $"File not found: {relativePath}";
            return false;
        }

        _selectedRelative = relativePath;
        RewireFileWatcher(full);
        error = string.Empty;
        return true;
    }

    public string? GetSelectedContent()
    {
        if (_selectedRelative is null) return null;
        var full = FullPath(_selectedRelative);
        return File.Exists(full) ? File.ReadAllText(full) : null;
    }

    public bool TryUpdateSelected(string content, out string error)
    {
        if (_selectedRelative is null)
        {
            error = "No file selected";
            return false;
        }
        var full = FullPath(_selectedRelative);
        if (!File.Exists(full))
        {
            error = $"Selected file no longer exists: {_selectedRelative}";
            return false;
        }

        // Pause watcher to avoid self-triggered event
        if (_fileWatcher is not null) _fileWatcher.EnableRaisingEvents = false;
        try { File.WriteAllText(full, content); }
        finally { if (_fileWatcher is not null) _fileWatcher.EnableRaisingEvents = true; }

        error = string.Empty;
        return true;
    }

    public bool TryCreateFile(string name, out string error)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            error = "File name cannot be empty";
            return false;
        }

        if (name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0
            || name.Contains('/')
            || name.Contains('\\'))
        {
            error = "File name contains invalid characters or path separators";
            return false;
        }

        var full = FullPath(name);
        if (File.Exists(full))
        {
            error = $"File already exists: {name}";
            return false;
        }

        File.WriteAllText(full, "{}");
        error = string.Empty;
        return true;
    }

    public string? SelectedRelative => _selectedRelative;

    private string FullPath(string relative) =>
        Path.GetFullPath(Path.Combine(_root, relative));

    private void RewireFileWatcher(string fullPath)
    {
        _fileWatcher?.Dispose();
        var dir = Path.GetDirectoryName(fullPath)!;
        var file = Path.GetFileName(fullPath);

        _fileWatcher = new FileSystemWatcher(dir, file)
        {
            NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.Size,
            EnableRaisingEvents = true
        };
        _fileWatcher.Changed += (_, _) => OnSelectedFileChanged?.Invoke();
    }

    public void Dispose()
    {
        _fileWatcher?.Dispose();
        _folderWatcher.Dispose();
    }
}
