import type { ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { promises as fs } from 'fs';
import * as path from 'path';
import { normalizePath, processSsi } from './ssi';
import type { ProcessSsiOptions } from './ssi';

export interface DevServerOptions {
  maxDepth: number;
  includeFileTypes?: string[];
  fileTypeMap?: import('./file-types').FileTypeMap;
}

/**
 * Sets up preview server middleware to process SSI on-the-fly
 */
export function setupPreviewServer(
  previewServer: PreviewServer,
  options: DevServerOptions
): void {
  const outDir = previewServer.config.build.outDir || 'dist';
  const projectRoot = previewServer.config.root;
  const distRoot = path.resolve(projectRoot, outDir);

  const processOptions: ProcessSsiOptions = {
    root: projectRoot,
    maxDepth: options.maxDepth,
    includeFileTypes: options.includeFileTypes,
    fileTypeMap: options.fileTypeMap,
  };

  // Add middleware directly (runs before other middlewares)
  // This intercepts HTML requests before static file serving
  previewServer.middlewares.use(
    async (req: IncomingMessage, res: ServerResponse, next: (err?: Error) => void) => {
      try {
        if (!req.url || req.method !== 'GET') return next();

        // Normalize path
        let reqPath = req.url.split('?')[0]; // Remove query string
        if (reqPath === '/' || reqPath === '') {
          reqPath = '/index.html';
        }
        if (!reqPath.endsWith('.html')) return next();

        // Remove leading slash and resolve from dist root
        const filePath = path.join(
          distRoot,
          reqPath.startsWith('/') ? reqPath.slice(1) : reqPath
        );
        const exists = await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false);
        if (!exists) return next();

        const raw = await fs.readFile(filePath, 'utf-8');
        // In preview mode, resolve includes from source root
        // Map dist file path back to source path for proper resolution
        // If file is at dist/index.html, resolve includes relative to projectRoot/index.html
        const relativePath = path.relative(distRoot, filePath);
        const sourceFilePath = path.join(projectRoot, relativePath);
        const result = await processSsi(sourceFilePath, raw, processOptions);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(result.code);
        return;
      } catch (err) {
        return next();
      }
    }
  );
}

/**
 * Handles HMR updates when SSI dependency files change
 */
export function handleHotUpdate(
  ctx: { file: string },
  server: ViteDevServer,
  reverseDependencyMap: Map<string, Set<string>>
): Array<import('vite').ModuleNode> | void {
  const changedFile = normalizePath(ctx.file);

  // Check if changed file is a dependency of any HTML file
  const affectedHtmlFiles = reverseDependencyMap.get(changedFile);
  if (!affectedHtmlFiles || affectedHtmlFiles.size === 0) {
    return;
  }

  // Find and reload affected HTML modules
  // HTML files in Vite are accessed via URL, so we need to find them by URL
  const affectedModules: Array<import('vite').ModuleNode> = [];

  for (const htmlFile of affectedHtmlFiles) {
    // Try to find modules by file path using getModulesByFile
    const modulesByFile = server.moduleGraph.getModulesByFile(htmlFile);
    if (modulesByFile && modulesByFile.size > 0) {
      modulesByFile.forEach((module) => {
        affectedModules.push(module);
      });
    } else {
      // Fallback: try to construct the URL and look it up
      // HTML files are typically accessed via URL path
      try {
        const relativePath = path.relative(server.config.root, htmlFile);
        const url = `/${relativePath.replace(/\\/g, '/')}`;
        const urlModule = server.moduleGraph.urlToModuleMap.get(url);
        if (urlModule) {
          affectedModules.push(urlModule);
        }
      } catch {
        // Ignore errors
      }
    }
  }

  // Reload affected modules
  if (affectedModules.length > 0) {
    // For HTML files, we need to invalidate them so they get re-transformed
    // Since HTML files might not be traditional modules, we trigger reload for their URLs
    affectedModules.forEach((module) => {
      try {
        server.moduleGraph.invalidateModule(module);
        // Also try reloadModule if it exists on the server
        if ('reloadModule' in server && typeof server.reloadModule === 'function') {
          server.reloadModule(module);
        }
      } catch {
        // If module doesn't support reload, trigger full reload as fallback
        server.ws.send({ type: 'full-reload' });
      }
    });

    return affectedModules;
  }

  // If we couldn't find modules but know files are affected, trigger full reload
  if (affectedHtmlFiles.size > 0) {
    server.ws.send({ type: 'full-reload' });
  }
}

/**
 * Transforms index HTML with SSI processing
 */
export async function transformIndexHtml(
  html: string,
  ctx: {
    filename?: string;
    server?: ViteDevServer;
  },
  options: DevServerOptions & { root?: string }
): Promise<string> {
  const root = ctx.server?.config.root || options.root || process.cwd();
  const filename = ctx.filename || 'index.html';
  // Ensure filename is absolute relative to root
  const filePath = path.isAbsolute(filename) ? filename : path.resolve(root, filename);

  try {
    const processOptions: ProcessSsiOptions = {
      root,
      maxDepth: options.maxDepth,
      includeFileTypes: options.includeFileTypes,
      fileTypeMap: options.fileTypeMap,
    };

    // Process SSI includes
    const result = await processSsi(filePath, html, processOptions);
    return result.code;
  } catch (error) {
    // Return error as HTML comment
    return `<!-- SSI Error: ${error instanceof Error ? error.message : String(error)} -->\n${html}`;
  }
}

