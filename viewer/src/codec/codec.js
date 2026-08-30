        // Event Model Codec: encodes/decodes an Event Model to/from its two on-disk
        // formats. ".emj" is JSON, ".emy" is YAML — same schema either way (see
        // CONTEXT.md). Kept as a single shared, un-wrapped module (like EventBus, and
        // for the same reason) so every module that reads or writes an Event Model
        // file — the code editor, the standalone file buttons, and the server
        // integration — agrees on which extension means which format.
        const Codec = {
            JSON: 'json',
            YAML: 'yaml',

            validate(json) {
                if (!json || typeof json !== 'object' || !Array.isArray(json.slices)) {
                    return json;
                }

                json.slices.forEach((slice, index) => {
                    if (!slice || typeof slice !== 'object' || !Object.prototype.hasOwnProperty.call(slice, 'hints')) {
                        return;
                    }
                    if (!Array.isArray(slice.hints) || slice.hints.some(hint => typeof hint !== 'string')) {
                        const label = slice.name ? ` "${slice.name}"` : ` at index ${index}`;
                        throw new Error(`Invalid hints for slice${label}: expected a list of strings`);
                    }
                });

                json.slices.forEach((slice, index) => {
                    if (!slice || typeof slice !== 'object' || !Object.prototype.hasOwnProperty.call(slice, 'note')) {
                        return;
                    }
                    if (typeof slice.note !== 'string') {
                        const label = slice.name ? ` "${slice.name}"` : ` at index ${index}`;
                        throw new Error(`Invalid note for slice${label}: expected a string`);
                    }
                });
                return json;
            },

            extensionFor(format) {
                return format === Codec.YAML ? 'emy' : 'emj';
            },

            formatForFileName(fileName) {
                return fileName && fileName.toLowerCase().endsWith('.emy') ? Codec.YAML : Codec.JSON;
            },

            parse(text, format) {
                let json;
                if (format === Codec.YAML) {
                    json = jsyaml.load(text) ?? {};
                } else {
                    json = JSON.parse(text);
                }
                return Codec.validate(json);
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
