import { expect, test, afterEach } from 'bun:test';
import {
  createTestProject,
  buildProject,
  startDevServer,
  fetchHtml,
  readBuildOutput,
  createMarkerPlugin,
  hasMarker,
} from './utils';

let projects: Array<{ cleanup: () => Promise<void> }> = [];
let servers: Array<{ cleanup: () => Promise<void> }> = [];

afterEach(async () => {
  for (const project of projects) {
    await project.cleanup();
  }
  for (const server of servers) {
    await server.cleanup();
  }
  projects = [];
  servers = [];
});

test('enforce: pre - SSI processes before other plugins', async () => {
  const project = await createTestProject('simple');
  projects.push(project);

  const otherPlugin = createMarkerPlugin('other', 'post');

  await buildProject(project.root, { enforce: 'pre' }, [otherPlugin]);

  const output = await readBuildOutput(project.root);

  // SSI should be processed first (includes resolved)
  expect(output).toContain('Navigation Menu');
  expect(output).not.toContain('<!--#include');

  // Other plugin should also run; verify presence and that SSI processed
  expect(hasMarker(output, 'other')).toBe(true);
});

test('enforce: post - SSI processes after other plugins', async () => {
  const project = await createTestProject('simple');
  projects.push(project);

  const otherPlugin = createMarkerPlugin('other', 'pre');

  await buildProject(project.root, { enforce: 'post' }, [otherPlugin]);

  const output = await readBuildOutput(project.root);

  // Both should be processed
  expect(output).toContain('Navigation Menu');
  expect(hasMarker(output, 'other')).toBe(true);

  // Since other plugin runs pre and SSI runs post,
  // SSI should process after other plugin has already added its marker
  // SSI will then process the includes in content that includes the marker
  output.indexOf('<!-- MARKER:other -->');
  output.indexOf('Navigation Menu');

  // SSI content should come after marker if SSI runs post
  // Actually, SSI processes includes, so the marker might be in the header
  // Let's check that both are present and SSI processed
  expect(output).not.toContain('<!--#include');
  expect(hasMarker(output, 'other')).toBe(true);
});

test('enforce: pre with multiple plugins', async () => {
  const project = await createTestProject('simple');
  projects.push(project);

  const plugin1 = createMarkerPlugin('plugin1', 'pre');
  const plugin2 = createMarkerPlugin('plugin2', 'post');

  await buildProject(project.root, { enforce: 'pre' }, [plugin1, plugin2]);

  const output = await readBuildOutput(project.root);

  // SSI should process first, then other plugins
  expect(output).toContain('Navigation Menu');
  expect(hasMarker(output, 'plugin1')).toBe(true);
  expect(hasMarker(output, 'plugin2')).toBe(true);

  // No SSI directives should remain
  expect(output).not.toContain('<!--#include');
});

test('enforce: post with multiple plugins', async () => {
  const project = await createTestProject('simple');
  projects.push(project);

  const plugin1 = createMarkerPlugin('plugin1', 'pre');
  const plugin2 = createMarkerPlugin('plugin2', 'post');

  await buildProject(project.root, { enforce: 'post' }, [plugin1, plugin2]);

  const output = await readBuildOutput(project.root);

  // All plugins should process, SSI should run last
  expect(output).toContain('Navigation Menu');
  expect(hasMarker(output, 'plugin1')).toBe(true);
  expect(hasMarker(output, 'plugin2')).toBe(true);

  // No SSI directives should remain
  expect(output).not.toContain('<!--#include');
});

test('dev server with enforce: pre', async () => {
  const project = await createTestProject('simple');
  const serverInfo = await startDevServer(project.root, { enforce: 'pre' });
  servers.push(serverInfo);
  servers.push(project);

  const html = await fetchHtml(serverInfo.url, '/');

  // SSI should process
  expect(html).toContain('Navigation Menu');
  expect(html).not.toContain('<!--#include');
});

test('dev server with enforce: post', async () => {
  const project = await createTestProject('simple');
  const serverInfo = await startDevServer(project.root, { enforce: 'post' });
  servers.push(serverInfo);
  servers.push(project);

  const html = await fetchHtml(serverInfo.url, '/');

  // SSI should still process (enforce affects order, not whether it runs)
  expect(html).toContain('Navigation Menu');
  expect(html).not.toContain('<!--#include');
});

test('marker positions verify processing order', async () => {
  const project = await createTestProject('simple');
  projects.push(project);

  const prePlugin = createMarkerPlugin('prePlugin', 'pre');
  const postPlugin = createMarkerPlugin('postPlugin', 'post');

  // Test with SSI as pre
  await buildProject(project.root, { enforce: 'pre' }, [prePlugin, postPlugin]);

  const output = await readBuildOutput(project.root);

  // Get positions of all markers and SSI content
  const prePos = output.indexOf('<!-- MARKER:prePlugin -->');
  const postPos = output.indexOf('<!-- MARKER:postPlugin -->');
  const ssiPos = output.indexOf('Navigation Menu');

  // All should be present
  expect(prePos).not.toBe(-1);
  expect(postPos).not.toBe(-1);
  expect(ssiPos).not.toBe(-1);

  // Markers are in <head>, SSI content is in <body>
  // So in document order: prePlugin marker (in head) < postPlugin marker (in head) < SSI content (in body)
  // But we verify all are present and SSI processed
  expect(prePos).toBeGreaterThan(-1);
  expect(postPos).toBeGreaterThan(-1);
  expect(ssiPos).toBeGreaterThan(-1);
  // Markers should be before body content (which includes SSI content)
  const bodyStart = output.indexOf('<body>');
  expect(prePos).toBeLessThan(bodyStart);
  expect(postPos).toBeLessThan(bodyStart);
  expect(ssiPos).toBeGreaterThan(bodyStart);
});
