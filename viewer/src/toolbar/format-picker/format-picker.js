        // Format Picker: a small modal for choosing which Event Model encoding —
        // JSON (.emj) or YAML (.emy) — a new document should use. Exposed as
        // window.FormatPicker so both the standalone and server-integrated "New"
        // button handlers (separate IIFE-scoped modules) can call it.
        //
        // The modal is appended directly to <body> (not left inside the toolbar),
        // for the same reason as the folder browser modal: the toolbar uses
        // `backdrop-filter`, which creates a new containing block for
        // `position: fixed` descendants and would confine the overlay to the
        // toolbar's own height instead of covering the viewport.
        const formatPickerOverlay = document.createElement('div');
        formatPickerOverlay.className = 'format-picker-overlay';
        formatPickerOverlay.innerHTML = `
            <div class="format-picker-modal">
                <h2 id="formatPickerTitle">New Event Model</h2>
                <div class="format-picker-name-row" id="formatPickerNameRow">
                    <label for="formatPickerNameInput">File name</label>
                    <input type="text" id="formatPickerNameInput" placeholder="event-model" autocomplete="off">
                </div>
                <div class="format-picker-error" id="formatPickerError"></div>
                <div class="format-picker-choices">
                    <button class="format-picker-choice" id="formatPickerJsonBtn" type="button">
                        <span class="format-picker-choice-title">JSON</span>
                        <span class="format-picker-choice-ext">.emj</span>
                    </button>
                    <button class="format-picker-choice" id="formatPickerYamlBtn" type="button">
                        <span class="format-picker-choice-title">YAML</span>
                        <span class="format-picker-choice-ext">.emy</span>
                    </button>
                </div>
                <div class="format-picker-actions">
                    <button id="formatPickerCancel" type="button">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(formatPickerOverlay);

        const formatPickerTitleEl = formatPickerOverlay.querySelector('#formatPickerTitle');
        const formatPickerNameRow = formatPickerOverlay.querySelector('#formatPickerNameRow');
        const formatPickerNameInput = formatPickerOverlay.querySelector('#formatPickerNameInput');
        const formatPickerErrorEl = formatPickerOverlay.querySelector('#formatPickerError');
        const formatPickerJsonBtn = formatPickerOverlay.querySelector('#formatPickerJsonBtn');
        const formatPickerYamlBtn = formatPickerOverlay.querySelector('#formatPickerYamlBtn');
        const formatPickerCancelBtn = formatPickerOverlay.querySelector('#formatPickerCancel');

        let _askName = false;
        let _resolvePrompt = null;

        function closeFormatPicker(result) {
            formatPickerOverlay.classList.remove('visible');
            const resolve = _resolvePrompt;
            _resolvePrompt = null;
            if (resolve) resolve(result);
        }

        function chooseFormat(format) {
            if (_askName) {
                const name = formatPickerNameInput.value.trim();
                if (!name) {
                    formatPickerErrorEl.textContent = 'Please enter a file name.';
                    return;
                }
                closeFormatPicker({ name, format, extension: Codec.extensionFor(format) });
            } else {
                closeFormatPicker({ format, extension: Codec.extensionFor(format) });
            }
        }

        formatPickerJsonBtn.addEventListener('click', () => chooseFormat(Codec.JSON));
        formatPickerYamlBtn.addEventListener('click', () => chooseFormat(Codec.YAML));
        formatPickerCancelBtn.addEventListener('click', () => closeFormatPicker(null));
        formatPickerOverlay.addEventListener('click', (e) => {
            if (e.target === formatPickerOverlay) closeFormatPicker(null);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && formatPickerOverlay.classList.contains('visible')) {
                closeFormatPicker(null);
            }
        });

        // window.FormatPicker.prompt({ askName, title, defaultName })
        //   -> Promise<{ name?, format, extension } | null>  (null when cancelled)
        window.FormatPicker = {
            prompt(options = {}) {
                _askName = !!options.askName;
                formatPickerTitleEl.textContent = options.title || 'New Event Model';
                formatPickerNameRow.style.display = _askName ? '' : 'none';
                formatPickerNameInput.value = options.defaultName || '';
                formatPickerErrorEl.textContent = '';
                formatPickerOverlay.classList.add('visible');
                if (_askName) setTimeout(() => formatPickerNameInput.focus(), 0);
                return new Promise((resolve) => { _resolvePrompt = resolve; });
            }
        };
