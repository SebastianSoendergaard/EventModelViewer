# Fixed Kestrel port; drop the `--root` argument

Persisting the selected root folder in `localStorage` (ADR 0001) requires the browser's origin to stay the same across launches. Kestrel previously bound to port `0` (`Listen(IPAddress.Loopback, 0)`), letting the OS assign a different ephemeral port every run — which would silently break that persistence, since `localStorage` is scoped per-origin (`http://127.0.0.1:<port>`). Separately, the `--root` command-line argument became redundant now that the folder is chosen and remembered from the UI.

We switched Kestrel to listen on a fixed port, falling back to an OS-assigned ephemeral port only if the fixed one is already taken, and removed `--root` entirely in favor of the in-app folder browser + persisted selection.

**Consequences:** if two instances run simultaneously, the second falls back to an ephemeral port and its `localStorage`-based folder memory won't survive a restart for that instance. Anyone previously scripting `EventModelServer.exe --root <path>` must switch to using the in-app folder browser (or `POST /root`) instead.
