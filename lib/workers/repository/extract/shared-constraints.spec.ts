import * as _manager from '../../../modules/manager/index.ts';
import type {
  ManagerApi,
  PackageFile,
  SharedConstraintsScope,
} from '../../../modules/manager/types.ts';
import { applySharedConstraints } from './shared-constraints.ts';

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

  describe('applySharedConstraints()', () => {
    it('handles missing package files', () => {
      expect(() => applySharedConstraints(undefined)).not.toThrow();
    });

    it('leaves package files alone without managers sharing constraints', () => {
      const packageFiles = {
        npm: [packageFile('package.json', { node: '20' })],
        pep621: [packageFile('pyproject.toml')],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles).toEqual({
        npm: [packageFile('package.json', { node: '20' })],
        pep621: [packageFile('pyproject.toml')],
      });
    });

    it('adds the shared constraints to package files in the same directory and below', () => {
      const packageFiles = {
        tools: [
          packageFile('tools.toml', { node: '20.11.0', pnpm: '10.16.1' }),
        ],
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
      const shared = { node: '20.11.0', pnpm: '10.16.1' };
      const packageFiles = {
        tools: [packageFile('tools.toml', shared)],
        npm: [packageFile('package.json', own)],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles.npm[0].extractedConstraints).toEqual({
        node: '20.11.0',
        pnpm: '9.15.0',
      });
      expect(own).toEqual({ pnpm: '9.15.0' });
      expect(shared).toEqual({ node: '20.11.0', pnpm: '10.16.1' });
    });

    it('ignores package files outside of the directory', () => {
      const packageFiles = {
        tools: [packageFile('apps/api/tools.toml', { node: '20.11.0' })],
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

    it('ignores package files without a scope or constraints', () => {
      const packageFiles = {
        tools: [
          packageFile('tools.production.toml', { node: '22.0.0' }),
          packageFile('tools.toml'),
        ],
        npm: [packageFile('package.json')],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles.npm).toEqual([packageFile('package.json')]);
    });

    it('prefers the nearest directory', () => {
      const packageFiles = {
        tools: [
          packageFile('apps/web/tools.toml', { pnpm: '10.16.1' }),
          packageFile('tools.toml', { node: '20.11.0', pnpm: '9.15.0' }),
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

    it('follows the precedence within a directory', () => {
      const packageFiles = {
        tools: [
          packageFile('tools.local.toml', { node: '22.0.0' }),
          packageFile('tools.toml', { node: '20.11.0', pnpm: '10.16.1' }),
        ],
        npm: [packageFile('package.json')],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles.npm[0].extractedConstraints).toEqual({
        node: '22.0.0',
        pnpm: '10.16.1',
      });
    });

    it('orders package files of the same directory and precedence by path', () => {
      scopes.set('b.toml', { directory: '', precedence: 0 });
      scopes.set('a.toml', { directory: '', precedence: 0 });
      const packageFiles = {
        tools: [
          packageFile('b.toml', { rust: '1.80.0' }),
          packageFile('a.toml', { rust: '1.79.0' }),
        ],
        npm: [packageFile('package.json')],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles.npm[0].extractedConstraints).toEqual({
        rust: '1.80.0',
      });
    });

    it('does not share constraints between package files of the same manager', () => {
      const packageFiles = {
        tools: [
          packageFile('tools.toml', { node: '20.11.0' }),
          packageFile('apps/web/tools.toml'),
        ],
      };

      applySharedConstraints(packageFiles);

      expect(packageFiles.tools).toEqual([
        packageFile('tools.toml', { node: '20.11.0' }),
        packageFile('apps/web/tools.toml'),
      ]);
    });
  });
});
