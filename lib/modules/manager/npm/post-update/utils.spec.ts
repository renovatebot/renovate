import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { getInheritedPackageManagerVersion } from './utils.ts';

vi.mock('../../../../util/fs/index.ts');

describe('modules/manager/npm/post-update/utils', () => {
  describe('getInheritedPackageManagerVersion', () => {
    it('walks up to the repo root and returns packageManager version', async () => {
      fs.readLocalFile.mockImplementation(
        (fileName: string): Promise<string | null> => {
          if (fileName === 'package.json') {
            return Promise.resolve(
              codeBlock`
              {
                "name": "monorepo-root",
                "packageManager": "pnpm@10.33.4"
              }
            `,
            );
          }
          return Promise.resolve(null);
        },
      );

      const version = await getInheritedPackageManagerVersion(
        'pnpm',
        'frontend',
      );
      expect(version).toBe('10.33.4');
    });

    it('walks past intermediate directories without packageManager', async () => {
      fs.readLocalFile.mockImplementation(
        (fileName: string): Promise<string | null> => {
          if (fileName === 'package.json') {
            return Promise.resolve(
              codeBlock`
              {
                "name": "monorepo-root",
                "packageManager": "pnpm@10.33.4"
              }
            `,
            );
          }
          // Intermediate package.json files exist but have no packageManager.
          if (
            fileName === 'infra/lambdas/package.json' ||
            fileName === 'infra/package.json'
          ) {
            return Promise.resolve('{}');
          }
          return Promise.resolve(null);
        },
      );

      const version = await getInheritedPackageManagerVersion(
        'pnpm',
        'infra/lambdas/statuspage-automation',
      );
      expect(version).toBe('10.33.4');
    });

    it('returns the closest ancestor when multiple ancestors define packageManager', async () => {
      fs.readLocalFile.mockImplementation(
        (fileName: string): Promise<string | null> => {
          if (fileName === 'package.json') {
            return Promise.resolve(
              codeBlock`
              { "packageManager": "pnpm@9.0.0" }
            `,
            );
          }
          if (fileName === 'group/package.json') {
            return Promise.resolve(
              codeBlock`
              { "packageManager": "pnpm@10.33.4" }
            `,
            );
          }
          return Promise.resolve(null);
        },
      );

      const version = await getInheritedPackageManagerVersion(
        'pnpm',
        'group/workspace',
      );
      expect(version).toBe('10.33.4');
    });

    it('returns null when no ancestor pins packageManager', async () => {
      fs.readLocalFile.mockResolvedValue(null);

      const version = await getInheritedPackageManagerVersion(
        'pnpm',
        'frontend',
      );
      expect(version).toBeNull();
    });

    it('returns null when lockFileDir is the repo root', async () => {
      const version = await getInheritedPackageManagerVersion('pnpm', '.');
      expect(version).toBeNull();
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it('returns null when lockFileDir is empty', async () => {
      const version = await getInheritedPackageManagerVersion('pnpm', '');
      expect(version).toBeNull();
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it('also reads engines fields from ancestor package.json', async () => {
      fs.readLocalFile.mockImplementation(
        (fileName: string): Promise<string | null> => {
          if (fileName === 'package.json') {
            return Promise.resolve(
              codeBlock`
              {
                "engines": { "pnpm": "=8.10.0" }
              }
            `,
            );
          }
          return Promise.resolve(null);
        },
      );

      const version = await getInheritedPackageManagerVersion(
        'pnpm',
        'frontend',
      );
      expect(version).toBe('=8.10.0');
    });

    it('ignores ancestor packageManager pinning a different manager', async () => {
      fs.readLocalFile.mockImplementation(
        (fileName: string): Promise<string | null> => {
          if (fileName === 'package.json') {
            return Promise.resolve(
              codeBlock`
              { "packageManager": "yarn@4.0.0" }
            `,
            );
          }
          return Promise.resolve(null);
        },
      );

      const version = await getInheritedPackageManagerVersion(
        'pnpm',
        'frontend',
      );
      expect(version).toBeNull();
    });
  });
});
