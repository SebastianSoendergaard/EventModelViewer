# EventModelServer

A self-contained Windows desktop application that hosts the Event Model Viewer locally. Double-click the `.exe` (or run it from a terminal) and a browser opens straight to the viewer — no Node, no IIS, no configuration required.

## Quick start

```cmd
EventModelServer.exe
```

Opens `http://127.0.0.1:55231` in your default browser (falling back to an OS-assigned port if `55231` is already in use).

By default it scans the folder the exe lives in for `.emj` files. Use the **📁 Folder** button in the viewer's toolbar to browse to and select a different folder — the choice is remembered (via the browser's `localStorage`) so the next launch opens on the same folder automatically.

## Building

From the repo root, run:

```cmd
build_server.cmd
```

This publishes a single self-contained `win-x64` exe and copies it to the repo root as `EventModelServer.exe`. Requires the [.NET 9 SDK](https://dotnet.microsoft.com/download).

## HTTP API

All endpoints are served on `http://127.0.0.1:<port>` where `<port>` is printed to the console on startup (`55231` unless already taken).

---

### `GET /`

Serves the embedded `event-model-viewer.html` application.

**Response:** `200 OK`, `Content-Type: text/html`

---

### `GET /root`

Returns the folder currently being scanned for `.emj` files.

**Response:** `200 OK`

```json
{ "path": "C:\\my-event-models" }
```

---

### `GET /root/browse`

Lists the subfolders of `path` (query string), for building an in-app folder picker. An empty/omitted `path` lists the available drives instead.

**Response:** `200 OK`

```json
{
  "path": "C:\\my-event-models",
  "parent": "C:\\",
  "folders": [{ "name": "examples", "path": "C:\\my-event-models\\examples" }]
}
```

`parent` is `null` only at the drive list (nothing to go up to). Folders that error while being enumerated (e.g. access denied) are silently skipped.

**Responses:**

| Status | Meaning |
|--------|---------|
| `200 OK` | Listing returned |
| `400 Bad Request` | `path` does not exist or is otherwise invalid |

---

### `POST /root`

Switches the active root folder. Resets the current file selection, rewires the folder/file watchers, and broadcasts a `root-changed` SSE event to all connected clients.

**Request body:**

```json
{ "path": "C:\\my-event-models" }
```

**Responses:**

| Status | Meaning |
|--------|---------|
| `200 OK` | Root switched — `{ "root": "...", "files": [...] }` |
| `400 Bad Request` | `path` missing, or folder does not exist |

---

### `GET /files`

Returns a JSON array of all `.emj` files found under the root folder (recursive), as relative paths with forward slashes.

**Response:** `200 OK`

```json
["em.emj", "examples/shopping-cart.emj"]
```

---

### `POST /files`

Creates a new `.emj` file in the root folder with content `{}`.

**Request body:**

```json
{ "name": "my-model.emj" }
```

**Responses:**

| Status | Meaning |
|--------|---------|
| `201 Created` | File created — `{ "path": "my-model.emj" }` |
| `400 Bad Request` | `name` missing, empty, contains invalid characters or path separators, or file already exists |

---

### `POST /select`

Selects a file to work with. Subsequent calls to `/selected` operate on this file. A `FileSystemWatcher` is attached to it immediately, so external editor saves trigger a `file-changed` SSE event.

**Request body:**

```json
{ "path": "em.emj" }
```

**Responses:**

| Status | Meaning |
|--------|---------|
| `200 OK` | File selected — `{ "selected": "em.emj" }` |
| `400 Bad Request` | `path` missing or file does not exist |

---

### `GET /selected`

Returns the raw content of the currently selected file.

**Responses:**

| Status | Meaning |
|--------|---------|
| `200 OK` | File content, `Content-Type: application/json` |
| `404 Not Found` | No file has been selected yet |

---

### `PUT /selected`

Overwrites the content of the currently selected file. The `FileSystemWatcher` is paused during the write to avoid a spurious `file-changed` event.

**Request body:** Raw JSON string (the new file content)

**Responses:**

| Status | Meaning |
|--------|---------|
| `200 OK` | File written successfully |
| `400 Bad Request` | No file selected, or selected file no longer exists |

---

### `GET /events`

Server-Sent Events stream. Connect once; the server pushes events as they occur. All connected clients receive every broadcast.

**Response headers:**

```
Content-Type: text/event-stream
Cache-Control: no-cache
```

**Event types:**

| Event name | When fired | Data |
|------------|-----------|------|
| `file-changed` | The selected file was modified by an external editor | `{}` |
| `files-changed` | An `.emj` file was added, removed, or renamed anywhere under the root folder | `{}` |
| `root-changed` | The active root folder was switched via `POST /root` | `{}` |

**Example stream:**

```
event: file-changed
data: {}

event: files-changed
data: {}
```

**JavaScript example:**

```js
const es = new EventSource('/events');

es.addEventListener('file-changed', () => {
    // Reload selected file content from GET /selected
});

es.addEventListener('files-changed', () => {
    // Refresh file list from GET /files
});
```

---

## Architecture

```
EventModelServer/
├── Program.cs       # Minimal API host: endpoints, browser launch, watcher wiring
├── FileService.cs   # File scanning, selection, read/write, FileSystemWatcher
└── SseService.cs    # Channel-based SSE broadcast to all connected clients
```

### FileService

- Scans the active root folder recursively for `*.emj` files.
- The root folder is mutable (`TrySetRoot`) — switching it clears the current selection and rewires both watchers to the new location; `Browse` powers the in-app folder picker (subfolders, or drives when given an empty path).
- Tracks one selected file at a time.
- Owns a `FileSystemWatcher` on the selected file (rewired on each `TrySelect` call).
- Owns a second `FileSystemWatcher` on the root folder to detect added/removed `.emj` files.
- Pauses the file watcher during `TryUpdateSelected` writes to avoid self-triggered events.

### SseService

- Maintains an unbounded `Channel<(string evt, string data)>` per connected client.
- `Broadcast` writes to every channel; each SSE handler drains its own channel and writes to the HTTP response.
- Channels are cleaned up when the client disconnects (cancellation → `finally` block).

### Single-file publish

The project is configured for `PublishSingleFile=true`, `SelfContained=true`, `RuntimeIdentifier=win-x64`. The `event-model-viewer-for-server.html` file from the repo root is embedded as a managed resource at build time via:

```xml
<EmbeddedResource Include="..\..\event-model-viewer-for-server.html"
                  LogicalName="event-model-viewer.html" />
```

It is served by reading the embedded stream at runtime — no file on disk is needed. Run `node viewer/build.js` from the repo root (or `build_server.cmd`) to regenerate both HTML files before publishing.

## Tests

The solution includes an xUnit test project (`EventModelServer.Tests`) with 43 tests:

- **EndpointTests** — integration tests using `WebApplicationFactory<Program>` covering all HTTP endpoints and SSE service behaviour.
- **FileServiceTests** — unit tests for file scanning, selection, content read/write, and `FileSystemWatcher` event firing.

Run tests with:

```cmd
cd server
dotnet test
```
