        const newServerBtn = document.getElementById('newServerBtn');

        newServerBtn.addEventListener('click', async () => {
            const choice = await FormatPicker.prompt({ askName: true, title: 'New Event Model' });
            if (!choice) return;

            // The picker's format button is authoritative — strip any extension the
            // user may have typed themselves so it can't disagree with the choice.
            const baseName = choice.name.replace(/\.(emj|emy)$/i, '');
            const name = `${baseName}.${choice.extension}`;

            try {
                const createRes = await fetch(`${window.location.origin}/files`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });

                if (!createRes.ok) {
                    const msg = await createRes.text();
                    alert('Failed to create file: ' + msg);
                    return;
                }

                // Select + load through ServerIntegration so its tracked state
                // (_selectedFile, _selectedFormat, _lastSavedContent) stays consistent
                // for auto-save; also refresh the dropdown immediately rather than
                // waiting on the files-changed SSE broadcast.
                await window.ServerIntegration.selectFile(name);
                await window.ServerIntegration.populateDropdown(true);
            } catch (e) {
                alert('Error creating file: ' + e.message);
            }
        });
