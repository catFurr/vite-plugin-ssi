import { expect, test, afterEach } from 'bun:test';
import { createTestProject, startDevServer, fetchHtml } from './utils';

let servers: Array<{ cleanup: () => Promise<void> }> = [];

afterEach(async () => {
  for (const server of servers) {
    await server.cleanup();
  }
  servers = [];
});

test('dev server serves processed HTML with simple includes', async () => {
  const project = await createTestProject('simple');
  const serverInfo = await startDevServer(project.root);
  servers.push(serverInfo);
  servers.push(project);

  const html = await fetchHtml(serverInfo.url, '/');

  // Should have processed includes
  expect(html).toContain('<header>');
  expect(html).toContain('Navigation Menu');
  expect(html).toContain('<footer>');
  expect(html).toContain('Footer Content © 2024');

  // Should not contain SSI directives
  expect(html).not.toContain('<!--#include');
});

test('dev server serves processed HTML with nested includes', async () => {
  const project = await createTestProject('nested');
  const serverInfo = await startDevServer(project.root);
  servers.push(serverInfo);
  servers.push(project);

  const html = await fetchHtml(serverInfo.url, '/');

  // Should have processed all nested includes
  expect(html).toContain('Nested Header');
  expect(html).toContain('Content');
  expect(html).toContain('nested content');
  expect(html).toContain('Nested Footer');

  // Should not contain SSI directives
  expect(html).not.toContain('<!--#include');
});

test('dev server processes files on-the-fly', async () => {
  const project = await createTestProject('simple');
  const serverInfo = await startDevServer(project.root);
  servers.push(serverInfo);
  servers.push(project);

  // Fetch HTML multiple times to ensure consistent processing
  const html1 = await fetchHtml(serverInfo.url, '/');
  const html2 = await fetchHtml(serverInfo.url, '/');

  expect(html1).toBe(html2);
  expect(html1).not.toContain('<!--#include');
});

test('dev server with apply: serve only', async () => {
  const project = await createTestProject('simple');
  const serverInfo = await startDevServer(project.root, { apply: 'serve' });
  servers.push(serverInfo);
  servers.push(project);

  const html = await fetchHtml(serverInfo.url, '/');

  // Should still process in dev server (serve mode)
  expect(html).toContain('Navigation Menu');
  expect(html).not.toContain('<!--#include');
});

test('dev server with apply: { serve: true }', async () => {
  const project = await createTestProject('simple');
  const serverInfo = await startDevServer(project.root, { apply: { serve: true, build: false } });
  servers.push(serverInfo);
  servers.push(project);

  const html = await fetchHtml(serverInfo.url, '/');

  // Should process in serve mode
  expect(html).toContain('Navigation Menu');
  expect(html).not.toContain('<!--#include');
});

test('dev server serves complex nested scenarios', async () => {
  const project = await createTestProject('complex');
  const serverInfo = await startDevServer(project.root);
  servers.push(serverInfo);
  servers.push(project);

  const html = await fetchHtml(serverInfo.url, '/');

  // Should have processed all includes
  expect(html).toContain('charset');
  expect(html).toContain('viewport');
  expect(html).toContain('Home');
  expect(html).toContain('About');
  expect(html).toContain('Introduction');
  expect(html).toContain('about section');

  // Should not contain SSI directives
  expect(html).not.toContain('<!--#include');
});
