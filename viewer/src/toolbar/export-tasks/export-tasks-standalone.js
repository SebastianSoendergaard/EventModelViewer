        // Standalone delivery for the shared task export capability.

        var _currentModel = null;
        var _currentFileName = null;

        EventBus.on(Events.FILE_LOADED, function(payload) {
            _currentFileName = payload && typeof payload.fileName === 'string'
                ? payload.fileName
                : null;
        });

        EventBus.on(Events.MODEL_CHANGED, function(payload) {
            _currentModel = payload ? payload.model : null;
        });

        var DOWNLOAD_URL_REVOKE_DELAY_MS = 1000;
        var DOWNLOAD_INTERVAL_MS = 250; // Avoid Chromium's automatic-download burst limit.

        function downloadTaskFile(file) {
            var mimeType = file.name.toLowerCase().endsWith('.json')
                ? 'application/json'
                : 'text/markdown;charset=utf-8';
            var blob = new Blob([file.content], { type: mimeType });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');

            try {
                link.href = url;
                link.download = file.name;
                document.body.appendChild(link);
                link.click();
                return true;
            } finally {
                document.body.removeChild(link);
                // The browser reads the Blob asynchronously after click().
                // Revoking here races that read, especially with many files.
                setTimeout(function() {
                    URL.revokeObjectURL(url);
                }, DOWNLOAD_URL_REVOKE_DELAY_MS);
            }
        }

        var FORMAT_PREF_KEY = 'exportTaskFormats';
        function chooseFormats() { return new Promise(function(resolve) { var saved; try { saved=JSON.parse(localStorage.getItem(FORMAT_PREF_KEY))||{}; } catch(e) { saved={}; } var overlay=document.createElement('div'); overlay.className='export-format-overlay visible'; overlay.innerHTML='<div class="export-format-modal" role="dialog" aria-labelledby="exportFormatTitle"><h2 id="exportFormatTitle">Export as Tasks</h2><p>Select output formats:</p><label><input type="checkbox" data-format="markdown"> Markdown (.md)</label><label><input type="checkbox" data-format="json"> JSON (.json)</label><div class="export-format-hint" aria-live="polite">Select at least one format.</div><div class="export-folder-browser-actions"><button data-action="cancel">Cancel</button><button data-action="export" disabled>Export</button></div></div>'; document.body.appendChild(overlay); var boxes=overlay.querySelectorAll('input'); boxes[0].checked=!!saved.markdown; boxes[1].checked=!!saved.json; var action=overlay.querySelector('[data-action=export]'),hint=overlay.querySelector('.export-format-hint'); function update(){var v={markdown:boxes[0].checked,json:boxes[1].checked};localStorage.setItem(FORMAT_PREF_KEY,JSON.stringify(v));action.disabled=!(v.markdown||v.json);hint.hidden=!action.disabled;} boxes.forEach(function(b){b.addEventListener('change',update);});update(); overlay.querySelector('[data-action=cancel]').onclick=function(){overlay.remove();resolve(null);};action.onclick=function(){var v={markdown:boxes[0].checked,json:boxes[1].checked};overlay.remove();resolve(v);}; }); }
        var exportTasksBtn = document.getElementById('exportTasksBtn');

        exportTasksBtn.addEventListener('click', async function() {
            if (!_currentModel || !_currentModel.slices || _currentModel.slices.length === 0) {
                alert('No event model loaded to export.');
                return;
            }
            var formats = await chooseFormats();
            if (!formats) return;
            var files;
            try {
                files = EventModelTaskExport.generateExportFiles(
                    _currentModel,
                    _currentFileName
                ).filter(function(file) { return formats.markdown && file.name.endsWith('.md') || formats.json && file.name.endsWith('.json'); });
            } catch (error) {
                alert('Error exporting: ' + error.message);
                return;
            }

            var downloaded = 0;
            var failed = [];
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                try {
                    if (downloadTaskFile(file)) downloaded++;
                } catch (error) {
                    failed.push(file.name + ': ' + error.message);
                }
                if (i < files.length - 1) {
                    await new Promise(function(resolve) {
                        setTimeout(resolve, DOWNLOAD_INTERVAL_MS);
                    });
                }
            }

            if (failed.length > 0) {
                alert('Started downloading ' + downloaded + ' of ' + files.length +
                    ' file(s). Failed: ' + failed.join('; '));
            } else {
                alert('Started downloading ' + downloaded + ' file(s).');
            }
        });
