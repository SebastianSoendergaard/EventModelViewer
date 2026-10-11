        const newServerBtn = document.getElementById('newServerBtn');

        newServerBtn.addEventListener('click', async () => {
            let defaultName = '';
            let defaultFormat;

            while (true) {
                const choice = await FormatPicker.prompt({
                    askName: true,
                    title: 'New Event Model',
                    defaultName,
                    defaultFormat
                });
                if (!choice) return;

                // The picker's format button is authoritative — strip any extension the
                // user may have typed themselves so it can't disagree with the choice.
                const baseName = choice.name.replace(/\.(emj|emy)$/i, '');
                const name = `${baseName}.${choice.extension}`;

                let createRes;
                try {
                    createRes = await fetch(`${window.location.origin}/files`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name })
                    });
                } catch (e) {
                    alert('Error creating file: ' + e.message);
                    defaultName = baseName;
                    defaultFormat = choice.format;
                    continue;
                }

                if (!createRes.ok) {
                    const msg = await createRes.text();
                    alert('Failed to create file: ' + msg);
                    defaultName = baseName;
                    defaultFormat = choice.format;
                    continue;
                }

                // Select + load through ServerIntegration so its tracked state
                // (_selectedFile, _selectedFormat, _lastSavedContent) stays consistent
                // for auto-save; also refresh the dropdown immediately rather than
                // waiting on the files-changed SSE broadcast.
                try {
                    await window.ServerIntegration.selectFile(name);
                    await window.ServerIntegration.populateDropdown(true);
                } catch (e) {
                    alert('Error creating file: ' + e.message);
                }
                return;
            }
        });
