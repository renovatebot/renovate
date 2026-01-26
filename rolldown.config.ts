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
  // Function instead of regex: rolldown tests regex against both unresolved ID
  // and resolved path (which has different format like `@oxc-project+runtime@0.110.0/...`).
  // Functions only receive unresolved ID, making them reliable for @oxc-project/runtime.
  // TODO: simplify to regex `/^(?![./]|lib\/)/` once decorators are removed from codebase.
  external: (id) =>
    !id.startsWith('.') &&
    !id.startsWith('/') &&
    !id.startsWith('lib/') &&
    !id.startsWith('@oxc-project/runtime'),
});
