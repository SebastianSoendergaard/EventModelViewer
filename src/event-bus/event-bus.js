        const EventBus = {
            _listeners: {},
            on(event, cb) {
                if (!this._listeners[event]) this._listeners[event] = [];
                this._listeners[event].push(cb);
            },
            off(event, cb) {
                if (this._listeners[event]) {
                    this._listeners[event] = this._listeners[event].filter(f => f !== cb);
                }
            },
            emit(event, data) {
                (this._listeners[event] || []).forEach(cb => cb(data));
            }
        };

        const Events = {
            // A file was loaded (from disk, localStorage) or a new document was created.
            // Payload: { json, fileName }  — json is null for new/cleared document
            FILE_LOADED:    'file:loaded',

            // JSON content was changed by a user edit or undo/redo.
            // Payload: { json, source }  — source: 'code' | 'tree' | 'history' | 'addslice'
            JSON_CHANGED:   'json:changed',

            // A filter checkbox was toggled.
            // Payload: { type, checked }  — type: 'slices' | 'tests' | 'types' | 'swimlanes'
            FILTER_TOGGLED: 'filter:toggled',

            // The editor panel was resized; ACE editor should call .resize().
            // Payload: {}
            EDITOR_RESIZED: 'editor:resized',
        };
