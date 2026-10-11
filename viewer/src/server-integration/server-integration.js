        const dropdown = document.getElementById('serverFileDropdown');
        const saveStatus = document.getElementById('serverSaveStatus');
        const fileError = document.getElementById('serverFileError');

        let _selectedFile = null;
        let _selectedFormat = Codec.JSON;
        let _currentRoot = '';
        let _lastSavedContent = null; // stringified JSON as last saved to server
        let _currentJson = null;
        let _saveTimer = null;
        let _eventSource = null;
        let _conflictBanner = null;
        let _connected = false;
        let _fileScanController = null;
        let _fileScanGeneration = 0;
        let _selectionGeneration = 0;
        let _selectionQueue = Promise.resolve();

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
                dropdown.disabled = !Array.from(dropdown.options).some(option => option.value);
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

        function setDropdownLoading(loading, preserveSelection = false) {
            if (loading && !preserveSelection) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Scanning for files…';
                dropdown.replaceChildren(option);
            }

            const hasFiles = Array.from(dropdown.options).some(option => option.value);
            dropdown.disabled = !_connected || !hasFiles;
            dropdown.title = loading ? 'Searching for .emj and .emy files…' : 'Select a file from server';
        }

        function setTruncatedWarning(truncated) {
            if (!truncated) {
                saveStatus.title = '';
                return;
            }
            saveStatus.title = 'Folder scan stopped early (too many subfolders or took too long) — file list may be incomplete.';
        }

        function clearFileError() {
            fileError.textContent = '';
            fileError.title = '';
            fileError.hidden = true;
        }

        function getErrorLocation(error, text, format) {
            if (error?.mark && Number.isInteger(error.mark.line) && Number.isInteger(error.mark.column)) {
                return { line: error.mark.line + 1, column: error.mark.column + 1 };
            }

            if (format === Codec.JSON) {
                const match = String(error?.message || '').match(/position\s+(\d+)/i);
                if (match) {
                    const position = Math.min(Number(match[1]), text.length);
                    const beforeError = text.slice(0, position);
                    const lineStart = beforeError.lastIndexOf('\n') + 1;
                    return {
                        line: (beforeError.match(/\n/g) || []).length + 1,
                        column: position - lineStart + 1
                    };
                }
            }

            return null;
        }

        function formatFileError(path, error, text = '', format = null) {
            const message = String(error?.message || error);
            if (!path) return `File search failed: ${message}`;

            const formatLabel = format === Codec.YAML ? 'YAML (.emy)' : 'JSON (.emj)';
            const isSyntaxError = error instanceof SyntaxError || Boolean(error?.mark);
            const location = getErrorLocation(error, text, format);
            const locationText = location ? ` at line ${location.line}, column ${location.column}` : '';
            const prefix = isSyntaxError
                ? `Could not parse ${path} as ${formatLabel}`
                : `Could not open ${path}`;
            const punctuation = message.endsWith('.') ? '' : '.';
            const expected = isSyntaxError ? ` Expected ${formatLabel} content.` : '';
            return `${prefix}${locationText}: ${message}${punctuation}${expected} Select another file.`;
        }

        function showFileError(path, error, text = '', format = null) {
            const message = formatFileError(path, error, text, format);
            fileError.textContent = message;
            fileError.title = message;
            fileError.hidden = false;
        }

        function addFileOption(path) {
            if (Array.from(dropdown.options).some(option => option.value === path)) return false;

            const selected = dropdown.value;
            const option = document.createElement('option');
            option.value = path;
            option.textContent = path;
            const options = Array.from(dropdown.options).filter(item => item.value);
            options.push(option);
            options.sort((left, right) => left.value < right.value ? -1 : left.value > right.value ? 1 : 0);
            dropdown.replaceChildren(...options);

            if (selected && options.some(item => item.value === selected)) {
                dropdown.value = selected;
            } else {
                dropdown.value = path;
            }
            dropdown.disabled = !_connected;
            return true;
        }

        async function readFileDiscovery(onFile, signal) {
            const response = await fetch(`${baseUrl()}/files/stream`, { signal });
            if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);
            if (!response.body) throw new Error('The server does not support streamed file discovery');
            setConnected(true);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let complete = null;

            function processLine(line) {
                if (!line.trim()) return;
                if (complete) throw new Error('The server sent data after scan completion');
                const update = JSON.parse(line);
                if (update.type === 'file' && typeof update.path === 'string') {
                    onFile(update.path);
                } else if (update.type === 'complete' && typeof update.truncated === 'boolean') {
                    complete = { truncated: update.truncated };
                } else {
                    throw new Error('The server sent an invalid file-discovery record');
                }
            }

            while (true) {
                const { value, done } = await reader.read();
                buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
                let newline = buffer.indexOf('\n');
                while (newline >= 0) {
                    processLine(buffer.slice(0, newline));
                    buffer = buffer.slice(newline + 1);
                    newline = buffer.indexOf('\n');
                }
                if (done) break;
            }

            if (buffer.trim()) processLine(buffer);
            if (!complete) throw new Error('The server ended file discovery before reporting completion');
            return complete;
        }

        async function populateDropdown(preserveSelection) {
            _fileScanController?.abort();
            const controller = new AbortController();
            _fileScanController = controller;
            const scanGeneration = ++_fileScanGeneration;
            const previousSelection = preserveSelection ? dropdown.value || _selectedFile : null;
            const discovered = new Set();
            let autoOpenFirst = !preserveSelection || !previousSelection;

            if (!preserveSelection) {
                _selectionGeneration++;
                _selectedFile = null;
                clearFileError();
            }

            setTruncatedWarning(false);
            setDropdownLoading(true, preserveSelection);

            try {
                const { truncated } = await readFileDiscovery(path => {
                    if (scanGeneration !== _fileScanGeneration) return;
                    discovered.add(path);
                    addFileOption(path);

                    if (autoOpenFirst) {
                        autoOpenFirst = false;
                        dropdown.value = path;
                        void selectFile(path);
                    }
                }, controller.signal);

                if (scanGeneration !== _fileScanGeneration) return;
                setTruncatedWarning(truncated);

                for (const option of Array.from(dropdown.options)) {
                    if (option.value && !discovered.has(option.value)) option.remove();
                }

                const available = Array.from(dropdown.options).filter(option => option.value);
                if (previousSelection && discovered.has(previousSelection)) {
                    dropdown.value = previousSelection;
                } else if (available.length && previousSelection) {
                    dropdown.value = available[0].value;
                    void selectFile(available[0].value);
                }

                if (available.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = '-- No files available --';
                    dropdown.replaceChildren(option);
                }
            } catch (error) {
                if (controller.signal.aborted || error?.name === 'AbortError') return;
                console.warn('[server] Failed to discover files:', error);
                if (scanGeneration === _fileScanGeneration) {
                    setConnected(false);
                    showFileError(null, error);
                    if (!Array.from(dropdown.options).some(option => option.value)) {
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = '-- File search failed --';
                        dropdown.replaceChildren(option);
                    }
                }
            } finally {
                if (scanGeneration === _fileScanGeneration) {
                    _fileScanController = null;
                    setDropdownLoading(false);
                }
            }
        }

        // ── File selection ────────────────────────────────────────────────────

        function selectFile(path) {
            if (!path) return Promise.resolve();
            const selectionGeneration = ++_selectionGeneration;
            clearFileError();

            const selection = _selectionQueue.then(async () => {
                if (selectionGeneration !== _selectionGeneration) return;
                try {
                    const response = await fetch(`${baseUrl()}/select`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path })
                    });
                    if (!response.ok) {
                        throw new Error(`Server returned HTTP ${response.status}`);
                    }
                    if (selectionGeneration !== _selectionGeneration) return;

                    _selectedFile = path;
                    _selectedFormat = Codec.formatForFileName(path);
                    localStorage.setItem('serverSelectedFile', path);
                    await loadSelectedFile(selectionGeneration);
                } catch (error) {
                    console.warn('[server] Error selecting file:', error);
                    if (selectionGeneration === _selectionGeneration) {
                        showFileError(path, error, '', Codec.formatForFileName(path));
                    }
                }
            });
            _selectionQueue = selection;
            return selection;
        }

        async function loadSelectedFile(selectionGeneration = _selectionGeneration) {
            let text = '';
            try {
                const response = await fetch(`${baseUrl()}/selected`);
                if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);
                text = await response.text();
                if (selectionGeneration !== _selectionGeneration) return;
                const json = Codec.parse(text, _selectedFormat);
                clearFileError();
                _lastSavedContent = text;
                _currentJson = json;
                EventBus.emit(Events.FILE_LOADED, {
                    json,
                    fileName: _selectedFile,
                    format: _selectedFormat,
                    presentationIdentity: {
                        type: 'server',
                        root: _currentRoot,
                        path: _selectedFile
                    }
                });
                setSaveStatus('saved');
            } catch (error) {
                console.warn('[server] Failed to load selected file:', error);
                if (selectionGeneration === _selectionGeneration) {
                    showFileError(_selectedFile, error, text, _selectedFormat);
                }
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
                    await _selectionQueue;
                    await loadSelectedFile(_selectionGeneration);
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
            connectSSE();
            await populateDropdown(false);
        });

        // Exposed so other IIFE-scoped modules (e.g. the server "New" button) can
        // select + load a file through the same path that keeps _selectedFile,
        // _selectedFormat and _lastSavedContent consistent for auto-save.
        window.ServerIntegration = { selectFile, populateDropdown };
