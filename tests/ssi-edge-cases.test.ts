import { expect, test, afterEach } from 'bun:test';
import {
  createTestProject,
  buildProject,
  startDevServer,
  fetchHtml,
  readBuildOutput,
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

test('circular dependency detection', async () => {
  const project = await createTestProject('circular');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Should detect circular dependency
  expect(output).toContain('SSI Error: Circular include detected');
  expect(output).toContain('file-a.html');
  expect(output).toContain('file-b.html');
});

test('circular dependency in dev server', async () => {
  const project = await createTestProject('circular');
  const serverInfo = await startDevServer(project.root);
  servers.push(serverInfo);
  servers.push(project);

  const html = await fetchHtml(serverInfo.url, '/');

  // Should detect circular dependency
  expect(html).toContain('SSI Error: Circular include detected');
});

test('max depth exceeded', async () => {
  const project = await createTestProject('deep');
  projects.push(project);

  // Test with maxDepth of 3 (we have 6 levels)
  await buildProject(project.root, { maxDepth: 3 });

  const output = await readBuildOutput(project.root);

  // Should contain error for max depth exceeded
  expect(output).toContain('SSI Error: Maximum include depth');
  expect(output).toContain('(3) exceeded');
});

test('max depth with custom value', async () => {
  const project = await createTestProject('deep');
  projects.push(project);

  // Test with maxDepth of 5 (we have 6 levels)
  await buildProject(project.root, { maxDepth: 5 });

  const output = await readBuildOutput(project.root);

  // Should contain error for max depth exceeded
  expect(output).toContain('SSI Error: Maximum include depth');
  expect(output).toContain('(5) exceeded');
});

test('max depth not exceeded when within limit', async () => {
  const project = await createTestProject('deep');
  projects.push(project);

  // Test with maxDepth of 10 (we have 6 levels, should work)
  await buildProject(project.root, { maxDepth: 10 });

  const output = await readBuildOutput(project.root);

  // Should process all levels
  expect(output).toContain('Level 1');
  expect(output).toContain('Level 6');
  expect(output).not.toContain('SSI Error: Maximum include depth');
});

test('missing file handling', async () => {
  const project = await createTestProject('missing');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Should contain error for missing file
  expect(output).toContain('SSI Error: File not found');
  expect(output).toContain('nonexistent.html');

  // Content before and after should still be present
  expect(output).toContain('Missing File Test');
  expect(output).toContain('After missing include');
});

test('missing file in dev server', async () => {
  const project = await createTestProject('missing');
  const serverInfo = await startDevServer(project.root);
  servers.push(serverInfo);
  servers.push(project);

  const html = await fetchHtml(serverInfo.url, '/');

  // Should contain error for missing file
  expect(html).toContain('SSI Error: File not found');
  expect(html).toContain('nonexistent.html');
});

test('complex nested scenarios process correctly', async () => {
  const project = await createTestProject('complex');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Should have processed all includes correctly
  expect(output).toContain('charset');
  expect(output).toContain('viewport');
  expect(output).toContain('Home');
  expect(output).toContain('About');
  expect(output).toContain('Introduction');
  expect(output).toContain('about section');
  // HTML entity &copy; or actual © character
  expect(output).toMatch(/©|&copy;/);

  // Should not contain SSI directives
  expect(output).not.toContain('<!--#include');

  // Should not contain errors
  expect(output).not.toContain('SSI Error');
});

test('multiple includes in same file', async () => {
  const project = await createTestProject('simple');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Both includes should be processed
  expect(output).toContain('<header>');
  expect(output).toContain('<footer>');

  // Should have content between includes
  expect(output).toContain('Main Content');
  expect(output).toContain('This is the main content.');

  // Verify order: header before content before footer
  const headerPos = output.indexOf('<header>');
  const contentPos = output.indexOf('This is the main content.');
  const footerPos = output.indexOf('<footer>');

  expect(headerPos).toBeLessThan(contentPos);
  expect(contentPos).toBeLessThan(footerPos);
});

test('deep nesting within max depth', async () => {
  const project = await createTestProject('deep');
  projects.push(project);

  // Use maxDepth of 10, should process all 6 levels
  await buildProject(project.root, { maxDepth: 10 });

  const output = await readBuildOutput(project.root);

  // All levels should be processed
  expect(output).toContain('Level 1');
  expect(output).toContain('Level 2');
  expect(output).toContain('Level 3');
  expect(output).toContain('Level 4');
  expect(output).toContain('Level 5');
  expect(output).toContain('Level 6');

  // Should not contain error
  expect(output).not.toContain('SSI Error: Maximum include depth');
});

test('circular dependency error message format', async () => {
  const project = await createTestProject('circular');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Error should be in HTML comment format
  expect(output).toMatch(/<!--\s*SSI Error: Circular include detected:/);

  // Should mention both files in the cycle
  expect(output).toContain('file-a.html');
  expect(output).toContain('file-b.html');
});

test('max depth error message format', async () => {
  const project = await createTestProject('deep');
  projects.push(project);

  await buildProject(project.root, { maxDepth: 2 });

  const output = await readBuildOutput(project.root);

  // Error should be in HTML comment format
  expect(output).toMatch(/<!--\s*SSI Error: Maximum include depth/);
  expect(output).toContain('(2) exceeded');
});

test('missing file error message format', async () => {
  const project = await createTestProject('missing');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Error should be in HTML comment format
  expect(output).toMatch(/<!--\s*SSI Error: File not found:/);
  expect(output).toContain('nonexistent.html');
});

test('nested includes with relative paths', async () => {
  const project = await createTestProject('nested');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // All nested relative includes should resolve correctly
  expect(output).toContain('Nested Header');
  expect(output).toContain('Content');
  expect(output).toContain('Nested Footer');

  // Should not contain errors
  expect(output).not.toContain('SSI Error');
});

test('mixed relative and absolute paths', async () => {
  const project = await createTestProject('complex');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Both absolute (/common/head.html) and relative paths should work
  expect(output).toContain('charset');
  expect(output).toContain('viewport');
  expect(output).toContain('Home');

  // Should not contain errors
  expect(output).not.toContain('SSI Error');
});
