const fs = require('fs');
const path = require('path');

function readFile(filePath) {
    return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
}

function createBuildNumber(date = new Date()) {
    const pad = value => String(value).padStart(2, '0');
    return String(date.getFullYear()) + pad(date.getMonth() + 1) + pad(date.getDate()) + pad(date.getHours());
}

const buildNumber = createBuildNumber();

// Wrap JS content in an IIFE for scope isolation.
// event-bus.js is intentionally NOT wrapped — it must be global.
function iife(js) {
    return `(function() {\n${js.trimEnd()}\n})();`;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Extract the content of the first fenced code block (```...```) from a markdown string.
function extractFirstCodeFence(markdown) {
    const match = markdown.match(/```[^\n]*\n([\s\S]*?)```/);
    return match ? match[1].trimEnd() : '';
}

// ── Shared modules (used by both builds) ──────────────────────────────────────

// Event bus (must be first JS in the bundle, NOT wrapped in IIFE)
const eventBusJs = readFile('src/event-bus/event-bus.js');

// Event Model Codec (must load right after EventBus, NOT wrapped in IIFE — it
// defines a top-level `const Codec` that every format-aware module relies on)
const codecJs = readFile('src/codec/codec.js');

// Format Picker modal (JSON vs YAML choice for new documents) — shared by both builds
const formatPickerCss = readFile('src/toolbar/format-picker/format-picker.css');
const formatPickerJs  = readFile('src/toolbar/format-picker/format-picker.js');

// Filter toggles
const filterTogglesHtml = readFile('src/toolbar/filter-toggles/filter-toggles.html');
const filterTogglesCss  = readFile('src/toolbar/filter-toggles/filter-toggles.css');
const filterTogglesJs   = readFile('src/toolbar/filter-toggles/filter-toggles.js');
const toolbarCss  = readFile('src/toolbar/toolbar.css');
const toolbarJs   = readFile('src/toolbar/toolbar.js');

// Help overlay (event modeling primer + tips + EMJ/EMY format spec) — shared by both builds.
// The format spec is copied verbatim from docs/rules/format.md at build time so the
// in-app help and the on-disk reference stay in sync from a single source of truth.
const helpButtonHtml  = readFile('src/help/help-button.html');
const helpOverlayRaw  = readFile('src/help/help-overlay.html');
const helpCss         = readFile('src/help/help.css');
const helpJs          = readFile('src/help/help.js');
const formatSpecMd    = readFile('docs/rules/format.md');
const formatSpecText  = escapeHtml(extractFirstCodeFence(formatSpecMd));
const helpFeatures = {
    standalone: '<p>Open and save <code>.emj</code> and <code>.emy</code> files locally.</br>Edit the model using the code or tree view.</br>Export to PNG/SVG.</br>Quickly show or hide slices/tests/types/swimlanes.</br>Zoom and pan diagrams using the zoom buttons or C + mouse wheel.</br>Adjust the editor/viewer ratio using the collapse/expand buttons or the panel splitter.</p>',
    server: '<p>Browse folders and open <code>.emj</code> and <code>.emy</code> files locally.</br>Edit the file directly in the editor or using an external editor and the diagram will reflect the changes.</br>Edit the model using the code or tree view, changes are automatically saved to the file.</br>Export slices as task files.</br>Export to PNG/SVG.</br>Quickly show or hide slices/tests/types/swimlanes.</br>Zoom and pan diagrams using the zoom buttons or C + mouse wheel.</br>Adjust the editor/viewer ratio using the collapse/expand buttons or the panel splitter.</p>',
};

function createHelpOverlay(featuresHtml) {
    return helpOverlayRaw
        .replace('<!-- FORMAT_SPEC -->', formatSpecText)
        .replace('<!-- HELP_FEATURES -->', featuresHtml)
        .replace('<!-- HELP_BUILD_NUMBER -->', buildNumber);
}

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

// Event model module (no HTML/CSS — JS only; must load before diagram)
const eventModelJs = readFile('src/event-model/event-model.js');

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

// Resizer and app shell
let   resizerHtml = readFile('src/resizer/resizer.html');
const resizerCss  = readFile('src/resizer/resizer.css');
const resizerJs   = readFile('src/resizer/resizer.js');
const appTemplate = readFile('src/app.html');

// ── Assembly helpers ──────────────────────────────────────────────────────────

function assembleEditor() {
    let html = editorHtml;
    html = html.replace('                <!-- CODE_VIEW_HTML -->', codeViewHtml.trimEnd());
    html = html.replace('                <!-- TREE_VIEW_HTML -->', treeViewHtml.trimEnd());
    const css = editorCss.trimEnd() + '\n\n' + codeViewCss.trimEnd() + '\n\n' + treeViewCss.trimEnd();
    const js  = iife(codeViewJs) + '\n\n' + iife(treeViewJs) + '\n\n' + iife(editorJs);
    return { html, css, js };
}

function assembleViewer() {
    // IMPORTANT: diagramJs MUST come before zoomExportJs because zoom-export.js
    // calls diagramContainer.addEventListener() directly at execution time.
    // event-model MUST come before diagram so MODEL_CHANGED is wired before diagram subscribes.
    let html = viewerHtml;
    html = html.replace('            <!-- DIAGRAM_HTML -->', diagramHtml.trimEnd());
    html = html.replace('            <!-- ZOOM_EXPORT_HTML -->', zoomExportHtml.trimEnd());
    const css = viewerCss.trimEnd() + '\n\n' + diagramCss.trimEnd() + '\n\n' + zoomExportCss.trimEnd();
    const js  = iife(eventModelJs) + '\n\n' + iife(diagramJs) + '\n\n' + iife(zoomExportJs) + '\n\n' + iife(viewerJs);
    return { html, css, js };
}

function assembleResizer(editorParts, viewerParts) {
    let html = resizerHtml;
    html = html.replace('        <!-- EDITOR_HTML -->', editorParts.html.trimEnd());
    html = html.replace('        <!-- VIEWER_HTML -->', viewerParts.html.trimEnd());
    const css = resizerCss.trimEnd() + '\n\n' + editorParts.css + '\n\n' + viewerParts.css;
    const js  = editorParts.js + '\n\n' + viewerParts.js + '\n\n' + iife(resizerJs);
    return { html, css, js };
}

function assembleApp(toolbarParts, resizerParts, helpOverlayHtml) {
    let result = appTemplate;
    result = result.replace('<!-- BUILD_NUMBER -->', buildNumber);
    result = result.replace('    <!-- TOOLBAR_HTML -->', toolbarParts.html.trimEnd());
    result = result.replace('        <!-- RESIZER_HTML -->', resizerParts.html.trimEnd());
    result = result.replace('        <!-- HELP_BUTTON_HTML -->', helpButtonHtml.trimEnd());
    result = result.replace('        <!-- HELP_OVERLAY_HTML -->', helpOverlayHtml.trimEnd());
    result = result.replace('        /* TOOLBAR_CSS */', toolbarParts.css);
    result = result.replace('        /* RESIZER_CSS */', resizerParts.css);
    result = result.replace('        /* HELP_CSS */', helpCss.trimEnd());
    result = result.replace('        // TOOLBAR_JS', eventBusJs.trimEnd() + '\n\n' + codecJs.trimEnd() + '\n\n' + toolbarParts.js);
    result = result.replace('        // RESIZER_JS', resizerParts.js);
    result = result.replace('        // HELP_JS', iife(helpJs));
    return result;
}

// ── Standalone build ──────────────────────────────────────────────────────────

function buildStandalone() {
    const fileButtonsHtml = readFile('src/toolbar/file-buttons/file-buttons.html');
    const fileButtonsCss  = readFile('src/toolbar/file-buttons/file-buttons.css');
    const fileButtonsJs   = readFile('src/toolbar/file-buttons/file-buttons.js');

    let toolbarHtml = readFile('src/toolbar/toolbar.html');
    toolbarHtml = toolbarHtml.replace('        <!-- FILE_BUTTONS_HTML -->', fileButtonsHtml.trimEnd());
    toolbarHtml = toolbarHtml.replace('        <!-- FILTER_TOGGLES_HTML -->', filterTogglesHtml.trimEnd());
    const toolbarParts = {
        html: toolbarHtml,
        css:  toolbarCss.trimEnd() + '\n\n' + fileButtonsCss.trimEnd() + '\n\n' + filterTogglesCss.trimEnd() +
              '\n\n' + formatPickerCss.trimEnd(),
        js:   iife(toolbarJs) + '\n\n' + iife(fileButtonsJs) + '\n\n' + iife(filterTogglesJs) +
              '\n\n' + iife(formatPickerJs),
    };

    const editor  = assembleEditor();
    const viewer  = assembleViewer();
    const resizer = assembleResizer(editor, viewer);
    const result  = assembleApp(toolbarParts, resizer, createHelpOverlay(helpFeatures.standalone));

    fs.writeFileSync(path.join(__dirname, '..', 'event-model-viewer.html'), result, { encoding: 'utf8' });
    console.log('Standalone build: event-model-viewer.html (' + Math.round(result.length / 1024) + ' KB)');
}

// ── Server build ──────────────────────────────────────────────────────────────

function buildServer() {
    const fileButtonsServerHtml = readFile('src/toolbar/file-buttons-server/file-buttons-server.html');
    const fileButtonsServerCss  = readFile('src/toolbar/file-buttons-server/file-buttons-server.css');
    const fileButtonsServerJs   = readFile('src/toolbar/file-buttons-server/file-buttons-server.js');
    const serverIntegrationHtml = readFile('src/server-integration/server-integration.html');
    const serverIntegrationCss  = readFile('src/server-integration/server-integration.css');
    const serverIntegrationJs   = readFile('src/server-integration/server-integration.js');
    const folderBrowserServerHtml = readFile('src/toolbar/folder-browser-server/folder-browser-server.html');
    const folderBrowserServerCss  = readFile('src/toolbar/folder-browser-server/folder-browser-server.css');
    const folderBrowserServerJs   = readFile('src/toolbar/folder-browser-server/folder-browser-server.js');
    const exportTasksHtml = readFile('src/toolbar/export-tasks/export-tasks.html');
    const exportTasksCss  = readFile('src/toolbar/export-tasks/export-tasks.css');
    const exportTasksJs   = readFile('src/toolbar/export-tasks/export-tasks.js');

    // Inject New button + file dropdown + folder browser + export-as-tasks into the FILE_BUTTONS_HTML slot
    const combinedFileAreaHtml = fileButtonsServerHtml.trimEnd() + '\n        ' + serverIntegrationHtml.trimEnd() +
        '\n        ' + folderBrowserServerHtml.trimEnd() + '\n        ' + exportTasksHtml.trimEnd();

    let toolbarHtml = readFile('src/toolbar/toolbar.html');
    toolbarHtml = toolbarHtml.replace('        <!-- FILE_BUTTONS_HTML -->', combinedFileAreaHtml);
    toolbarHtml = toolbarHtml.replace('        <!-- FILTER_TOGGLES_HTML -->', filterTogglesHtml.trimEnd());
    const toolbarParts = {
        html: toolbarHtml,
        css:  toolbarCss.trimEnd() + '\n\n' + fileButtonsServerCss.trimEnd() + '\n\n' +
              serverIntegrationCss.trimEnd() + '\n\n' + folderBrowserServerCss.trimEnd() + '\n\n' +
              exportTasksCss.trimEnd() + '\n\n' +
              filterTogglesCss.trimEnd() + '\n\n' + formatPickerCss.trimEnd(),
        js:   iife(toolbarJs) + '\n\n' + iife(serverIntegrationJs) + '\n\n' +
              iife(fileButtonsServerJs) + '\n\n' + iife(folderBrowserServerJs) + '\n\n' +
              iife(exportTasksJs) + '\n\n' +
              iife(filterTogglesJs) + '\n\n' + iife(formatPickerJs),
    };

    const editor  = assembleEditor();
    const viewer  = assembleViewer();
    const resizer = assembleResizer(editor, viewer);
    const result  = assembleApp(toolbarParts, resizer, createHelpOverlay(helpFeatures.server));

    fs.writeFileSync(path.join(__dirname, '..', 'event-model-viewer-for-server.html'), result, { encoding: 'utf8' });
    console.log('Server build:     event-model-viewer-for-server.html (' + Math.round(result.length / 1024) + ' KB)');
}

// ── Run both builds ───────────────────────────────────────────────────────────

buildStandalone();
buildServer();
