import type { PackageFile } from '../../../modules/manager/types.ts';
import { applySharedConstraints } from './shared-constraints.ts';

function packageFile(
  path: string,
  extractedConstraints?: PackageFile['extractedConstraints'],
): PackageFile {
  return { packageFile: path, deps: [], extractedConstraints };
}

describe('workers/repository/extract/shared-constraints', () => {
  describe('applySharedConstraints()', () => {
    it('handles missing package files', () => {
      expect(() => applySharedConstraints(undefined)).not.toThrow();
    });

    it('leaves package files alone without managers sharing constraints', () => {
      const npm = packageFile('package.json', { node: '20' });
      const packageFiles = {
        npm: [npm],
        pep621: [packageFile('pyproject.toml')],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles).toEqual({
        npm: [packageFile('package.json', { node: '20' })],
        pep621: [packageFile('pyproject.toml')],
      });
    });

    it('adds the mise constraints to package files in the same directory and below', () => {
      const packageFiles = {
        mise: [packageFile('mise.toml', { node: '20.11.0', pnpm: '10.16.1' })],
        npm: [
          packageFile('package.json'),
          packageFile('apps/web/package.json'),
        ],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles.npm).toEqual([
        packageFile('package.json', { node: '20.11.0', pnpm: '10.16.1' }),
        packageFile('apps/web/package.json', {
          node: '20.11.0',
          pnpm: '10.16.1',
        }),
      ]);
    });

    it('prefers the constraints the package file extracted itself', () => {
      const own = { pnpm: '9.15.0' };
      const packageFiles = {
        mise: [packageFile('mise.toml', { node: '20.11.0', pnpm: '10.16.1' })],
        npm: [packageFile('package.json', own)],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles.npm[0].extractedConstraints).toEqual({
        node: '20.11.0',
        pnpm: '9.15.0',
      });
      expect(own).toEqual({ pnpm: '9.15.0' });
    });

    it('ignores package files outside of the directory', () => {
      const packageFiles = {
        mise: [packageFile('apps/api/mise.toml', { node: '20.11.0' })],
        npm: [
          packageFile('apps/web/package.json'),
          packageFile('apps/api-client/package.json'),
          packageFile('package.json'),
        ],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles.npm).toEqual([
        packageFile('apps/web/package.json'),
        packageFile('apps/api-client/package.json'),
        packageFile('package.json'),
      ]);
    });

    it('prefers the nearest mise config file', () => {
      const packageFiles = {
        mise: [
          packageFile('apps/web/mise.toml', { pnpm: '10.16.1' }),
          packageFile('mise.toml', { node: '20.11.0', pnpm: '9.15.0' }),
        ],
        npm: [
          packageFile('apps/web/package.json'),
          packageFile('package.json'),
        ],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles.npm).toEqual([
        packageFile('apps/web/package.json', {
          node: '20.11.0',
          pnpm: '10.16.1',
        }),
        packageFile('package.json', { node: '20.11.0', pnpm: '9.15.0' }),
      ]);
    });

    it('follows the mise precedence within a directory', () => {
      const packageFiles = {
        mise: [
          packageFile('mise.local.toml', { node: '22.0.0' }),
          packageFile('.config/mise/conf.d/b.toml', { rust: '1.80.0' }),
          packageFile('.config/mise/conf.d/a.toml', { rust: '1.79.0' }),
          packageFile('mise.toml', { node: '20.11.0', pnpm: '10.16.1' }),
          packageFile('.config/mise.toml', {
            pnpm: '9.15.0',
            python: '3.12.4',
          }),
          packageFile('mise.production.toml', { python: '3.13.0' }),
        ],
        npm: [packageFile('package.json')],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles.npm[0].extractedConstraints).toEqual({
        node: '22.0.0',
        pnpm: '10.16.1',
        python: '3.12.4',
        rust: '1.80.0',
      });
    });

    it('does not share constraints between package files of the same manager', () => {
      const packageFiles = {
        mise: [
          packageFile('mise.toml', { node: '20.11.0' }),
          packageFile('apps/web/mise.toml'),
        ],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles.mise).toEqual([
        packageFile('mise.toml', { node: '20.11.0' }),
        packageFile('apps/web/mise.toml'),
      ]);
    });
  });
});
