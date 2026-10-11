using System.Diagnostics;
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

/// <summary>
/// Result of scanning root for Event Model files (.emj/.emy). <see cref="Truncated"/>
/// is true when the scan was stopped early by <see cref="FileService.MaxScanFolders"/>
/// or <see cref="FileService.MaxScanDuration"/> being reached, meaning the file list
/// may be incomplete.
/// </summary>
public record FileScanResult(IReadOnlyList<string> Files, bool Truncated);

public class FileService : IDisposable
{
    public sealed record FileScanUpdate(string Type, string? Path = null, bool? Truncated = null);

    /// <summary>Hard cap on folders visited during a scan, guarding against huge trees (e.g. a drive root).</summary>
    public const int MaxScanFolders = 20_000;

    /// <summary>Hard cap on wall-clock time spent scanning, guarding against slow/huge trees.</summary>
    public static readonly TimeSpan MaxScanDuration = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Search patterns for the two Event Model encodings: ".emj" (JSON) and ".emy"
    /// (YAML) — same schema either way (see CONTEXT.md). The server never parses
    /// either; it only needs to recognize them by extension for scanning/watching.
    /// </summary>
    private static readonly string[] FilePatterns = ["*.emj", "*.emy"];

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

    /// <summary>The folder currently scanned for .emj/.emy files.</summary>
    public string Root => _root;

    private FileSystemWatcher CreateFolderWatcher(string root)
    {
        var watcher = new FileSystemWatcher(root)
        {
            IncludeSubdirectories = true,
            EnableRaisingEvents = true,
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName
        };
        foreach (var pattern in FilePatterns)
        {
            watcher.Filters.Add(pattern);
        }
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

    /// <summary>
    /// Scans root for .emj/.emy files. Bounded by <see cref="MaxScanFolders"/> and
    /// <see cref="MaxScanDuration"/> so a very large tree (e.g. a whole drive) can't hang
    /// indefinitely; when a limit is hit, the scan stops early and returns whatever it
    /// found so far with <see cref="FileScanResult.Truncated"/> set to true.
    /// </summary>
    public FileScanResult GetFiles()
    {
        var files = new List<string>();
        var truncated = false;
        foreach (var update in GetFilesAsStream())
        {
            if (update.Type == "file" && update.Path is not null)
                files.Add(update.Path);
            else if (update.Type == "complete")
                truncated = update.Truncated ?? false;
        }

        files.Sort(StringComparer.Ordinal);
        return new FileScanResult(files, truncated);
    }

    public IEnumerable<FileScanUpdate> GetFilesAsStream(System.Threading.CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(_root))
        {
            yield return new FileScanUpdate("complete", Truncated: false);
            yield break;
        }

        var stopwatch = Stopwatch.StartNew();
        var foldersVisited = 0;
        var truncated = false;
        var pending = new Queue<string>();
        pending.Enqueue(_root);

        while (pending.Count > 0)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (foldersVisited >= MaxScanFolders || stopwatch.Elapsed >= MaxScanDuration)
            {
                truncated = true;
                break;
            }

            var directory = pending.Dequeue();
            foldersVisited++;

            foreach (var pattern in FilePatterns)
            {
                using var files = TryGetFileEnumerator(directory, pattern);
                while (files is not null && TryMoveNext(files, out var file))
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    yield return new FileScanUpdate("file", Path.GetRelativePath(_root, file).Replace('\\', '/'));
                }
            }

            using var directories = TryGetDirectoryEnumerator(directory);
            while (directories is not null && TryMoveNext(directories, out var subdirectory))
            {
                pending.Enqueue(subdirectory);
            }
        }

        yield return new FileScanUpdate("complete", Truncated: truncated);
    }

    private static System.Collections.Generic.IEnumerator<string>? TryGetFileEnumerator(string directory, string pattern)
    {
        try
        {
            return Directory.EnumerateFiles(directory, pattern).GetEnumerator();
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException or SecurityException)
        {
            return null;
        }
    }

    private static System.Collections.Generic.IEnumerator<string>? TryGetDirectoryEnumerator(string directory)
    {
        try
        {
            return Directory.EnumerateDirectories(directory).GetEnumerator();
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException or SecurityException)
        {
            return null;
        }
    }

    private static bool TryMoveNext(System.Collections.Generic.IEnumerator<string> enumerator, out string path)
    {
        try
        {
            if (enumerator.MoveNext())
            {
                path = enumerator.Current;
                return true;
            }
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException or SecurityException)
        {
        }

        path = string.Empty;
        return false;
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
        if (File.Exists(full) || Directory.Exists(full))
        {
            error = $"File already exists: {name}";
            return false;
        }

        var content = Path.GetExtension(name).Equals(".emy", StringComparison.OrdinalIgnoreCase)
            ? "title: \"\"\nslices: []\n"
            : "{\n  \"title\": \"\",\n  \"slices\": []\n}";

        FileStream stream;
        try
        {
            stream = new FileStream(full, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        }
        catch (IOException) when (File.Exists(full) || Directory.Exists(full))
        {
            error = $"File already exists: {name}";
            return false;
        }

        using (stream)
        using (var writer = new StreamWriter(stream))
        {
            writer.Write(content);
        }

        error = string.Empty;
        return true;
    }

    public string? SelectedRelative => _selectedRelative;

    /// <summary>
    /// Writes a batch of generated files (e.g. the "Export as Tasks" Markdown files)
    /// into an arbitrary destination folder — independent of <see cref="Root"/>; does
    /// not touch the active root or its watchers. The destination must already exist
    /// (it's chosen via the same folder-browse flow used elsewhere). Overwrites
    /// existing files with the same name by design — this is expected to be a
    /// generated-output folder. Validates every file name before writing any of them,
    /// so a bad entry doesn't leave a partial batch on disk.
    /// </summary>
    public bool TryExportFiles(string targetFolder, IReadOnlyList<(string Name, string Content)> files, out string error, out IReadOnlyList<string> written)
    {
        written = [];

        if (string.IsNullOrWhiteSpace(targetFolder))
        {
            error = "Target folder cannot be empty";
            return false;
        }

        string full;
        try { full = Path.GetFullPath(targetFolder); }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            error = "Invalid target folder";
            return false;
        }

        if (!Directory.Exists(full))
        {
            error = $"Folder not found: {full}";
            return false;
        }

        if (files.Count == 0)
        {
            error = "No files to write";
            return false;
        }

        foreach (var (name, _) in files)
        {
            if (string.IsNullOrWhiteSpace(name)
                || name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0
                || name.Contains('/')
                || name.Contains('\\'))
            {
                error = $"Invalid file name: {name}";
                return false;
            }
        }

        var writtenNames = new List<string>();
        foreach (var (name, content) in files)
        {
            File.WriteAllText(Path.Combine(full, name), content);
            writtenNames.Add(name);
        }

        written = writtenNames;
        error = string.Empty;
        return true;
    }

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
