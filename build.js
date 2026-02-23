const fs = require('fs');
const path = require('path');

function readFile(filePath) {
    return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
}

// Wrap JS content in an IIFE for scope isolation.
// event-bus.js is intentionally NOT wrapped — it must be global.
function iife(js) {
    return `(function() {\n${js.trimEnd()}\n})();`;
}

// Event bus (must be first JS in the bundle, NOT wrapped in IIFE)
const eventBusJs = readFile('src/event-bus/event-bus.js');

// Toolbar sub-modules
const fileButtonsHtml = readFile('src/toolbar/file-buttons/file-buttons.html');
const fileButtonsCss  = readFile('src/toolbar/file-buttons/file-buttons.css');
const fileButtonsJs   = readFile('src/toolbar/file-buttons/file-buttons.js');
const filterTogglesHtml = readFile('src/toolbar/filter-toggles/filter-toggles.html');
const filterTogglesCss  = readFile('src/toolbar/filter-toggles/filter-toggles.css');
const filterTogglesJs   = readFile('src/toolbar/filter-toggles/filter-toggles.js');
let   toolbarHtml = readFile('src/toolbar/toolbar.html');
const toolbarCss  = readFile('src/toolbar/toolbar.css');
const toolbarJs   = readFile('src/toolbar/toolbar.js');

// Editor sub-modules
const codeViewHtml = readFile('src/editor/code-view/code-view.html');
const codeViewCss  = readFile('src/editor/code-view/code-view.css');
const codeViewJs   = readFile('src/editor/code-view/code-view.js');
const treeViewHtml = readFile('src/editor/tree-view/tree-view.html');
const treeViewCss  = readFile('src/editor/tree-view/tree-view.css');
const treeViewJs   = readFile('src/editor/tree-view/tree-view.js');
let   editorHtml = readFile('src/editor/editor.html');
const editorCss  = readFile('src/editor/editor.css');
const editorJs   = readFile('src/editor/editor.js');

// Viewer sub-modules
const diagramHtml = readFile('src/viewer/diagram/diagram.html');
const diagramCss  = readFile('src/viewer/diagram/diagram.css');
const diagramJs   = readFile('src/viewer/diagram/diagram.js');
const zoomExportHtml = readFile('src/viewer/zoom-export/zoom-export.html');
const zoomExportCss  = readFile('src/viewer/zoom-export/zoom-export.css');
const zoomExportJs   = readFile('src/viewer/zoom-export/zoom-export.js');
let   viewerHtml = readFile('src/viewer/viewer.html');
const viewerCss  = readFile('src/viewer/viewer.css');
const viewerJs   = readFile('src/viewer/viewer.js');

// Resizer and app
let   resizerHtml = readFile('src/resizer/resizer.html');
const resizerCss  = readFile('src/resizer/resizer.css');
const resizerJs   = readFile('src/resizer/resizer.js');
let   appTemplate = readFile('src/app.html');

// Level 1a: assemble toolbar sub-modules into toolbar
toolbarHtml = toolbarHtml.replace('        <!-- FILE_BUTTONS_HTML -->', fileButtonsHtml.trimEnd());
toolbarHtml = toolbarHtml.replace('        <!-- FILTER_TOGGLES_HTML -->', filterTogglesHtml.trimEnd());
const combinedToolbarCss = toolbarCss.trimEnd() + '\n\n' + fileButtonsCss.trimEnd() + '\n\n' + filterTogglesCss.trimEnd();
const combinedToolbarJs  = iife(toolbarJs) + '\n\n' + iife(fileButtonsJs) + '\n\n' + iife(filterTogglesJs);

// Level 1b: assemble editor sub-modules into editor
editorHtml = editorHtml.replace('                <!-- CODE_VIEW_HTML -->', codeViewHtml.trimEnd());
editorHtml = editorHtml.replace('                <!-- TREE_VIEW_HTML -->', treeViewHtml.trimEnd());
const combinedEditorCss = editorCss.trimEnd() + '\n\n' + codeViewCss.trimEnd() + '\n\n' + treeViewCss.trimEnd();
const combinedEditorJs  = iife(codeViewJs) + '\n\n' + iife(treeViewJs) + '\n\n' + iife(editorJs);

// Level 1c: assemble viewer sub-modules into viewer
// IMPORTANT: diagramJs MUST come before zoomExportJs because zoom-export.js
// calls diagramContainer.addEventListener() directly at execution time
viewerHtml = viewerHtml.replace('            <!-- DIAGRAM_HTML -->', diagramHtml.trimEnd());
viewerHtml = viewerHtml.replace('            <!-- ZOOM_EXPORT_HTML -->', zoomExportHtml.trimEnd());
const combinedViewerCss = viewerCss.trimEnd() + '\n\n' + diagramCss.trimEnd() + '\n\n' + zoomExportCss.trimEnd();
const combinedViewerJs  = iife(diagramJs) + '\n\n' + iife(zoomExportJs) + '\n\n' + iife(viewerJs);

// Level 2: assemble editor + viewer into resizer
resizerHtml = resizerHtml.replace('        <!-- EDITOR_HTML -->', editorHtml.trimEnd());
resizerHtml = resizerHtml.replace('        <!-- VIEWER_HTML -->', viewerHtml.trimEnd());
const combinedResizerCss = resizerCss.trimEnd() + '\n\n' + combinedEditorCss + '\n\n' + combinedViewerCss;
const combinedResizerJs  = combinedEditorJs + '\n\n' + combinedViewerJs + '\n\n' + iife(resizerJs);

// Level 3: assemble toolbar + resizer into app
let result = appTemplate;
result = result.replace('    <!-- TOOLBAR_HTML -->', toolbarHtml.trimEnd());
result = result.replace('        <!-- RESIZER_HTML -->', resizerHtml.trimEnd());
result = result.replace('        /* TOOLBAR_CSS */', combinedToolbarCss);
result = result.replace('        /* RESIZER_CSS */', combinedResizerCss);
result = result.replace('        // TOOLBAR_JS', eventBusJs.trimEnd() + '\n\n' + combinedToolbarJs);
result = result.replace('        // RESIZER_JS', combinedResizerJs);

fs.writeFileSync(path.join(__dirname, 'event-model-viewer.html'), result, { encoding: 'utf8' });
console.log('Build successful: event-model-viewer.html');
console.log('Size:', Math.round(result.length / 1024), 'KB');
