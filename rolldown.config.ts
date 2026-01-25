import { defineConfig } from 'rolldown';

export default defineConfig({
  input: ['lib/renovate.ts', 'lib/config-validator.ts'],
  output: {
    dir: 'dist',
    format: 'cjs',
    entryFileNames: '[name].cjs',
    chunkFileNames: '[name].cjs',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'lib',
  },
  moduleTypes: {
    '.cjs': 'js',
  },
  platform: 'node',
  external: (id) =>
    !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('lib/'),
});
