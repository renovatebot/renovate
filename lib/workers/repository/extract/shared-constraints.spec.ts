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
  sharedConstraintsScope?: SharedConstraintsScope,
): PackageFile {
  return { packageFile: path, deps: [], sharedConstraintsScope };
}

function scope(
  constraints: SharedConstraintsScope['constraints'],
  directory = '',
  precedence = 0,
): SharedConstraintsScope {
  return { directory, precedence, constraints };
}

describe('workers/repository/extract/shared-constraints', () => {
  describe('collectSharedConstraints()', () => {
    it('ignores package files without shared constraints', () => {
      const packageFiles = {
        npm: [
          {
            ...packageFile('package.json'),
            extractedConstraints: { node: '20' },
          },
        ],
        tools: [packageFile('tools.toml', scope({}))],
      };

      expect(collectSharedConstraints(packageFiles)).toEqual([]);
    });

    it('merges the package files of a directory by precedence, shallower directories first', () => {
      const shared = { node: '20.11.0', pnpm: '10.16.1' };
      const packageFiles = {
        tools: [
          packageFile(
            'apps/web/tools.toml',
            scope({ pnpm: '9.15.0' }, 'apps/web'),
          ),
          packageFile('tools.local.toml', scope({ node: '22.0.0' }, '', 1)),
          packageFile('b.toml', scope({ rust: '1.80.0' })),
          packageFile('a.toml', scope({ rust: '1.79.0' })),
          packageFile('tools.toml', scope(shared)),
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

    it('lets the later path in byte order win between package files of the same precedence', () => {
      const packageFiles = {
        tools: [
          packageFile('conf.d/a.toml', scope({ node: '20.11.0' })),
          packageFile('conf.d/B.toml', scope({ node: '22.0.0' })),
        ],
      };

      expect(collectSharedConstraints(packageFiles)).toEqual([
        { manager: 'tools', directory: '', constraints: { node: '20.11.0' } },
      ]);
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
  });
});
