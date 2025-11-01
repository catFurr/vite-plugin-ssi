import { expect, test, afterEach } from 'bun:test';
import { join } from 'path';
import { createTestProject, startDevServer, fetchHtml, wait } from './utils';

let servers: Array<{ cleanup: () => Promise<void> }> = [];

afterEach(async () => {
  for (const server of servers) {
    await server.cleanup();
  }
  servers = [];
});

test('HMR reloads HTML when included file changes', async () => {
  const project = await createTestProject('simple');
  const serverInfo = await startDevServer(project.root);
  servers.push(serverInfo);
  servers.push(project);

  // Fetch initial HTML
  const html1 = await fetchHtml(serverInfo.url, '/');
  expect(html1).toContain('Navigation Menu');

  // Modify the included file
  const headerPath = join(project.root, 'header.html');
  await Bun.write(headerPath, '<header><nav>Updated Navigation Menu</nav></header>\n');

  // Wait a bit for HMR to process
  await wait(500);

  // Fetch HTML again - should have updated content
  const html2 = await fetchHtml(serverInfo.url, '/');
  expect(html2).toContain('Updated Navigation Menu');
  expect(html2).not.toContain('<nav>Navigation Menu</nav>');
});

test('HMR reloads HTML when nested included file changes', async () => {
  const project = await createTestProject('nested');
  const serverInfo = await startDevServer(project.root);
  servers.push(serverInfo);
  servers.push(project);

  // Fetch initial HTML
  const html1 = await fetchHtml(serverInfo.url, '/');
  expect(html1).toContain('Nested Header');

  // Modify nested included file
  const headerPath = join(project.root, 'header.html');
  await Bun.write(headerPath, '<header><h1>Updated Nested Header</h1></header>\n');

  // Wait for HMR
  await wait(500);

  // Fetch HTML again
  const html2 = await fetchHtml(serverInfo.url, '/');
  expect(html2).toContain('Updated Nested Header');
  expect(html2).not.toContain('<h1>Nested Header</h1>');
});

test('HMR reloads when wrapper file changes', async () => {
  const project = await createTestProject('nested');
  const serverInfo = await startDevServer(project.root);
  servers.push(serverInfo);
  servers.push(project);

  // Fetch initial HTML
  await fetchHtml(serverInfo.url, '/');

  // Modify wrapper file
  const wrapperPath = join(project.root, 'wrapper.html');
  const wrapperContent = await Bun.file(wrapperPath).text();
  const updatedWrapper = wrapperContent.replace(
    '<div class="wrapper">',
    '<div class="wrapper updated">'
  );
  await Bun.write(wrapperPath, updatedWrapper);

  // Wait for HMR
  await wait(500);

  // Fetch HTML again
  const html2 = await fetchHtml(serverInfo.url, '/');
  expect(html2).toContain('class="wrapper updated"');
});

test('HMR propagates changes through include chain', async () => {
  const project = await createTestProject('nested');
  const serverInfo = await startDevServer(project.root);
  servers.push(serverInfo);
  servers.push(project);

  // Fetch initial HTML
  const html1 = await fetchHtml(serverInfo.url, '/');
  expect(html1).toContain('nested content');

  // Modify content.html which is included by wrapper.html which is included by index.html
  const contentPath = join(project.root, 'content.html');
  await Bun.write(
    contentPath,
    '<article><h2>Updated Content</h2><p>This is updated nested content.</p></article>\n'
  );

  // Wait for HMR
  await wait(500);

  // Fetch HTML again - change should propagate
  const html2 = await fetchHtml(serverInfo.url, '/');
  expect(html2).toContain('Updated Content');
  expect(html2).toContain('updated nested content');
});

test('multiple includes in same file - HMR works for both', async () => {
  const project = await createTestProject('simple');
  const serverInfo = await startDevServer(project.root);
  servers.push(serverInfo);
  servers.push(project);

  // Fetch initial HTML
  const html1 = await fetchHtml(serverInfo.url, '/');
  expect(html1).toContain('Navigation Menu');
  expect(html1).toContain('Footer Content');

  // Modify header
  const headerPath = join(project.root, 'header.html');
  await Bun.write(headerPath, '<header><nav>Header Updated</nav></header>\n');
  await wait(300);

  // Modify footer
  const footerPath = join(project.root, 'footer.html');
  await Bun.write(footerPath, '<footer><p>Footer Updated</p></footer>\n');
  await wait(500);

  // Fetch HTML again - both changes should be reflected
  const html2 = await fetchHtml(serverInfo.url, '/');
  expect(html2).toContain('Header Updated');
  expect(html2).toContain('Footer Updated');
});
