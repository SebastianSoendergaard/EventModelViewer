        const changeFolderBtn = document.getElementById('changeFolderBtn');
        const currentRootLabel = document.getElementById('currentRootLabel');

        // The modal is appended directly to <body> (not left inside the toolbar),
        // because the toolbar uses `backdrop-filter`, which creates a new containing
        // block for `position: fixed` descendants and would confine the overlay to
        // the toolbar's own height instead of covering the viewport.
        const folderOverlay = document.createElement('div');
        folderOverlay.className = 'folder-browser-overlay';
        folderOverlay.innerHTML = `
            <div class="folder-browser-modal">
                <h2>Select Folder</h2>
                <div class="folder-browser-path" id="folderBrowserPath"></div>
                <div class="folder-browser-list" id="folderBrowserList"></div>
                <div class="folder-browser-error" id="folderBrowserError"></div>
                <div class="folder-browser-actions">
                    <button id="folderBrowserCancel">Cancel</button>
                    <button id="folderBrowserSelect">Select Current Folder</button>
                </div>
            </div>
        `;
        document.body.appendChild(folderOverlay);

        const folderPathEl = folderOverlay.querySelector('#folderBrowserPath');
        const folderListEl = folderOverlay.querySelector('#folderBrowserList');
        const folderErrorEl = folderOverlay.querySelector('#folderBrowserError');
        const folderCancelBtn = folderOverlay.querySelector('#folderBrowserCancel');
        const folderSelectBtn = folderOverlay.querySelector('#folderBrowserSelect');

        let _currentRoot = '';
        let _browsePath = null; // folder currently shown in the browser ("" = drive list)

        function baseUrl() {
            return window.location.origin;
        }

        // ── Modal open/close ─────────────────────────────────────────────────

        function openFolderBrowser() {
            folderErrorEl.textContent = '';
            folderOverlay.classList.add('visible');
            browseTo(_currentRoot || '');
        }

        function closeFolderBrowser() {
            folderOverlay.classList.remove('visible');
        }

        // ── Browsing ─────────────────────────────────────────────────────────

        async function browseTo(path) {
            try {
                const res = await fetch(`${baseUrl()}/root/browse?path=${encodeURIComponent(path)}`);
                if (!res.ok) {
                    folderErrorEl.textContent = 'Could not browse that folder.';
                    return;
                }
                const data = await res.json();
                renderFolderBrowser(data);
            } catch (e) {
                folderErrorEl.textContent = 'Error browsing folder: ' + e.message;
            }
        }

        function renderFolderBrowser(data) {
            folderErrorEl.textContent = '';
            _browsePath = data.path;
            folderPathEl.textContent = data.path === '' ? 'This PC' : data.path;
            folderListEl.innerHTML = '';

            if (data.parent !== null) {
                const up = document.createElement('div');
                up.className = 'folder-browser-item folder-browser-up';
                up.textContent = '⬆ .. (Up)';
                up.addEventListener('click', () => browseTo(data.parent));
                folderListEl.appendChild(up);
            }

            data.folders.forEach(f => {
                const item = document.createElement('div');
                item.className = 'folder-browser-item';
                item.textContent = '📁 ' + f.name;
                item.addEventListener('click', () => browseTo(f.path));
                folderListEl.appendChild(item);
            });

            // The drive list ("") isn't itself a selectable folder.
            folderSelectBtn.disabled = data.path === '';
        }

        // ── Confirm selection ────────────────────────────────────────────────

        folderSelectBtn.addEventListener('click', async () => {
            if (!_browsePath) return;
            try {
                const res = await fetch(`${baseUrl()}/root`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: _browsePath })
                });
                if (!res.ok) {
                    const msg = await res.text();
                    folderErrorEl.textContent = 'Could not select folder: ' + msg;
                    return;
                }
                localStorage.setItem('serverSelectedRoot', _browsePath);
                closeFolderBrowser();
                // Dropdown/label refresh is driven by the server's 'root-changed'
                // SSE broadcast, handled in server-integration.js.
            } catch (e) {
                folderErrorEl.textContent = 'Error selecting folder: ' + e.message;
            }
        });

        changeFolderBtn.addEventListener('click', openFolderBrowser);
        folderCancelBtn.addEventListener('click', closeFolderBrowser);

        // ── EventBus subscriptions ────────────────────────────────────────────

        EventBus.on(Events.ROOT_CHANGED, ({ root }) => {
            _currentRoot = root;
            currentRootLabel.textContent = root;
            currentRootLabel.title = root;
        });
