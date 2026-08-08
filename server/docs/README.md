# EventModelServer

A self-contained Windows desktop application that hosts the Event Model Viewer locally. Double-click the `.exe` (or run it from a terminal) and a browser opens straight to the viewer — no Node, no IIS, no configuration required.

## Quick start

```cmd
EventModelServer.exe
```

Opens `http://127.0.0.1:<port>` in your default browser. The port is chosen automatically by the OS.

To scan a specific folder for JSON files instead of the folder the exe lives in:

```cmd
EventModelServer.exe --root "C:\my-event-models"
```

## Building

From the repo root, run:

```cmd
build_server.cmd
```

This publishes a single self-contained `win-x64` exe and copies it to the repo root as `EventModelServer.exe`. Requires the [.NET 9 SDK](https://dotnet.microsoft.com/download).

## HTTP API

All endpoints are served on `http://127.0.0.1:<port>` where `<port>` is printed to the console on startup.

---

### `GET /`

Serves the embedded `event-model-viewer.html` application.

**Response:** `200 OK`, `Content-Type: text/html`

---

### `GET /files`

Returns a JSON array of all `.json` files found under the root folder (recursive), as relative paths with forward slashes.

**Response:** `200 OK`

```json
["em.json", "examples/shopping-cart.json"]
```

---

### `POST /files`

Creates a new `.json` file in the root folder with content `{}`.

**Request body:**

```json
{ "name": "my-model.json" }
```

**Responses:**

| Status | Meaning |
|--------|---------|
| `201 Created` | File created — `{ "path": "my-model.json" }` |
| `400 Bad Request` | `name` missing, empty, contains invalid characters or path separators, or file already exists |

---

### `POST /select`

Selects a file to work with. Subsequent calls to `/selected` operate on this file. A `FileSystemWatcher` is attached to it immediately, so external editor saves trigger a `file-changed` SSE event.

**Request body:**

```json
{ "path": "em.json" }
```

**Responses:**

| Status | Meaning |
|--------|---------|
| `200 OK` | File selected — `{ "selected": "em.json" }` |
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
| `files-changed` | A `.json` file was added, removed, or renamed anywhere under the root folder | `{}` |

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

- Scans the root folder recursively for `*.json` files.
- Tracks one selected file at a time.
- Owns a `FileSystemWatcher` on the selected file (rewired on each `TrySelect` call).
- Owns a second `FileSystemWatcher` on the root folder to detect added/removed `.json` files.
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

The solution includes an xUnit test project (`EventModelServer.Tests`) with 24 tests:

- **EndpointTests** — integration tests using `WebApplicationFactory<Program>` covering all HTTP endpoints and SSE service behaviour.
- **FileServiceTests** — unit tests for file scanning, selection, content read/write, and `FileSystemWatcher` event firing.

Run tests with:

```cmd
cd server
dotnet test
```
