using System.IO;
using System.Security;

namespace EventModelServer;

/// <summary>One entry in a folder listing (a subfolder or a drive).</summary>
public record FolderEntry(string Name, string Path);

/// <summary>
/// Result of browsing a directory: the resolved path, the parent to navigate back to
/// (null when there is no parent, e.g. at the drive list), and its immediate subfolders.
/// </summary>
public record BrowseResult(string Path, string? Parent, IReadOnlyList<FolderEntry> Folders);

public class FileService : IDisposable
{
    private string _root;
    private string? _selectedRelative;
    private FileSystemWatcher? _fileWatcher;
    private FileSystemWatcher _folderWatcher;

    public event Action? OnSelectedFileChanged;
    public event Action? OnFolderContentsChanged;

    public FileService(string root)
    {
        _root = root;
        _folderWatcher = CreateFolderWatcher(_root);
    }

    /// <summary>The folder currently scanned for .emj files.</summary>
    public string Root => _root;

    private FileSystemWatcher CreateFolderWatcher(string root)
    {
        var watcher = new FileSystemWatcher(root)
        {
            Filter = "*.emj",
            IncludeSubdirectories = true,
            EnableRaisingEvents = true,
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName
        };
        watcher.Created += (_, _) => OnFolderContentsChanged?.Invoke();
        watcher.Deleted += (_, _) => OnFolderContentsChanged?.Invoke();
        watcher.Renamed += (_, _) => OnFolderContentsChanged?.Invoke();
        return watcher;
    }

    /// <summary>Switches the active root folder. Returns false + error if invalid.</summary>
    public bool TrySetRoot(string newRoot, out string error)
    {
        if (string.IsNullOrWhiteSpace(newRoot))
        {
            error = "Path cannot be empty";
            return false;
        }

        string full;
        try { full = Path.GetFullPath(newRoot); }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            error = "Invalid path";
            return false;
        }

        if (!Directory.Exists(full))
        {
            error = $"Folder not found: {full}";
            return false;
        }

        _root = full;
        _selectedRelative = null;

        _fileWatcher?.Dispose();
        _fileWatcher = null;

        _folderWatcher.Dispose();
        _folderWatcher = CreateFolderWatcher(_root);

        error = string.Empty;
        return true;
    }

    /// <summary>
    /// Lists the subfolders of <paramref name="path"/>, plus the parent to navigate back to.
    /// A null/empty path lists the available drives. Returns null for an invalid path.
    /// </summary>
    public BrowseResult? Browse(string? path)
    {
        if (string.IsNullOrEmpty(path))
        {
            var drives = DriveInfo.GetDrives()
                .Where(d => d.IsReady)
                .Select(d => new FolderEntry(d.Name, d.Name))
                .OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
            return new BrowseResult(string.Empty, null, drives);
        }

        string full;
        try { full = Path.GetFullPath(path); }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return null;
        }

        if (!Directory.Exists(full)) return null;

        string? parent;
        try { parent = Directory.GetParent(full)?.FullName ?? string.Empty; }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException or SecurityException)
        {
            parent = string.Empty;
        }

        List<FolderEntry> folders;
        try
        {
            folders = Directory.EnumerateDirectories(full)
                .Select(d => new FolderEntry(Path.GetFileName(d), d))
                .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException or SecurityException)
        {
            folders = [];
        }

        return new BrowseResult(full, parent, folders);
    }

    /// <summary>Returns relative paths of all .emj files under root.</summary>
    public IReadOnlyList<string> GetFiles()
    {
        if (!Directory.Exists(_root)) return [];

        return Directory
            .EnumerateFiles(_root, "*.emj", SearchOption.AllDirectories)
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
