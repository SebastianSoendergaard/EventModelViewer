        // Standalone delivery for the shared task export capability.

        var _currentModel = null;

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

        var exportTasksBtn = document.getElementById('exportTasksBtn');

        exportTasksBtn.addEventListener('click', async function() {
            if (!_currentModel || !_currentModel.slices || _currentModel.slices.length === 0) {
                alert('No event model loaded to export.');
                return;
            }

            var files;
            try {
                files = EventModelTaskExport.generateExportFiles(_currentModel);
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
