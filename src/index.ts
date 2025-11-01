import type { Plugin } from 'vite';
import * as path from 'path';
import { DEFAULT_FILE_TYPE_MAP, type FileTypeMap } from './file-types';
import { normalizePath, processSsi } from './ssi';
import { setupPreviewServer, handleHotUpdate, transformIndexHtml } from './dev-server';
import type { ProcessSsiOptions } from './ssi';

// Re-export types for convenience
export type { FileTypeMap } from './file-types';

export interface VitePluginSsiOptions {
  /**
   * Maximum depth for recursive includes
   * @default 10
   */
  maxDepth?: number;

  /**
   * When to run this plugin in the pipeline
   * @default 'pre'
   */
  enforce?: 'pre' | 'post';

  /**
   * Apply plugin only in specific environments
   * @default undefined (applies to all environments)
   */
  apply?:
    | 'serve'
    | 'build'
    | 'preview'
    | {
        serve?: boolean;
        build?: boolean;
        preview?: boolean;
      };

  /**
   * File types to apply SSI processing to for included files (at any depth)
   * SSI always applies to top-level HTML files (.html, .htm, .shtml)
   * When files are included via SSI, they will also be processed if they match these types
   * Examples: ['js', 'html', 'css'] - will process .js/.ts/.mjs/etc., .html/.htm/.shtml, .css/.scss/etc.
   * @default [] (only process top-level HTML files)
   */
  includeFileTypes?: string[];

  /**
   * Custom file type to extension mappings
   * Allows overriding or extending the default mappings
   */
  fileTypeMap?: FileTypeMap;
}

/**
 * Maps user's apply option to Vite's apply format
 * Note: Vite's apply only supports 'serve' | 'build', not 'preview'
 */
function normalizeApplyOption(apply: VitePluginSsiOptions['apply']): Plugin['apply'] {
  if (!apply) {
    return undefined; // Apply to all
  }

  if (typeof apply === 'string') {
    // Filter out 'preview' as Vite doesn't support it directly
    if (apply === 'preview') {
      return undefined; // We'll handle preview in shouldApplyInEnvironment
    }
    return apply;
  }

  // Object form: { serve?: boolean, build?: boolean, preview?: boolean }
  // Convert to 'serve' | 'build' | undefined
  // Note: preview is handled separately in shouldApplyInEnvironment
  if (apply.serve === true && !apply.build) {
    return 'serve';
  }
  if (apply.build === true && !apply.serve) {
    return 'build';
  }
  // If mixed or preview, we'll handle in hooks
  return undefined;
}

/**
 * Checks if plugin should apply in current environment
 */
function shouldApplyInEnvironment(
  apply: VitePluginSsiOptions['apply'],
  command: 'serve' | 'build' | 'preview'
): boolean {
  if (!apply) {
    return true; // Apply to all
  }

  if (typeof apply === 'string') {
    return apply === command;
  }

  // Object form
  if (command === 'serve') {
    return apply.serve !== false; // Default to true if not specified
  }
  if (command === 'build') {
    return apply.build !== false;
  }
  if (command === 'preview') {
    return apply.preview !== false;
  }

  return true;
}

export default function vitePluginSsi(options: VitePluginSsiOptions = {}): Plugin {
  const {
    maxDepth = 10,
    enforce = 'pre',
    apply: applyOption,
    includeFileTypes = [],
    fileTypeMap,
  } = options;

  // Merge user's file type map with defaults
  const mergedFileTypeMap: FileTypeMap = {
    ...DEFAULT_FILE_TYPE_MAP,
    ...fileTypeMap,
  };

  // Dependency graph: maps HTML file path to set of dependent file paths
  const dependencyGraph = new Map<string, Set<string>>();

  // Reverse dependency map: maps dependent file to set of HTML files that depend on it
  const reverseDependencyMap = new Map<string, Set<string>>();

  let server: import('vite').ViteDevServer | undefined;
  let command: 'serve' | 'build' | 'preview' = 'serve';
  let resolvedRoot: string | undefined;

  return {
    name: 'vite-plugin-ssi',
    enforce,
    apply: normalizeApplyOption(applyOption),

    configResolved(config) {
      // Determine command from config
      command = (config.command as 'serve' | 'build' | 'preview') || 'serve';
      resolvedRoot = config.root;
    },

    configureServer(_server) {
      server = _server;
    },

    configurePreviewServer(previewServer) {
      // Add middleware to process built HTML on-the-fly in preview mode
      // Only if plugin should apply in preview
      if (!shouldApplyInEnvironment(applyOption, 'preview')) {
        return () => {};
      }

      setupPreviewServer(previewServer, {
        maxDepth,
        includeFileTypes,
        fileTypeMap: mergedFileTypeMap,
      });
    },

    async transformIndexHtml(html, ctx) {
      // Check if should apply in current environment
      // For preview, transformIndexHtml should also work
      const currentCommand = ctx.server
        ? (ctx.server.config.command as 'serve' | 'build' | 'preview') || 'serve'
        : command;
      if (!shouldApplyInEnvironment(applyOption, currentCommand)) {
        return html;
      }

      const root = ctx.server?.config.root || resolvedRoot || process.cwd();

      // Process HTML with SSI
      const result = await transformIndexHtml(html, ctx, {
        root,
        maxDepth,
        includeFileTypes,
        fileTypeMap: mergedFileTypeMap,
      });

      // Update dependency graph (need to process again to get deps)
      const filename = ctx.filename || 'index.html';
      const filePath = path.isAbsolute(filename) ? filename : path.resolve(root, filename);
      const normalizedFilePath = normalizePath(filePath);

      // Re-process to get dependencies for tracking
      const processOptions: ProcessSsiOptions = {
        root,
        maxDepth,
        includeFileTypes,
        fileTypeMap: mergedFileTypeMap,
      };
      const depsResult = await processSsi(filePath, html, processOptions);
      dependencyGraph.set(normalizedFilePath, depsResult.deps);

      // Update reverse dependency map
      depsResult.deps.forEach((dep) => {
        if (!reverseDependencyMap.has(dep)) {
          reverseDependencyMap.set(dep, new Set());
        }
        reverseDependencyMap.get(dep)!.add(normalizedFilePath);
      });

      return result;
    },

    handleHotUpdate(ctx) {
      // Check if should apply in current environment
      if (!shouldApplyInEnvironment(applyOption, command)) {
        return;
      }

      if (!server) {
        return;
      }

      return handleHotUpdate(ctx, server, reverseDependencyMap);
    },
  };
}
