import { promises as fs } from 'fs';
import * as path from 'path';
import { matchesFileType, DEFAULT_FILE_TYPE_MAP, type FileTypeMap } from './file-types';

export interface ProcessResult {
  code: string;
  deps: Set<string>;
}

export interface ProcessSsiOptions {
  root: string;
  maxDepth: number;
  includeFileTypes?: string[];
  fileTypeMap?: FileTypeMap;
}

/**
 * Resolves an include path based on the virtual path and including file location
 */
function resolveIncludePath(virtualPath: string, includingFile: string, root: string): string {
  if (virtualPath.startsWith('/')) {
    // From project root - remove leading slash to avoid discarding root
    return path.join(root, virtualPath.slice(1));
  }
  // Relative to including file
  const includingDir = path.dirname(includingFile);
  return path.resolve(includingDir, virtualPath);
}

/**
 * Normalizes a file path to absolute path for consistent comparison
 */
export function normalizePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/');
}

/**
 * Processes SSI includes recursively
 */
export async function processSsi(
  filePath: string,
  content: string,
  options: ProcessSsiOptions
): Promise<ProcessResult> {
  const { root, maxDepth, includeFileTypes = [], fileTypeMap = DEFAULT_FILE_TYPE_MAP } = options;
  return processSsiRecursive(filePath, content, root, new Set(), 0, maxDepth, includeFileTypes, fileTypeMap);
}

/**
 * Internal recursive SSI processing function
 */
async function processSsiRecursive(
  filePath: string,
  content: string,
  root: string,
  seen: Set<string>,
  depth: number,
  maxDepth: number,
  includeFileTypes: string[],
  fileTypeMap: FileTypeMap
): Promise<ProcessResult> {
  const normalizedPath = normalizePath(filePath);
  const deps = new Set<string>();

  // Check for circular includes
  if (seen.has(normalizedPath)) {
    const seenArray = Array.from(seen);
    const cycleStart = seenArray.indexOf(normalizedPath);
    const cycle = seenArray.slice(cycleStart).concat(normalizedPath).join(' -> ');
    return {
      code: `<!-- SSI Error: Circular include detected: ${cycle} -->`,
      deps,
    };
  }

  // Check max depth
  if (depth >= maxDepth) {
    return {
      code: `<!-- SSI Error: Maximum include depth (${maxDepth}) exceeded -->`,
      deps,
    };
  }

  // Add current file to seen set for circular detection
  seen.add(normalizedPath);

  // Find all include directives
  const includeRegex = /<!--#include\s+virtual\s*=\s*"([^"]+)"\s*-->/g;
  let match: RegExpExecArray | null;
  let result = content;
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  // Collect all matches first
  const matches: Array<{ index: number; length: number; virtualPath: string }> = [];
  while ((match = includeRegex.exec(content)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      virtualPath: match[1],
    });
  }

  // Process matches in reverse order to maintain correct indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const { index, length, virtualPath } = matches[i];
    const matchEnd = index + length;

    // Resolve include path
    const resolvedPath = resolveIncludePath(virtualPath, filePath, root);
    const normalizedResolvedPath = normalizePath(resolvedPath);

    // Track dependency
    deps.add(normalizedResolvedPath);

    try {
      // Check if file exists
      await fs.access(resolvedPath);

      // Read included file
      const includedContent = await fs.readFile(resolvedPath, 'utf-8');

      // Check if this included file should have SSI processing applied
      // If includeFileTypes is specified and the file matches those types, process it
      // Otherwise, don't process included files (default: only top-level HTML files are processed)
      const shouldProcessSsi =
        includeFileTypes.length === 0
          ? false // Default: don't process included files
          : matchesFileType(resolvedPath, includeFileTypes, fileTypeMap);

      let processed: ProcessResult;
      if (shouldProcessSsi) {
        // Recursively process included content with SSI
        processed = await processSsiRecursive(
          resolvedPath,
          includedContent,
          root,
          new Set(seen),
          depth + 1,
          maxDepth,
          includeFileTypes,
          fileTypeMap
        );
      } else {
        // Just use the content as-is, but still track it as a dependency
        processed = {
          code: includedContent,
          deps: new Set(),
        };
      }

      // Merge dependencies
      processed.deps.forEach((dep) => deps.add(dep));

      // Replace directive with processed content
      replacements.push({
        start: index,
        end: matchEnd,
        replacement: processed.code,
      });
    } catch (error) {
      // File not found or other error
      replacements.push({
        start: index,
        end: matchEnd,
        replacement: `<!-- SSI Error: File not found: ${normalizedResolvedPath} -->`,
      });
    }
  }

  // Apply replacements in reverse order
  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  return { code: result, deps };
}

