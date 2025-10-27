import { expect, test } from 'bun:test';
import vitePluginSsi from '../src/index';

test('vitePluginSsi plugin creation', () => {
  const plugin = vitePluginSsi();
  expect(plugin.name).toBe('vite-plugin-ssi');
});

test('plugin handles custom include extensions', () => {
  const plugin = vitePluginSsi({ include: ['.shtml'] });
  // @ts-ignore
  const result = plugin.transform('some content', 'test.shtml');
  expect(result).not.toBeNull();
});
