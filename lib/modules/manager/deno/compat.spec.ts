import { findPackages } from 'find-packages';
import { fs } from '../../../../test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import {
  collectPackageJson,
  detectNodeCompatWorkspaces,
  extractDenoCompatiblePackageJson,
} from './compat.ts';

vi.mock('../../../util/fs');
// used in detectNodeCompatWorkspaces()
vi.mock('find-packages', () => ({
  findPackages: vi.fn(),
}));

describe('modules/manager/deno/compat', () => {
  describe('extractDenoCompatiblePackageJson()', () => {
    it('returns null if invalid package.json', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce('invalid');
      const result = await extractDenoCompatiblePackageJson('package.json');
      expect(result).toBeNull();
    });

    it('handles null response', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        // This package.json returns null from the extractor
        JSON.stringify({
          _id: 1,
          _args: 1,
          _from: 1,
        }),
      );
      const result = await extractDenoCompatiblePackageJson('package.json');
      expect(result).toBeNull();
    });
  });

  describe('detectNodeCompatWorkspaces()', () => {
    it('returns null if no packageFile', async () => {
      const result = await detectNodeCompatWorkspaces({
        packageFile: undefined,
      });
      expect(result).toBeNull();
    });
  });

  describe('collectPackageJson()', () => {
    it('node-compat package.json', async () => {
      GlobalConfig.set({ localDir: '' });
      vi.mocked(findPackages).mockResolvedValue([
        { dir: '.', manifest: {}, writeProjectManifest: Promise.resolve },
      ]);
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          dependencies: {
            dep1: '1.0.0',
          },
        }),
      );
      expect(await collectPackageJson('deno.lock')).toEqual([
        {
          deps: [
            {
              currentValue: '1.0.0',
              datasource: 'npm',
              depName: 'dep1',
              depType: 'dependencies',
              prettyDepType: 'dependency',
            },
          ],
          extractedConstraints: {},
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: undefined,
          },
          packageFile: 'package.json',
        },
      ]);
    });

    it('handles workspaces with valid workspace member', async () => {
      GlobalConfig.set({ localDir: '' });
      vi.mocked(findPackages).mockResolvedValue([
        {
          dir: 'packages/pkg1',
          manifest: {},
          writeProjectManifest: Promise.resolve,
        },
      ]);
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile
        .mockResolvedValueOnce(
          JSON.stringify({
            workspaces: ['packages/*'],
            dependencies: {
              dep1: '1.0.0',
            },
          }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            dependencies: {
              dep2: '2.0.0',
            },
          }),
        );
      expect(await collectPackageJson('deno.lock')).toEqual([
        {
          deps: [
            {
              currentValue: '1.0.0',
              datasource: 'npm',
              depName: 'dep1',
              depType: 'dependencies',
              prettyDepType: 'dependency',
            },
          ],
          extractedConstraints: {},
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['packages/*'],
          },
          packageFile: 'package.json',
        },
        {
          deps: [
            {
              currentValue: '2.0.0',
              datasource: 'npm',
              depName: 'dep2',
              depType: 'dependencies',
              prettyDepType: 'dependency',
            },
          ],
          extractedConstraints: {},
          lockFiles: ['deno.lock'],
          managerData: {
            packageName: undefined,
            workspaces: undefined,
          },
          packageFile: 'packages/pkg1/package.json',
        },
      ]);
    });

    it('returns empty array when rootPackageFile is null', async () => {
      GlobalConfig.set({ localDir: '' });
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(null);
      const result = await collectPackageJson('deno.lock');
      expect(result).toEqual([]);
    });

    it('handles null packageFile in workspace members', async () => {
      GlobalConfig.set({ localDir: '' });
      vi.mocked(findPackages).mockResolvedValue([
        {
          dir: 'workspace',
          manifest: {},
          writeProjectManifest: Promise.resolve,
        },
      ]);
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile
        .mockResolvedValueOnce(
          JSON.stringify({
            dependencies: {
              dep1: '1.0.0',
            },
          }),
        )
        .mockResolvedValueOnce(null);
      const result = await collectPackageJson('deno.lock');
      expect(result).toEqual([
        {
          deps: [
            {
              currentValue: '1.0.0',
              datasource: 'npm',
              depName: 'dep1',
              depType: 'dependencies',
              prettyDepType: 'dependency',
            },
          ],
          extractedConstraints: {},
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: undefined,
          },
          packageFile: 'package.json',
        },
      ]);
    });
  });
});
