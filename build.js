const fs = require('fs');
const path = require('path');

function readFile(filePath) {
    return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
}

// Read all module files
const codeViewHtml = readFile('src/editor/code-view/code-view.html');
const codeViewCss = readFile('src/editor/code-view/code-view.css');
const codeViewJs = readFile('src/editor/code-view/code-view.js');
const treeViewHtml = readFile('src/editor/tree-view/tree-view.html');
const treeViewCss = readFile('src/editor/tree-view/tree-view.css');
const treeViewJs = readFile('src/editor/tree-view/tree-view.js');

let editorHtml = readFile('src/editor/editor.html');
const editorCss = readFile('src/editor/editor.css');
const editorJs = readFile('src/editor/editor.js');

const viewerHtml = readFile('src/viewer/viewer.html');
const viewerCss = readFile('src/viewer/viewer.css');
const viewerJs = readFile('src/viewer/viewer.js');

let appTemplate = readFile('src/app.html');

// Level 1: assemble editor sub-modules into editor
editorHtml = editorHtml.replace('                <!-- CODE_VIEW_HTML -->', codeViewHtml.trimEnd());
editorHtml = editorHtml.replace('                <!-- TREE_VIEW_HTML -->', treeViewHtml.trimEnd());

const combinedEditorCss = editorCss.trimEnd() + '\n\n' + codeViewCss.trimEnd() + '\n\n' + treeViewCss.trimEnd();
const combinedEditorJs = codeViewJs.trimEnd() + '\n\n' + treeViewJs.trimEnd() + '\n\n' + editorJs.trimEnd();

// Level 2: assemble all modules into app
let result = appTemplate;
result = result.replace('        <!-- EDITOR_HTML -->', editorHtml.trimEnd());
result = result.replace('        /* EDITOR_CSS */', combinedEditorCss);
result = result.replace('        // EDITOR_JS', combinedEditorJs);
result = result.replace('        <!-- VIEWER_HTML -->', viewerHtml.trimEnd());
result = result.replace('        /* VIEWER_CSS */', viewerCss.trimEnd());
result = result.replace('        // VIEWER_JS', viewerJs.trimEnd());

fs.writeFileSync(path.join(__dirname, 'event-model-viewer.html'), result, { encoding: 'utf8' });
console.log('Build successful: event-model-viewer.html');
console.log('Size:', Math.round(result.length / 1024), 'KB');
