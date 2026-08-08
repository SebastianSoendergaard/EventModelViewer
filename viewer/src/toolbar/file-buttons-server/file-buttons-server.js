        const newServerBtn = document.getElementById('newServerBtn');

        newServerBtn.addEventListener('click', async () => {
            const input = prompt('Enter filename for new event model:');
            if (!input) return;

            const name = input.endsWith('.json') ? input : input + '.json';

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

                // Select the new file (SSE files-changed will also refresh the dropdown)
                const selectRes = await fetch(`${window.location.origin}/select`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: name })
                });

                if (!selectRes.ok) {
                    console.warn('[server] Could not select newly created file:', name);
                    return;
                }

                // Load the empty file content and update the viewer
                const contentRes = await fetch(`${window.location.origin}/selected`);
                if (contentRes.ok) {
                    const text = await contentRes.text();
                    const json = JSON.parse(text);
                    localStorage.setItem('serverSelectedFile', name);
                    EventBus.emit(Events.FILE_LOADED, { json, fileName: name });
                }
            } catch (e) {
                alert('Error creating file: ' + e.message);
            }
        });
