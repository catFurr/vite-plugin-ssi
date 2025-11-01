/**
 * File type to extension mappings for intelligent SSI processing
 */

export interface FileTypeMap {
  [key: string]: string[];
}

/**
 * Default file type mappings
 * Maps file type names to their associated extensions
 */
export const DEFAULT_FILE_TYPE_MAP: FileTypeMap = {
  html: ['.html', '.htm', '.shtml'],
  js: ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.mts', '.cts'],
  css: ['.css', '.scss', '.sass', '.less', '.styl'],
  json: ['.json', '.jsonc'],
  xml: ['.xml', '.xhtml'],
  text: ['.txt', '.md', '.markdown'],
};

/**
 * Checks if a file path matches any of the specified file types
 */
export function matchesFileType(
  filePath: string,
  fileTypes: string[],
  fileTypeMap: FileTypeMap
): boolean {
  const ext = getFileExtension(filePath);
  if (!ext) return false;

  for (const fileType of fileTypes) {
    const extensions = fileTypeMap[fileType.toLowerCase()] || [];
    if (extensions.includes(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a file path matches HTML file extensions (for top-level processing)
 */
export function isHtmlFile(filePath: string): boolean {
  const htmlExtensions = DEFAULT_FILE_TYPE_MAP.html;
  const ext = getFileExtension(filePath);
  return ext ? htmlExtensions.includes(ext) : false;
}

/**
 * Gets the file extension from a path (including the dot)
 */
function getFileExtension(filePath: string): string | null {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return null;
  const ext = filePath.substring(lastDot);
  return ext && ext.length > 1 ? ext.toLowerCase() : null;
}

