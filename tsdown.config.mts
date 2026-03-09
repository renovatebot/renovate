import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsdown';

const __dirname = dirname(fileURLToPath(import.meta.url));

const browserLoggerPath = resolve(__dirname, 'lib/logger/browser.ts');
const browserExposePath = resolve(__dirname, 'lib/expose.browser.ts');

export default defineConfig([
  {
    entry: [
      'lib/config-validator.ts',
      'lib/config/defaults.ts',
      'lib/config/global.ts',
      'lib/config/options/index.ts',
      'lib/config/types.ts',
      'lib/config/utils.ts',
      'lib/constants/error-messages.ts',
      'lib/instrumentation/types.ts',
      'lib/logger/err-serializer.ts',
      'lib/logger/index.ts',
      'lib/logger/renovate-logger.ts',
      'lib/logger/types.ts',
      'lib/modules/datasource/common.ts',
      'lib/modules/datasource/index.ts',
      'lib/modules/datasource/npm/types.ts',
      'lib/modules/datasource/types.ts',
      'lib/modules/manager/index.ts',
      'lib/modules/manager/types.ts',
      'lib/modules/platform/bitbucket-server/index.ts',
      'lib/modules/platform/bitbucket/index.ts',
      'lib/modules/platform/gitlab/index.ts',
      'lib/modules/platform/index.ts',
      'lib/modules/platform/types.ts',
      'lib/modules/versioning/generic.ts',
      'lib/modules/versioning/index.ts',
      'lib/modules/versioning/ubuntu/index.ts',
      'lib/proxy.ts',
      'lib/renovate.ts',
      'lib/types/index.ts',
      'lib/util/cache/package/backend.ts',
      'lib/util/cache/package/index.ts',
      'lib/util/cache/repository/types.ts',
      'lib/util/compress.ts',
      'lib/util/exec/common.ts',
      'lib/util/exec/exec-error.ts',
      'lib/util/exec/types.ts',
      'lib/util/git/index.ts',
      'lib/util/host-rules.ts',
      'lib/util/http/github.ts',
      'lib/util/http/gitlab.ts',
      'lib/util/http/types.ts',
      'lib/util/s3.ts',
      'lib/util/string-match.ts',
      'lib/util/timestamp.ts',
      'lib/util/url.ts',
      'lib/workers/global/autodiscover.ts',
      'lib/workers/global/config/parse/index.ts',
      'lib/workers/repository/result.ts',
      'lib/workers/types.ts',
    ],
    format: 'esm',
    outDir: 'dist',
    unbundle: true,
    dts: true,
    sourcemap: true,
    platform: 'node',
    fixedExtension: false,
    external: /^(?![./]|lib\/)/,
  },
  {
    entry: ['lib/modules/manager/custom/regex/index.ts'],
    format: 'esm',
    outDir: 'dist/browser',
    dts: true,
    sourcemap: true,
    platform: 'browser',
    plugins: [
      {
        name: 'browser-logger-alias',
        resolveId(source: string, importerPath: string | undefined) {
          if (
            importerPath !== undefined &&
            source.endsWith('/logger/index.ts')
          ) {
            return { id: browserLoggerPath, external: false };
          }
          if (importerPath !== undefined && source.endsWith('/expose.ts')) {
            return { id: browserExposePath, external: false };
          }
          return undefined;
        },
      },
    ],
  },
]);
