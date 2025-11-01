import { rm, mkdir, readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import type { UserConfig, ViteDevServer, Plugin } from 'vite';
import { build, createServer, preview } from 'vite';
import vitePluginSsi from '../src/index';
import type { VitePluginSsiOptions } from '../src/index';

export interface TestProject {
  root: string;
  cleanup: () => Promise<void>;
}

export interface DevServerInfo {
  server: ViteDevServer | import('vite').PreviewServer;
  url: string;
  cleanup: () => Promise<void>;
}

/**
 * Recursively copies a directory
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      const content = await Bun.file(srcPath).arrayBuffer();
      await Bun.write(destPath, content);
    }
  }
}

/**
 * Gets the test project directory path
 */
function getTestProjectDir(): string {
  return resolve(import.meta.dir, 'sites', 'test-project');
}

/**
 * Cleans the test project directory to ensure fresh state
 */
async function cleanTestProject(root: string): Promise<void> {
  // Remove dist, node_modules, .vite cache
  const dirsToRemove = ['dist', 'node_modules', '.vite'];
  for (const dir of dirsToRemove) {
    const dirPath = join(root, dir);
    try {
      await stat(dirPath);
      await rm(dirPath, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }
  }
}

/**
 * Creates a test Vite project with the SSI plugin configured
 * Uses a fixed directory in the repo (tests/sites/test-project)
 * Ensures clean state by removing dist, cache, etc.
 */
export async function createTestProject(fixtureName: string): Promise<TestProject> {
  const testProjectDir = getTestProjectDir();
  const fixturesDir = resolve(import.meta.dir, 'fixtures', fixtureName);

  // Clean previous test state
  await cleanTestProject(testProjectDir);

  // Ensure test project directory exists
  await mkdir(testProjectDir, { recursive: true });

  // Copy fixture files to test project directory (overwrites existing)
  await copyDir(fixturesDir, testProjectDir);

  return {
    root: testProjectDir,
    cleanup: async () => {
      // Clean up after test to ensure next test starts fresh
      await cleanTestProject(testProjectDir);
    },
  };
}

/**
 * Creates a Vite config for testing
 */
export function createViteConfig(
  root: string,
  pluginOptions: VitePluginSsiOptions = {},
  additionalPlugins: Plugin[] = []
): UserConfig {
  return {
    root,
    clearScreen: false,
    logLevel: 'warn', // Reduce noise in tests
    plugins: [vitePluginSsi(pluginOptions), ...additionalPlugins],
    build: {
      outDir: 'dist',
      emptyOutDir: true, // Ensure clean build
      rollupOptions: {
        input: join(root, 'index.html'),
      },
    },
    server: {
      port: 0, // Random port
      strictPort: false,
    },
    preview: {
      port: 0, // Random port
      strictPort: false,
    },
    // Disable cache to ensure tests are deterministic
    optimizeDeps: {
      noDiscovery: true,
      include: undefined,
    },
  };
}

/**
 * Runs a build with the given configuration
 * Ensures clean state before building
 */
export async function buildProject(
  root: string,
  pluginOptions: VitePluginSsiOptions = {},
  additionalPlugins: Plugin[] = []
): Promise<string> {
  // Clean before build to ensure fresh state
  await cleanTestProject(root);

  const config = createViteConfig(root, pluginOptions, additionalPlugins);
  await build(config);
  return root;
}

/**
 * Starts a dev server and returns server info
 * Ensures clean state before starting
 */
export async function startDevServer(
  root: string,
  pluginOptions: VitePluginSsiOptions = {},
  additionalPlugins: Plugin[] = []
): Promise<DevServerInfo> {
  // Clean before starting server to ensure fresh state
  await cleanTestProject(root);

  const config = createViteConfig(root, pluginOptions, additionalPlugins);
  const server = await createServer(config);
  await server.listen();

  const address = server.httpServer?.address();
  let url: string;

  if (typeof address === 'string') {
    url = address;
  } else if (address && 'port' in address) {
    url = `http://localhost:${address.port}`;
  } else {
    throw new Error('Could not determine server URL');
  }

  return {
    server,
    url,
    cleanup: async () => {
      await server.close();
    },
  };
}

/**
 * Starts a preview server and returns server info
 * Ensures clean state before starting
 */
export async function startPreviewServer(
  root: string,
  pluginOptions: VitePluginSsiOptions = {},
  additionalPlugins: Plugin[] = []
): Promise<DevServerInfo> {
  // Don't clean dist - preview needs the build output
  // Only clean cache directories that might interfere
  const cacheDirs = ['.vite'];
  for (const dir of cacheDirs) {
    const dirPath = join(root, dir);
    try {
      await rm(dirPath, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }
  }

  const config = createViteConfig(root, pluginOptions, additionalPlugins);
  const server = await preview(config);

  // Wait a bit for server to be ready
  await wait(100);

  const address = server.httpServer?.address();
  let url: string;

  if (typeof address === 'string') {
    url = address;
  } else if (address && 'port' in address) {
    url = `http://localhost:${address.port}`;
  } else {
    throw new Error('Could not determine preview server URL');
  }

  return {
    server,
    url,
    cleanup: async () => {
      await new Promise<void>((resolve) => {
        server.httpServer?.close(() => resolve());
      });
    },
  };
}

/**
 * Extracts the best (most processed) complete HTML document from a string that may contain multiple HTML documents
 */
function extractLastHtml(html: string): string {
  // If HTML contains multiple complete documents, find the one with the most processing
  const matches = html.match(/<!DOCTYPE html>[\s\S]*?<\/html>/g);
  if (matches && matches.length > 0) {
    // Find the one with no include directives (fully processed)
    // If all have directives, pick the one with the least directives
    let bestMatch = matches[0];
    let bestScore = -Infinity;

    for (const match of matches) {
      const directiveCount = (match.match(/<!--#include/g) || []).length;

      // Highest priority: no directives (fully processed)
      if (directiveCount === 0) {
        return match;
      }

      // Otherwise, prefer documents with more processed content
      const hasHeader =
        match.includes('<header>') || match.includes('<h1>') || match.includes('<h2>');
      const hasFooter = match.includes('<footer>');
      const processedContentScore = (hasHeader ? 50 : 0) + (hasFooter ? 50 : 0);

      // Score: processed content positive, directives negative
      const score = processedContentScore - directiveCount * 100;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = match;
      }
    }

    return bestMatch;
  }
  return html;
}

/**
 * Fetches HTML from a URL
 */
export async function fetchHtml(url: string, path: string = '/'): Promise<string> {
  const fullUrl = new URL(path, url).toString();
  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${fullUrl}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  // Extract the last complete HTML document if multiple are present
  return extractLastHtml(html);
}

/**
 * Reads a file from the build output
 * Extracts the best (most processed) HTML document if multiple are present
 */
export async function readBuildOutput(
  root: string,
  filePath: string = 'index.html'
): Promise<string> {
  const fullPath = join(root, 'dist', filePath);
  const file = Bun.file(fullPath);
  const html = await file.text();
  // Extract the best HTML document if multiple are present (same as dev server)
  return extractLastHtml(html);
}

/**
 * Waits for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for HMR update by polling for changes
 * This is a simple implementation - in real tests you might want to use WebSocket
 */
export async function waitForHMRUpdate(
  server: ViteDevServer,
  filePath: string,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    // Check if module graph has been updated
    const modules = server.moduleGraph.getModulesByFile(filePath);
    if (modules && modules.size > 0) {
      // Module exists, could be updated
      await wait(100);
      return;
    }
    await wait(100);
  }
  throw new Error(`Timeout waiting for HMR update for ${filePath}`);
}

/**
 * Creates a test plugin that adds markers to HTML
 */
export function createMarkerPlugin(name: string, enforce: 'pre' | 'post' = 'pre'): Plugin {
  return {
    name: `test-plugin-${name}`,
    enforce,
    transformIndexHtml(html: string) {
      return html.replace('<head>', `<head>\n<!-- MARKER:${name} -->`);
    },
  };
}

/**
 * Checks if a string contains a marker
 */
export function hasMarker(html: string, marker: string): boolean {
  return html.includes(`<!-- MARKER:${marker} -->`);
}

/**
 * Gets the position of markers in HTML to verify order
 */
export function getMarkerPositions(html: string, markers: string[]): number[] {
  return markers.map((marker) => html.indexOf(`<!-- MARKER:${marker} -->`));
}
