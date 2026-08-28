        // Event Model Codec: encodes/decodes an Event Model to/from its two on-disk
        // formats. ".emj" is JSON, ".emy" is YAML — same schema either way (see
        // CONTEXT.md). Kept as a single shared, un-wrapped module (like EventBus, and
        // for the same reason) so every module that reads or writes an Event Model
        // file — the code editor, the standalone file buttons, and the server
        // integration — agrees on which extension means which format.
        const Codec = {
            JSON: 'json',
            YAML: 'yaml',

            extensionFor(format) {
                return format === Codec.YAML ? 'emy' : 'emj';
            },

            formatForFileName(fileName) {
                return fileName && fileName.toLowerCase().endsWith('.emy') ? Codec.YAML : Codec.JSON;
            },

            parse(text, format) {
                if (format === Codec.YAML) {
                    return jsyaml.load(text) ?? {};
                }
                return JSON.parse(text);
            },

            stringify(json, format) {
                if (format === Codec.YAML) {
                    return jsyaml.dump(json);
                }
                return JSON.stringify(json, null, 2);
            },

            aceMode(format) {
                return format === Codec.YAML ? 'ace/mode/yaml' : 'ace/mode/json';
            },
        };
