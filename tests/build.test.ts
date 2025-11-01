import { expect, test, afterEach } from 'bun:test';
import { join, resolve } from 'path';
import { mkdir } from 'fs/promises';
import { createTestProject, buildProject, readBuildOutput } from './utils';

let projects: Array<{ cleanup: () => Promise<void> }> = [];

afterEach(async () => {
  for (const project of projects) {
    await project.cleanup();
  }
  projects = [];
});

test('build processes simple SSI includes', async () => {
  const project = await createTestProject('simple');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Should have processed includes
  expect(output).toContain('<header>');
  expect(output).toContain('Navigation Menu');
  expect(output).toContain('<footer>');
  expect(output).toContain('Footer Content © 2024');

  // Should not contain SSI directives
  expect(output).not.toContain('<!--#include');
});

test('build processes nested SSI includes', async () => {
  const project = await createTestProject('nested');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Should have processed all nested includes
  expect(output).toContain('Nested Header');
  expect(output).toContain('Content');
  expect(output).toContain('nested content');
  expect(output).toContain('Nested Footer');

  // Should not contain SSI directives
  expect(output).not.toContain('<!--#include');
});

test('build processes multiple includes in same file', async () => {
  const project = await createTestProject('simple');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Both includes should be processed
  const headerCount = (output.match(/<header>/g) || []).length;
  const footerCount = (output.match(/<footer>/g) || []).length;

  expect(headerCount).toBeGreaterThan(0);
  expect(footerCount).toBeGreaterThan(0);
});

test('build processes absolute path includes', async () => {
  const project = await createTestProject('absolute-path');
  projects.push(project);

  // Copy simple fixture files so absolute paths can find them
  const fixturesDir = resolve(import.meta.dir, 'fixtures', 'simple');

  await mkdir(join(project.root, 'simple'), { recursive: true });

  const simpleHeader = Bun.file(join(fixturesDir, 'header.html'));
  const simpleFooter = Bun.file(join(fixturesDir, 'footer.html'));

  await Bun.write(join(project.root, 'simple', 'header.html'), await simpleHeader.text());
  await Bun.write(join(project.root, 'simple', 'footer.html'), await simpleFooter.text());

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Should have processed includes using absolute paths
  expect(output).toContain('Navigation Menu');
  expect(output).toContain('Footer Content');
});

test('build processes complex nested scenarios', async () => {
  const project = await createTestProject('complex');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // Should have processed all includes
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
});

test('build with custom maxDepth option', async () => {
  const project = await createTestProject('deep');
  projects.push(project);

  // Test with maxDepth of 3 (should stop at level 3)
  await buildProject(project.root, { maxDepth: 3 });

  const output = await readBuildOutput(project.root);

  // Should contain error message for max depth exceeded
  expect(output).toContain('SSI Error: Maximum include depth');
  expect(output).toContain('(3) exceeded');
});

test('build output does not contain include directives', async () => {
  const project = await createTestProject('simple');
  projects.push(project);

  await buildProject(project.root);

  const output = await readBuildOutput(project.root);

  // No SSI directives should remain
  expect(output).not.toMatch(/<!--#include\s+virtual=/);
});
