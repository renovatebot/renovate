import { defineConfig } from 'tsdown';

const entry = [
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
];

const common = {
  entry,
  unbundle: true,
  dts: true,
  sourcemap: true,
  platform: 'node' as const,
  fixedExtension: false,
  checks: { legacyCjs: false },
  external: /^(?![./]|lib\/)/,
};

export default defineConfig([
  {
    ...common,
    format: 'cjs',
    outDir: 'dist/cjs',
  },
  {
    ...common,
    format: 'esm',
    outDir: 'dist/esm',
  },
]);
