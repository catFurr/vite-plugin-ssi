# Vite SSI Plugin

A fully Apache/Nginx compatible Server-Side Includes (SSI) plugin for Vite. This plugin processes SSI directives in your HTML files during development, build, and preview modes, enabling server-side includes without needing a traditional web server.

## Features

- 🌐 **SSI Directive Support** - Process Server-Side Includes in your Vite projects
- 🚀 **Full Vite Integration** - Works seamlessly in dev, build, and preview modes
- 🔧 **Configurable File Types** - Intelligently process different file types with SSI
- 🔄 **Hot Module Replacement (HMR)** - Automatic reloading when SSI dependencies change
- 📦 **Zero Configuration** - Works out of the box with sensible defaults
- 🛡️ **Safe by Default** - Circular dependency detection and depth limiting

## Installation

```bash
bun add @catfyrr/vite-plugin-ssi
# or
npm install @catfyrr/vite-plugin-ssi
# or
npx jsr install @catfyrr/vite-plugin-ssi
```

## Quick Start

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import vitePluginSsi from '@catfyrr/vite-plugin-ssi';

export default defineConfig({
  plugins: [
    vitePluginSsi(),
  ],
});
```

Now you can use SSI directives in your HTML files:

```html
<!DOCTYPE html>
<html>
<head>
  <!--#include virtual="/common/head.html" -->
</head>
<body>
  <!--#include virtual="/components/header.html" -->
  <main>
    <h1>Welcome</h1>
  </main>
  <!--#include virtual="/components/footer.html" -->
</body>
</html>
```

## Configuration Options

### `maxDepth`

Maximum depth for recursive includes.

- **Type:** `number`
- **Default:** `10`
- **Description:** Prevents infinite recursion and circular dependencies

```typescript
vitePluginSsi({
  maxDepth: 15, // Allow deeper nesting
})
```

### `enforce`

When to run this plugin in the Vite pipeline.

- **Type:** `'pre' | 'post'`
- **Default:** `'pre'`
- **Description:** Controls the execution order relative to other plugins

```typescript
vitePluginSsi({
  enforce: 'pre', // Run before other plugins
})
```

### `apply`

Apply plugin only in specific environments.

- **Type:** `'serve' | 'build' | 'preview' | { serve?: boolean; build?: boolean; preview?: boolean }`
- **Default:** `undefined` (applies to all environments)
- **Description:** Control which Vite commands should process SSI

```typescript
// Apply only in dev server
vitePluginSsi({
  apply: 'serve',
})

// Apply only in build
vitePluginSsi({
  apply: 'build',
})

// Apply to specific environments using object form
vitePluginSsi({
  apply: {
    serve: true,
    build: true,
    preview: false,
  },
})
```

### `includeFileTypes`

File types to apply SSI processing to for included files (at any depth).

- **Type:** `string[]`
- **Default:** `[]` (only process top-level HTML files)
- **Description:** When files are included via SSI, they will also be processed if they match these types. SSI always applies to top-level HTML files regardless of this setting.

```typescript
// Process JS/TS files when included
vitePluginSsi({
  includeFileTypes: ['js', 'html'], // Processes .js, .mjs, .ts, .tsx, .jsx, etc.
})
```

The plugin intelligently maps file types to extensions:
- `'js'` → `.js`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.jsx`, `.mts`, `.cts`
- `'html'` → `.html`, `.htm`, `.shtml`
- `'css'` → `.css`, `.scss`, `.sass`, `.less`, `.styl`
- `'json'` → `.json`, `.jsonc`
- `'xml'` → `.xml`, `.xhtml`
- `'text'` → `.txt`, `.md`, `.markdown`

### `fileTypeMap`

Custom file type to extension mappings.

- **Type:** `FileTypeMap`
- **Default:** See [file-types.ts](./src/file-types.ts) for defaults
- **Description:** Override or extend the default file type mappings

```typescript
import type { FileTypeMap } from '@catfyrr/vite-plugin-ssi';

const customFileTypes: FileTypeMap = {
  html: ['.html', '.htm', '.shtml'],
  js: ['.js', '.mjs', '.ts', '.jsx', '.tsx'],
  // Add custom types
  vue: ['.vue'],
  svelte: ['.svelte'],
};

vitePluginSsi({
  includeFileTypes: ['js', 'vue'],
  fileTypeMap: customFileTypes,
})
```

## Usage Examples

### Basic Include

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>My Site</title>
</head>
<body>
  <!--#include virtual="/header.html" -->
  <main>Content</main>
  <!--#include virtual="/footer.html" -->
</body>
</html>
```

### Absolute and Relative Paths

```html
<!-- Absolute paths from project root -->
<!--#include virtual="/components/nav.html" -->

<!-- Relative paths from current file -->
<!--#include virtual="../common/sidebar.html" -->
```

### Processing Non-HTML Files

When you want SSI to process included JavaScript/TypeScript files:

```typescript
vitePluginSsi({
  includeFileTypes: ['js', 'html'],
})
```

```html
<!-- index.html -->
<!--#include virtual="/scripts/utils.ts" -->
```

The included `.ts` file will also be processed for SSI directives if it contains them.

### Environment-Specific Configuration

```typescript
import { defineConfig } from 'vite';
import vitePluginSsi from '@catfyrr/vite-plugin-ssi';

export default defineConfig({
  plugins: [
    vitePluginSsi({
      // Only process SSI during build (for static site generation)
      apply: 'build',
      includeFileTypes: ['html'],
      maxDepth: 5,
    }),
  ],
})
```

## How It Works

1. **Development Mode (`vite dev`)**: SSI directives are processed on-the-fly when HTML files are served. Changes to included files trigger HMR automatically.

2. **Build Mode (`vite build`)**: SSI directives are processed during the build phase, and the final HTML output contains the resolved includes.

3. **Preview Mode (`vite preview`)**: SSI directives are processed when serving the built files, allowing you to test the built output with SSI processing.

## Error Handling

The plugin provides clear error messages for common issues:

- **Circular Dependencies**: Detected and reported with the dependency chain
- **Missing Files**: Included files that don't exist show an error comment
- **Max Depth Exceeded**: Recursion limits are enforced and reported

```html
<!-- If header.html doesn't exist -->
<!-- SSI Error: File not found: /path/to/header.html -->

<!-- If circular dependency detected -->
<!-- SSI Error: Circular include detected: file-a.html -> file-b.html -> file-a.html -->
```

## Compatibility

This plugin currently supports:

✅ **Implemented:**
- `<!--#include virtual="..." -->` - File inclusion with absolute and relative paths
- Recursive includes with depth limiting
- Circular dependency detection
- HMR for included file changes
- Configurable file type processing

📋 **Roadmap:** See [COMPATIBILITY.md](./COMPATIBILITY.md) for full compatibility tracking with Apache and Nginx SSI modules.

## TypeScript Support

The plugin includes full TypeScript definitions:

```typescript
import vitePluginSsi, { type VitePluginSsiOptions, type FileTypeMap } from '@catfyrr/vite-plugin-ssi';
```

## Troubleshooting

### SSI directives not being processed

1. Ensure your HTML file has the correct extension (`.html`, `.htm`, `.shtml`)
2. Check that the plugin is added to your `vite.config.ts`
3. Verify file paths are correct (use absolute paths from project root or relative paths)

### HMR not working for included files

- Make sure you're using the dev server (`vite dev`)
- Check that the included file is being tracked as a dependency
- Verify the included file path matches exactly (case-sensitive on some systems)

### Circular dependency errors

- Review your include structure to identify the cycle
- Consider using a shared partial file instead of circular includes
- Adjust `maxDepth` if needed, but beware of infinite loops

## Security Considerations

- The plugin only processes SSI directives, it does not execute shell commands or arbitrary code
- File access is limited to the project directory
- Circular dependencies are detected and prevented
- Maximum include depth limits prevent excessive recursion

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT

## References

- [Apache SSI Documentation](https://httpd.apache.org/docs/current/howto/ssi.html)
- [Nginx SSI Module Documentation](https://nginx.org/en/docs/http/ngx_http_ssi_module.html)
- [Apache mod_include Documentation](https://httpd.apache.org/docs/current/mod/mod_include.html)
