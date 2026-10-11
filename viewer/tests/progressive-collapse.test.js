const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'editor', 'code-view', 'code-view.js'),
    'utf8'
);
const start = source.indexOf('function isAceRootContainerRow(');
const end = source.indexOf('function updateJsonFromEditor()', start);
assert(start >= 0 && end > start, 'ACE collapse controls are present');

const foldRanges = new Map([
    [0, { start: { row: 0 }, end: { row: 7 } }],
    [1, { start: { row: 1 }, end: { row: 5 } }],
    [2, { start: { row: 2 }, end: { row: 3 } }],
    [4, { start: { row: 4 }, end: { row: 5 } }],
    [6, { start: { row: 6 }, end: { row: 7 } }]
]);
const folds = [];
const addFoldRows = [];
const removeFoldRows = [];
const session = {
    foldWidgets: null,
    getAllFolds: () => folds.slice(),
    getLength: () => 8,
    getLine: row => ({
        0: '{',
        1: '  "a": {',
        2: '    "b": {',
        3: '      "c": {',
        4: '    "d": {',
        6: '  "z": {'
    })[row] || '',
    getFoldWidgetRange: row => foldRanges.get(row) || null,
    addFold: (_placeholder, range) => {
        addFoldRows.push(range.start.row);
        folds.push(range);
    },
    unfold: (...args) => {
        if (args.length === 0) folds.length = 0;
    },
    removeFold: fold => {
        removeFoldRows.push(fold.start.row);
        const index = folds.findIndex(candidate => candidate.start.row === fold.start.row);
        if (index >= 0) folds.splice(index, 1);
    }
};

const sandbox = {
    _currentFormat: 'json',
    collapsedLines: new Set(),
    jsonLines: [],
    codeView: { classList: { contains: () => true } },
    codeEditorView: { session, renderer: { updateFull() {} } },
    codeEditor: { querySelectorAll: () => [] },
    codeCollapseBtn: { disabled: false },
    codeExpandBtn: { disabled: false },
    previousFolds: new Set(),
    isProcessingFolds: false,
    renderCodeEditor() {}
};

vm.createContext(sandbox);
vm.runInContext(
    source.slice(start, end) +
        '\nthis.controls = { collapseToTopLevel, expandNextLevel, updateCollapseExpandButtonState };',
    sandbox
);

sandbox.controls.collapseToTopLevel();
assert.deepEqual(addFoldRows, [1, 6]);
assert.equal(sandbox.codeCollapseBtn.disabled, false);
assert.equal(sandbox.codeExpandBtn.disabled, false);

sandbox.controls.expandNextLevel();
assert.deepEqual(removeFoldRows, [1, 6]);

console.log('Progressive ACE collapse controls passed.');
