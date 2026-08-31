        // Server delivery for the shared task export capability.

        var _currentModel = null;

        EventBus.on(Events.MODEL_CHANGED, function(payload) {
            _currentModel = payload ? payload.model : null;
        });

        function baseUrl() {
            return window.location.origin;
        }

        var exportTasksBtn = document.getElementById('exportTasksBtn');

        // The modal is appended directly to <body> because the toolbar's
        // backdrop-filter would otherwise constrain this fixed overlay.
        var exportOverlay = document.createElement('div');
        exportOverlay.className = 'export-folder-browser-overlay';
        exportOverlay.innerHTML = `
            <div class="export-folder-browser-modal">
                <h2>Export as Tasks — Select Destination Folder</h2>
                <div class="export-folder-browser-path" id="exportFolderBrowserPath"></div>
                <div class="export-folder-browser-list" id="exportFolderBrowserList"></div>
                <div class="export-folder-browser-error" id="exportFolderBrowserError"></div>
                <div class="export-folder-browser-actions">
                    <button id="exportFolderBrowserCancel">Cancel</button>
                    <button id="exportFolderBrowserSelect">Export Here</button>
                </div>
            </div>
        `;
        document.body.appendChild(exportOverlay);

        var exportPathEl = exportOverlay.querySelector('#exportFolderBrowserPath');
        var exportListEl = exportOverlay.querySelector('#exportFolderBrowserList');
        var exportErrorEl = exportOverlay.querySelector('#exportFolderBrowserError');
        var exportCancelBtn = exportOverlay.querySelector('#exportFolderBrowserCancel');
        var exportSelectBtn = exportOverlay.querySelector('#exportFolderBrowserSelect');

        var _exportBrowsePath = null;
        var EXPORT_LAST_FOLDER_KEY = 'exportTasksLastFolder';

        function openExportFolderBrowser() {
            exportErrorEl.textContent = '';
            exportOverlay.classList.add('visible');
            var lastFolder = localStorage.getItem(EXPORT_LAST_FOLDER_KEY) || '';
            browseExportTo(lastFolder, /*fallbackToRootOnError*/ true);
        }

        function closeExportFolderBrowser() {
            exportOverlay.classList.remove('visible');
        }

        async function browseExportTo(browsePath, fallbackToRootOnError) {
            try {
                const res = await fetch(`${baseUrl()}/root/browse?path=${encodeURIComponent(browsePath)}`);
                if (!res.ok) {
                    if (fallbackToRootOnError && browsePath !== '') {
                        browseExportTo('', false);
                        return;
                    }
                    exportErrorEl.textContent = 'Could not browse that folder.';
                    return;
                }
                const data = await res.json();
                renderExportFolderBrowser(data);
            } catch (e) {
                if (fallbackToRootOnError && browsePath !== '') {
                    browseExportTo('', false);
                    return;
                }
                exportErrorEl.textContent = 'Error browsing folder: ' + e.message;
            }
        }

        function renderExportFolderBrowser(data) {
            exportErrorEl.textContent = '';
            _exportBrowsePath = data.path;
            exportPathEl.textContent = data.path === '' ? 'This PC' : data.path;
            exportListEl.innerHTML = '';

            if (data.parent !== null) {
                const up = document.createElement('div');
                up.className = 'export-folder-browser-item export-folder-browser-up';
                up.textContent = '⬆ .. (Up)';
                up.addEventListener('click', () => browseExportTo(data.parent));
                exportListEl.appendChild(up);
            }

            data.folders.forEach(f => {
                const item = document.createElement('div');
                item.className = 'export-folder-browser-item';
                item.textContent = '📁 ' + f.name;
                item.addEventListener('click', () => browseExportTo(f.path));
                exportListEl.appendChild(item);
            });

            exportSelectBtn.disabled = data.path === '';
        }

        exportTasksBtn.addEventListener('click', () => {
            if (!_currentModel || !_currentModel.slices || _currentModel.slices.length === 0) {
                alert('No event model loaded to export.');
                return;
            }
            openExportFolderBrowser();
        });

        exportCancelBtn.addEventListener('click', closeExportFolderBrowser);

        exportSelectBtn.addEventListener('click', async () => {
            if (!_exportBrowsePath || !_currentModel) return;
            const files = EventModelTaskExport.generateExportFiles(_currentModel);
            try {
                const res = await fetch(`${baseUrl()}/export`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: _exportBrowsePath, files })
                });
                if (!res.ok) {
                    const msg = await res.text();
                    exportErrorEl.textContent = 'Export failed: ' + msg;
                    return;
                }
                const data = await res.json();
                closeExportFolderBrowser();
                localStorage.setItem(EXPORT_LAST_FOLDER_KEY, _exportBrowsePath);
                alert('Wrote ' + data.written.length + ' file(s) to ' + _exportBrowsePath);
            } catch (e) {
                exportErrorEl.textContent = 'Error exporting: ' + e.message;
            }
        });
