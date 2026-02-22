const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const srcDir = path.join(rootDir, 'src');
const editorDir = path.join(srcDir, 'editor');
const viewerDir = path.join(srcDir, 'viewer');

const appHtml   = fs.readFileSync(path.join(srcDir, 'app.html'), 'utf8');
const editorHtml = fs.readFileSync(path.join(editorDir, 'editor.html'), 'utf8');
const editorCss  = fs.readFileSync(path.join(editorDir, 'editor.css'), 'utf8');
const editorJs   = fs.readFileSync(path.join(editorDir, 'editor.js'), 'utf8');
const viewerHtml = fs.readFileSync(path.join(viewerDir, 'viewer.html'), 'utf8');
const viewerCss  = fs.readFileSync(path.join(viewerDir, 'viewer.css'), 'utf8');
const viewerJs   = fs.readFileSync(path.join(viewerDir, 'viewer.js'), 'utf8');

let result = appHtml;

// Replace placeholders — trim trailing newline from each module to avoid extra blank lines
result = result.replace('        <!-- EDITOR_HTML -->', editorHtml.trimEnd());
result = result.replace('        /* EDITOR_CSS */',     editorCss.trimEnd());
result = result.replace('        // EDITOR_JS',         editorJs.trimEnd());
result = result.replace('        <!-- VIEWER_HTML -->', viewerHtml.trimEnd());
result = result.replace('        /* VIEWER_CSS */',     viewerCss.trimEnd());
result = result.replace('        // VIEWER_JS',         viewerJs.trimEnd());

const outputPath = path.join(rootDir, 'event-model-viewer.html');
fs.writeFileSync(outputPath, result, 'utf8');

console.log(`Built: event-model-viewer.html (${Math.round(result.length / 1024)} KB)`);
