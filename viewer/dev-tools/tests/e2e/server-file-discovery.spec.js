import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(__dirname, '..', '..', '..', '..');
const serverViewerPath = join(repositoryRoot, 'event-model-viewer-for-server.html');
let httpServer;
let baseUrl;

test.beforeAll(async () => {
  const viewerHtml = await readFile(serverViewerPath);
  httpServer = createServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(viewerHtml);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => {
    httpServer.close(error => error ? reject(error) : resolve());
  });
});

async function startServerViewer(page) {
  const model = await readFile(
    join(repositoryRoot, 'viewer', 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json'),
    'utf8'
  );

  await page.route(`${baseUrl}/root`, route => {
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ path: 'C:\\models' })
    });
  });
  await page.route(`${baseUrl}/files/stream`, route => {
    return route.fulfill({
      contentType: 'application/x-ndjson',
      body: '{"type":"file","path":"discovery-fixture.emj"}\n{"type":"complete","truncated":false}\n'
    });
  });
  await page.route(`${baseUrl}/events`, route => {
    return route.fulfill({
      contentType: 'text/event-stream',
      body: 'event: connected\ndata: {}\n\n'
    });
  });
  await page.route(`${baseUrl}/select`, route => {
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ selected: 'discovery-fixture.emj' })
    });
  });
  await page.route(`${baseUrl}/selected`, route => {
    return route.fulfill({
      contentType: 'application/json',
      body: model
    });
  });
  await page.route(`${baseUrl}/root/browse*`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ path: 'C:\\output', parent: null, folders: [] })
  }));
  await page.route(`${baseUrl}/export`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ written: [] })
  }));

  await page.goto(baseUrl);
  await expect(page.locator('body')).toContainText('discovery-fixture.emj');
}

test('server-mode startup discovers and displays event model files', async ({ page }) => {
  await startServerViewer(page);

  await expect(page.locator('body')).toContainText('discovery-fixture.emj');
});

test('server task export sends only the selected format and retains that choice', async ({ page }) => {
  await startServerViewer(page);
  page.on('dialog', dialog => dialog.accept());

  await page.locator('#exportTasksBtn').click();
  const exportButton = page.locator('#exportFolderBrowserSelect');
  const markdownCheckbox = page.locator('#exportMarkdown');
  const jsonCheckbox = page.locator('#exportJson');
  await expect(markdownCheckbox).not.toBeChecked();
  await expect(jsonCheckbox).not.toBeChecked();
  await expect(exportButton).toBeDisabled();

  await markdownCheckbox.check();
  await expect(exportButton).toBeEnabled();
  const exportRequest = page.waitForRequest(request =>
    request.url().endsWith('/export') && request.method() === 'POST'
  );
  await exportButton.click();
  const request = await exportRequest;
  const exportedNames = request.postDataJSON().files.map(file => file.name);

  expect(exportedNames.length).toBeGreaterThan(0);
  expect(exportedNames.every(name => name.endsWith('.md'))).toBe(true);
  expect(exportedNames).toContain('discovery-fixture-index.md');

  await page.locator('#exportTasksBtn').click();
  await expect(markdownCheckbox).toBeChecked();
  await expect(jsonCheckbox).not.toBeChecked();
});
