import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { collectPackageJson, processDenoCompatiblePackageJson } from './compat';

vi.mock('../../../util/fs');
// used in detectNodeCompatWorkspaces()
vi.mock('find-packages', () => ({
  findPackages: vi.fn(),
}));

describe('modules/manager/deno/compat', () => {
  describe('processDenoCompatiblePackageJson()', () => {
    it('invalid package.json', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce('invalid');
      const result = await processDenoCompatiblePackageJson('package.json');
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
      const result = await processDenoCompatiblePackageJson('package.json');
      expect(result).toBeNull();
    });
  });

  describe('collectPackageJson()', () => {
    it('node-compat package.json', async () => {
      GlobalConfig.set({ localDir: '' });
      const { findPackages } = await import('find-packages');
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
  });
});
