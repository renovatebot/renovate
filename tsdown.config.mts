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
  format: 'esm',
  outDir: 'dist',
  unbundle: true,
  dts: true,
  sourcemap: true,
  platform: 'node',
  fixedExtension: false,
  external: /^(?![./]|lib\/)/,
});
