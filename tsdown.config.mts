import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'lib/renovate.ts',
    'lib/config-validator.ts',
    'lib/config/global.ts',
    'lib/modules/platform/index.ts',
    'lib/modules/datasource/index.ts',
    'lib/modules/datasource/common.ts',
    'lib/modules/versioning/index.ts',
    'lib/modules/versioning/generic.ts',
    'lib/modules/versioning/ubuntu/index.ts',
    'lib/util/host-rules.ts',
    'lib/util/string-match.ts',
  ],
  format: 'cjs',
  outDir: 'dist',
  unbundle: true,
  dts: true,
  sourcemap: true,
  platform: 'node',
  fixedExtension: false,
  checks: { legacyCjs: false },
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
