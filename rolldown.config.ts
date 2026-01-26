import { defineConfig } from 'rolldown';

export default defineConfig({
  input: ['lib/renovate.ts', 'lib/config-validator.ts'],
  output: {
    dir: 'dist',
    format: 'cjs',
    entryFileNames: '[name].js',
    chunkFileNames: '[name].js',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'lib',
  },
  moduleTypes: {
    '.js': 'js',
  },
  platform: 'node',
  external: (id) =>
    !id.startsWith('.') &&
    !id.startsWith('/') &&
    !id.startsWith('lib/') &&
    !id.startsWith('@oxc-project/runtime'),
});
