import { defineConfig } from 'vite';
import vitePluginSsi from '../../../src/index';

export default defineConfig({
  root: __dirname,
  plugins: [vitePluginSsi()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 0,
  },
  preview: {
    port: 0,
  },
});
