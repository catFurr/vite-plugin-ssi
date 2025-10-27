import type { Plugin } from 'vite';

export interface VitePluginSsiOptions {
  /**
   * List of file extensions to process for SSI
   * @default ['.html']
   */
  include?: string[];

  /**
   * Customize SSI processing behavior
   */
  processIncludes?: (content: string) => string;
}

export default function vitePluginSsi(options: VitePluginSsiOptions = {}): Plugin {
  const {
    include = ['.html'],
    processIncludes = defaultProcessIncludes,
  } = options;

  return {
    name: 'vite-plugin-ssi',
    transform(code, id) {
      // Check if the file should be processed
      if (!include.some((ext) => id.endsWith(ext))) {
        return null;
      }

      // Process SSI directives
      return processIncludes(code);
    },
  };
}

// Default SSI include processing logic (basic implementation)
function defaultProcessIncludes(content: string): string {
  // Basic SSI include pattern matching (similar to Apache/Nginx)
  return content.replace(
    /<!--\s*#include\s+(virtual|file)="([^"]+)"\s*-->/g,
    (match, type, path) => {
      // This is a placeholder - actual implementation will involve file reading
      console.warn(`SSI include detected: ${type} - ${path}`);
      return match;
    }
  );
}
