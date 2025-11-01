import { expect, test } from 'bun:test';
import vitePluginSsi from '../src/index';

test('vitePluginSsi plugin creation', () => {
  const plugin = vitePluginSsi();
  expect(plugin.name).toBe('vite-plugin-ssi');
});

test('plugin has transformIndexHtml hook', () => {
  const plugin = vitePluginSsi();
  expect(plugin.transformIndexHtml).toBeDefined();
  expect(typeof plugin.transformIndexHtml).toBe('function');
});
