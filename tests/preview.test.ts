import { expect, test, afterEach } from 'bun:test';
import {
  createTestProject,
  buildProject,
  startPreviewServer,
  fetchHtml,
  readBuildOutput,
} from './utils';

let servers: Array<{ cleanup: () => Promise<void> }> = [];

afterEach(async () => {
  for (const server of servers) {
    await server.cleanup();
  }
  servers = [];
});

test('preview processes SSI after build without SSI', async () => {
  const project = await createTestProject('simple');
  servers.push(project);

  // Build without SSI processing
  await buildProject(project.root, { apply: { build: false } });

  // Check that built file still has SSI directives
  const builtOutput = await readBuildOutput(project.root);
  expect(builtOutput).toContain('<!--#include virtual="header.html" -->');
  expect(builtOutput).toContain('<!--#include virtual="footer.html" -->');

  // Start preview server with SSI processing
  const serverInfo = await startPreviewServer(project.root, { apply: { preview: true } });
  servers.push(serverInfo);

  // Fetch from preview server - should have processed SSI
  const html = await fetchHtml(serverInfo.url, '/');

  // Should have processed includes
  expect(html).toContain('<header>');
  expect(html).toContain('Navigation Menu');
  expect(html).toContain('<footer>');
  expect(html).toContain('Footer Content © 2024');

  // Should not contain SSI directives
  expect(html).not.toContain('<!--#include');
});

test('build artifacts remain unprocessed when preview processes', async () => {
  const project = await createTestProject('simple');
  servers.push(project);

  // Build without SSI processing
  await buildProject(project.root, { apply: { build: false } });

  // Start preview with SSI processing
  const serverInfo = await startPreviewServer(project.root, { apply: { preview: true } });
  servers.push(serverInfo);

  // Fetch from preview
  const html = await fetchHtml(serverInfo.url, '/');

  // Preview should process SSI
  expect(html).not.toContain('<!--#include');
  expect(html).toContain('Navigation Menu');

  // But built file on disk should still have directives
  const builtOutput = await readBuildOutput(project.root);
  expect(builtOutput).toContain('<!--#include virtual="header.html" -->');
});

test('preview processes nested includes', async () => {
  const project = await createTestProject('nested');
  servers.push(project);

  // Build without SSI
  await buildProject(project.root, { apply: { build: false } });

  // Preview with SSI
  const serverInfo = await startPreviewServer(project.root, { apply: { preview: true } });
  servers.push(serverInfo);

  const html = await fetchHtml(serverInfo.url, '/');

  // Should have processed all nested includes
  expect(html).toContain('Nested Header');
  expect(html).toContain('Content');
  expect(html).toContain('nested content');
  expect(html).toContain('Nested Footer');

  // Should not contain SSI directives
  expect(html).not.toContain('<!--#include');
});

test('preview with apply: preview only', async () => {
  const project = await createTestProject('simple');
  servers.push(project);

  // Build without SSI
  await buildProject(project.root, { apply: { build: false, preview: true } });

  // Preview with SSI
  const serverInfo = await startPreviewServer(project.root, { apply: 'preview' });
  servers.push(serverInfo);

  const html = await fetchHtml(serverInfo.url, '/');

  // Should process SSI in preview
  expect(html).toContain('Navigation Menu');
  expect(html).not.toContain('<!--#include');
});
