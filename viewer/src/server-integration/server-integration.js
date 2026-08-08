        const dropdown = document.getElementById('serverFileDropdown');
        const saveStatus = document.getElementById('serverSaveStatus');

        let _selectedFile = null;
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

        // ── File list ─────────────────────────────────────────────────────────

        async function fetchFileList() {
            try {
                const res = await fetch(`${baseUrl()}/files`);
                if (!res.ok) return [];
                setConnected(true);
                return await res.json();
            } catch (e) {
                console.warn('[server] Failed to fetch file list:', e);
                setConnected(false);
                return [];
            }
        }

        async function populateDropdown(preserveSelection) {
            const files = await fetchFileList();
            const prev = preserveSelection ? dropdown.value : null;

            dropdown.innerHTML = '';

            if (files.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = '-- No files available --';
                dropdown.appendChild(opt);
                return;
            }

            files.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f;
                opt.textContent = f;
                dropdown.appendChild(opt);
            });

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
                const json = JSON.parse(text);
                _lastSavedContent = text;
                _currentJson = json;
                EventBus.emit(Events.FILE_LOADED, { json, fileName: _selectedFile });
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
            return JSON.stringify(_currentJson, null, 2) !== _lastSavedContent;
        }

        // ── Auto-save (1 s debounce, only on actual change) ──────────────────

        function scheduleAutoSave() {
            if (_saveTimer) clearTimeout(_saveTimer);
            _saveTimer = setTimeout(trySaveToServer, 1000);
        }

        async function trySaveToServer() {
            if (!_selectedFile || !_currentJson) return;
            const content = JSON.stringify(_currentJson, null, 2);
            if (content === _lastSavedContent) return; // no change

            try {
                const res = await fetch(`${baseUrl()}/selected`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
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
            await populateDropdown(false);
            const path = dropdown.value;
            if (path) await selectFile(path);
            connectSSE();
        });
