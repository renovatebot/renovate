import type {
  PackageFile,
  SharedConstraintsScope,
} from '../../../modules/manager/types.ts';
import {
  collectSharedConstraints,
  getSharedConstraints,
} from './shared-constraints.ts';

function packageFile(
  path: string,
  extractedConstraints?: PackageFile['extractedConstraints'],
  sharedConstraintsScope?: SharedConstraintsScope,
): PackageFile {
  return {
    packageFile: path,
    deps: [],
    extractedConstraints,
    sharedConstraintsScope,
  };
}

const root = { directory: '', precedence: 0 };

describe('workers/repository/extract/shared-constraints', () => {
  describe('collectSharedConstraints()', () => {
    it('handles missing package files', () => {
      expect(collectSharedConstraints(undefined)).toEqual([]);
    });

    it('ignores managers without shared constraints', () => {
      const packageFiles = {
        npm: [packageFile('package.json', { node: '20' })],
      };

      expect(collectSharedConstraints(packageFiles)).toEqual([]);
    });

    it('ignores package files without a scope or constraints', () => {
      const packageFiles = {
        tools: [
          packageFile('tools.production.toml', { node: '22.0.0' }),
          packageFile('tools.toml', undefined, root),
        ],
      };

      expect(collectSharedConstraints(packageFiles)).toEqual([]);
    });

    it('merges the package files of a directory by precedence, shallower directories first', () => {
      const shared = { node: '20.11.0', pnpm: '10.16.1' };
      const web = { directory: 'apps/web', precedence: 0 };
      const local = { directory: '', precedence: 1 };
      const packageFiles = {
        tools: [
          packageFile('apps/web/tools.toml', { pnpm: '9.15.0' }, web),
          packageFile('tools.local.toml', { node: '22.0.0' }, local),
          packageFile('b.toml', { rust: '1.80.0' }, root),
          packageFile('a.toml', { rust: '1.79.0' }, root),
          packageFile('tools.toml', shared, root),
        ],
      };

      const res = collectSharedConstraints(packageFiles);

      expect(res).toEqual([
        {
          manager: 'tools',
          directory: '',
          constraints: { node: '22.0.0', pnpm: '10.16.1', rust: '1.80.0' },
        },
        {
          manager: 'tools',
          directory: 'apps/web',
          constraints: { pnpm: '9.15.0' },
        },
      ]);
      expect(shared).toEqual({ node: '20.11.0', pnpm: '10.16.1' });
    });
  });

  describe('getSharedConstraints()', () => {
    const sharedConstraints = [
      {
        manager: 'tools',
        directory: '',
        constraints: { node: '20.11.0', pnpm: '9.15.0' },
      },
      {
        manager: 'tools',
        directory: 'apps/web',
        constraints: { pnpm: '10.16.1' },
      },
    ];

    it.each`
      packageFile                       | expected
      ${'package.json'}                 | ${{ node: '20.11.0', pnpm: '9.15.0' }}
      ${'apps/web/package.json'}        | ${{ node: '20.11.0', pnpm: '10.16.1' }}
      ${'apps/web/nested/package.json'} | ${{ node: '20.11.0', pnpm: '10.16.1' }}
      ${'apps/web-client/package.json'} | ${{ node: '20.11.0', pnpm: '9.15.0' }}
      ${undefined}                      | ${{ node: '20.11.0', pnpm: '9.15.0' }}
    `('returns $expected for $packageFile', ({ packageFile, expected }) => {
      expect(
        getSharedConstraints(sharedConstraints, 'npm', packageFile),
      ).toEqual(expected);
    });

    it('ignores constraints outside of the directory', () => {
      expect(
        getSharedConstraints(
          [
            {
              manager: 'tools',
              directory: 'apps/api',
              constraints: { node: '20' },
            },
          ],
          'npm',
          'apps/web/package.json',
        ),
      ).toEqual({});
    });

    it('does not apply the constraints of a manager to its own package files', () => {
      expect(
        getSharedConstraints(sharedConstraints, 'tools', 'apps/web/tools.toml'),
      ).toEqual({});
    });

    it('handles missing shared constraints', () => {
      expect(getSharedConstraints(undefined, 'npm', 'package.json')).toEqual(
        {},
      );
    });
  });
});
