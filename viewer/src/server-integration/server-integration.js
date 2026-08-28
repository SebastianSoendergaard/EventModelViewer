        const dropdown = document.getElementById('serverFileDropdown');
        const saveStatus = document.getElementById('serverSaveStatus');

        let _selectedFile = null;
        let _selectedFormat = Codec.JSON;
        let _currentRoot = '';
        let _lastSavedContent = null; // stringified JSON as last saved to server
        let _currentJson = null;
        let _saveTimer = null;
        let _eventSource = null;
        let _conflictBanner = null;
        let _connected = false;

        function baseUrl() {
            return window.location.origin;
        }

        // ── Connection status ─────────────────────────────────────────────────

        function setConnected(connected) {
            if (_connected === connected) return;
            _connected = connected;
            const newServerBtn = document.getElementById('newServerBtn');
            if (connected) {
                setSaveStatus('clear');
                dropdown.disabled = false;
                if (newServerBtn) newServerBtn.disabled = false;
            } else {
                saveStatus.textContent = 'NO CONNECTION';
                saveStatus.className = 'server-save-status disconnected';
                dropdown.disabled = true;
                if (newServerBtn) newServerBtn.disabled = true;
            }
        }

        // ── Root folder ───────────────────────────────────────────────────────

        async function fetchRoot() {
            try {
                const res = await fetch(`${baseUrl()}/root`);
                if (!res.ok) return null;
                setConnected(true);
                const data = await res.json();
                return data.path;
            } catch (e) {
                console.warn('[server] Failed to fetch current root:', e);
                setConnected(false);
                return null;
            }
        }

        async function applySavedRootIfAny() {
            const saved = localStorage.getItem('serverSelectedRoot');
            if (!saved) return;
            try {
                const res = await fetch(`${baseUrl()}/root`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: saved })
                });
                if (!res.ok) {
                    console.warn('[server] Saved folder is no longer valid, clearing:', saved);
                    localStorage.removeItem('serverSelectedRoot');
                }
            } catch (e) {
                console.warn('[server] Failed to apply saved folder:', e);
            }
        }

        async function refreshRoot() {
            const root = await fetchRoot();
            if (root !== null) {
                _currentRoot = root;
                EventBus.emit(Events.ROOT_CHANGED, { root });
            }
        }

        // ── File list ─────────────────────────────────────────────────────────

        async function fetchFileList() {
            try {
                const res = await fetch(`${baseUrl()}/files`);
                if (!res.ok) return { files: [], truncated: false };
                setConnected(true);
                return await res.json();
            } catch (e) {
                console.warn('[server] Failed to fetch file list:', e);
                setConnected(false);
                return { files: [], truncated: false };
            }
        }

        function setDropdownLoading(loading) {
            dropdown.disabled = loading || !_connected;
            if (loading) {
                dropdown.innerHTML = '';
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Scanning for files…';
                dropdown.appendChild(opt);
            }
        }

        function setTruncatedWarning(truncated) {
            if (!truncated) {
                saveStatus.title = '';
                return;
            }
            saveStatus.title = 'Folder scan stopped early (too many subfolders or took too long) — file list may be incomplete.';
        }

        async function populateDropdown(preserveSelection) {
            setDropdownLoading(true);
            const { files, truncated } = await fetchFileList();
            const prev = preserveSelection ? dropdown.value : null;

            setTruncatedWarning(truncated);
            dropdown.innerHTML = '';

            if (files.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = '-- No files available --';
                dropdown.appendChild(opt);
                dropdown.disabled = !_connected;
                return;
            }

            files.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f;
                opt.textContent = f;
                dropdown.appendChild(opt);
            });
            dropdown.disabled = !_connected;

            // Priority: preserve current → localStorage → first
            const saved = localStorage.getItem('serverSelectedFile');
            if (prev && files.includes(prev)) {
                dropdown.value = prev;
            } else if (saved && files.includes(saved)) {
                dropdown.value = saved;
            } else {
                dropdown.value = files[0];
            }
        }

        // ── File selection ────────────────────────────────────────────────────

        async function selectFile(path) {
            if (!path) return;
            try {
                const res = await fetch(`${baseUrl()}/select`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path })
                });
                if (!res.ok) {
                    console.warn('[server] Failed to select file:', path);
                    return;
                }
                _selectedFile = path;
                _selectedFormat = Codec.formatForFileName(path);
                localStorage.setItem('serverSelectedFile', path);
                await loadSelectedFile();
            } catch (e) {
                console.warn('[server] Error selecting file:', e);
            }
        }

        async function loadSelectedFile() {
            try {
                const res = await fetch(`${baseUrl()}/selected`);
                if (!res.ok) return;
                const text = await res.text();
                const json = Codec.parse(text, _selectedFormat);
                _lastSavedContent = text;
                _currentJson = json;
                EventBus.emit(Events.FILE_LOADED, { json, fileName: _selectedFile, format: _selectedFormat });
                setSaveStatus('saved');
            } catch (e) {
                console.warn('[server] Failed to load selected file:', e);
            }
        }

        // ── Save status ───────────────────────────────────────────────────────

        function setSaveStatus(state) {
            if (state === 'saved') {
                saveStatus.textContent = 'Saved ✓';
                saveStatus.className = 'server-save-status saved';
            } else if (state === 'unsaved') {
                saveStatus.textContent = 'Unsaved changes';
                saveStatus.className = 'server-save-status unsaved';
            } else {
                saveStatus.textContent = '';
                saveStatus.className = 'server-save-status';
            }
        }

        function hasUnsavedChanges() {
            if (!_currentJson || _lastSavedContent === null) return false;
            return Codec.stringify(_currentJson, _selectedFormat) !== _lastSavedContent;
        }

        // ── Auto-save (1 s debounce, only on actual change) ──────────────────

        function scheduleAutoSave() {
            if (_saveTimer) clearTimeout(_saveTimer);
            _saveTimer = setTimeout(trySaveToServer, 1000);
        }

        async function trySaveToServer() {
            if (!_selectedFile || !_currentJson) return;
            const content = Codec.stringify(_currentJson, _selectedFormat);
            if (content === _lastSavedContent) return; // no change

            try {
                const contentType = _selectedFormat === Codec.YAML ? 'application/x-yaml' : 'application/json';
                const res = await fetch(`${baseUrl()}/selected`, {
                    method: 'PUT',
                    headers: { 'Content-Type': contentType },
                    body: content
                });
                if (res.ok) {
                    _lastSavedContent = content;
                    setSaveStatus('saved');
                } else {
                    console.warn('[server] Auto-save failed:', res.status);
                }
            } catch (e) {
                console.warn('[server] Auto-save error:', e);
            }
        }

        // ── Conflict banner ───────────────────────────────────────────────────

        function showConflictBanner() {
            if (_conflictBanner) return;

            _conflictBanner = document.createElement('div');
            _conflictBanner.className = 'server-conflict-banner';
            _conflictBanner.innerHTML =
                '<span>⚠️ File changed on disk while you have unsaved edits.</span>' +
                '<button id="conflictReload">Reload from server</button>' +
                '<button id="conflictKeep">Keep my edits</button>';
            document.body.prepend(_conflictBanner);

            document.getElementById('conflictReload').addEventListener('click', async () => {
                dismissConflictBanner();
                await loadSelectedFile();
            });
            document.getElementById('conflictKeep').addEventListener('click', () => {
                dismissConflictBanner();
                setSaveStatus('unsaved');
            });
        }

        function dismissConflictBanner() {
            if (_conflictBanner) {
                _conflictBanner.remove();
                _conflictBanner = null;
            }
        }

        // ── SSE ───────────────────────────────────────────────────────────────

        function connectSSE() {
            _eventSource = new EventSource(`${baseUrl()}/events`);

            _eventSource.addEventListener('file-changed', async () => {
                setConnected(true);
                if (hasUnsavedChanges()) {
                    showConflictBanner();
                } else {
                    await loadSelectedFile();
                }
            });

            _eventSource.addEventListener('files-changed', async () => {
                setConnected(true);
                await populateDropdown(true);
            });

            _eventSource.addEventListener('root-changed', async () => {
                setConnected(true);
                await refreshRoot();
                await populateDropdown(false);
                const path = dropdown.value;
                if (path) await selectFile(path);
            });

            _eventSource.onopen = () => {
                setConnected(true);
            };

            _eventSource.onerror = () => {
                setConnected(false);
                // EventSource reconnects automatically
            };
        }

        // ── Dropdown change ───────────────────────────────────────────────────

        dropdown.addEventListener('change', async () => {
            const path = dropdown.value;
            if (path) await selectFile(path);
        });

        // ── EventBus subscriptions ────────────────────────────────────────────

        EventBus.on(Events.JSON_CHANGED, ({ json }) => {
            _currentJson = json;
            if (hasUnsavedChanges()) {
                setSaveStatus('unsaved');
                scheduleAutoSave();
            }
        });

        EventBus.on(Events.APP_INIT, async () => {
            setConnected(false);
            await applySavedRootIfAny();
            await refreshRoot();
            await populateDropdown(false);
            const path = dropdown.value;
            if (path) await selectFile(path);
            connectSSE();
        });

        // Exposed so other IIFE-scoped modules (e.g. the server "New" button) can
        // select + load a file through the same path that keeps _selectedFile,
        // _selectedFormat and _lastSavedContent consistent for auto-save.
        window.ServerIntegration = { selectFile, populateDropdown };
