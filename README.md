# Vite SSI Plugin

A fully Apache/Nginx compatible Server-Side Includes (SSI) plugin for Vite.

## Features

- 🌐 Apache/Nginx SSI compatibility
- 🚀 Vite integration
- 🔧 Customizable include processing

## Installation

\`\`\`bash
bun add vite-plugin-ssi
# or
npm install vite-plugin-ssi
\`\`\`

## Usage

\`\`\`typescript
import { defineConfig } from 'vite';
import vitePluginSsi from 'vite-plugin-ssi';

export default defineConfig({
  plugins: [
    vitePluginSsi({
      include: ['.html', '.shtml'],
    })
  ]
});
\`\`\`

## License

MIT
