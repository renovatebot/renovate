import * as _manager from '../../../modules/manager/index.ts';
import type {
  ManagerApi,
  PackageFile,
  SharedConstraintsScope,
} from '../../../modules/manager/types.ts';
import {
  collectSharedConstraints,
  getSharedConstraints,
} from './shared-constraints.ts';

vi.mock('../../../modules/manager/index.ts', () => ({ get: vi.fn() }));

const manager = vi.mocked(_manager);

/**
 * The scopes of a stub `tools` manager, which shares the constraints of its package files.
 */
const scopes = new Map<string, SharedConstraintsScope>([
  ['tools.toml', { directory: '', precedence: 0 }],
  ['tools.local.toml', { directory: '', precedence: 1 }],
  ['apps/web/tools.toml', { directory: 'apps/web', precedence: 0 }],
  ['apps/api/tools.toml', { directory: 'apps/api', precedence: 0 }],
  ['b.toml', { directory: '', precedence: 0 }],
  ['a.toml', { directory: '', precedence: 0 }],
]);

function getSharedConstraintsScope(
  packageFile: string,
): SharedConstraintsScope | null {
  return scopes.get(packageFile) ?? null;
}

function packageFile(
  path: string,
  extractedConstraints?: PackageFile['extractedConstraints'],
): PackageFile {
  return { packageFile: path, deps: [], extractedConstraints };
}

describe('workers/repository/extract/shared-constraints', () => {
  beforeEach(() => {
    manager.get.mockImplementation((name: string, key: keyof ManagerApi) =>
      name === 'tools' && key === 'getSharedConstraintsScope'
        ? getSharedConstraintsScope
        : undefined,
    );
  });

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
          packageFile('tools.toml'),
        ],
      };

      expect(collectSharedConstraints(packageFiles)).toEqual([]);
    });

    it('merges the package files of a directory by precedence, shallower directories first', () => {
      const shared = { node: '20.11.0', pnpm: '10.16.1' };
      const packageFiles = {
        tools: [
          packageFile('apps/web/tools.toml', { pnpm: '9.15.0' }),
          packageFile('tools.local.toml', { node: '22.0.0' }),
          packageFile('b.toml', { rust: '1.80.0' }),
          packageFile('a.toml', { rust: '1.79.0' }),
          packageFile('tools.toml', shared),
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
