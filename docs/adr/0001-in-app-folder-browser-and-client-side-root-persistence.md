# In-app folder browser with client-side root persistence

The server-integrated viewer needs to let the user pick which folder `EventModelServer` scans for `.emj` files, instead of it being fixed at process start, and remember that choice across app restarts. We built a custom, server-driven directory browser (subfolder + drive listing endpoints rendered in a modal) rather than a native OS folder dialog, and we persist the chosen folder in the browser's `localStorage` rather than a server-side settings file.

We chose the in-app browser because a native dialog would require retargeting the server to a Windows-only TFM and native interop, whereas a custom browser reuses the existing client/server HTTP split already used for file selection and stays UI-framework-free. We chose client-side (`localStorage`) persistence to keep the same ownership model already used for the selected file (`serverSelectedFile`) — all "remembered state" lives with the client, and the server stays a stateless reflection of whatever root it's told to use.

**Consequence:** this only works if the browser's origin is stable across launches — see ADR 0002. The server holds exactly one root folder for the whole process (not per-client); if multiple browser tabs connect to the same running instance, they share the same root.
