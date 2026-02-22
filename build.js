const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const srcDir = path.join(rootDir, 'src');
const viewerDir = path.join(srcDir, 'viewer');

const appHtml = fs.readFileSync(path.join(srcDir, 'app.html'), 'utf8');
const viewerHtml = fs.readFileSync(path.join(viewerDir, 'viewer.html'), 'utf8');
const viewerCss = fs.readFileSync(path.join(viewerDir, 'viewer.css'), 'utf8');
const viewerJs = fs.readFileSync(path.join(viewerDir, 'viewer.js'), 'utf8');

let result = appHtml;

// Replace placeholders — trim trailing newline from each module to avoid extra blank lines
result = result.replace('        <!-- VIEWER_HTML -->', viewerHtml.trimEnd());
result = result.replace('        /* VIEWER_CSS */', viewerCss.trimEnd());
result = result.replace('        // VIEWER_JS', viewerJs.trimEnd());

const outputPath = path.join(rootDir, 'event-model-viewer.html');
fs.writeFileSync(outputPath, result, 'utf8');

console.log(`Built: event-model-viewer.html (${Math.round(result.length / 1024)} KB)`);
