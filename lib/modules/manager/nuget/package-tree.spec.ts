import { fs as memfs } from 'memfs';
import upath from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { git } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { getDependentPackageFiles } from './package-tree';

jest.mock('fs', () => memfs);
jest.mock('fs-extra', () => Fixtures.fsExtra());
jest.mock('../../../util/git');

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('/tmp/repo'),
};

describe('manager/nuget/package-tree', () => {
  describe('getDependentPackageFiles()', () => {
    beforeEach(() => {
      GlobalConfig.set(adminConfig);
      Fixtures.reset();
    });

    afterEach(() => {
      GlobalConfig.reset();
      Fixtures.reset();
    });

    it('returns empty list for single project', async () => {
      git.getFileList.mockResolvedValue(['single.csproj']);
      Fixtures.mock({
        '/tmp/repo/single.csproj': Fixtures.get(
          'single-project-file/single.csproj'
        ),
      });

      expect(await getDependentPackageFiles('single.csproj')).toBeEmpty();
    });

    it('returns empty list for two projects with no references', async () => {
      git.getFileList.mockResolvedValue(['one.csproj', 'two.csproj']);
      Fixtures.mock({
        '/tmp/repo/one.csproj': Fixtures.get('two-no-reference/one.csproj'),
        '/tmp/repo/two.csproj': Fixtures.get('two-no-reference/two.csproj'),
      });

      expect(await getDependentPackageFiles('one.csproj')).toBeEmpty();
    });

    it('returns project for two projects with one reference', async () => {
      git.getFileList.mockResolvedValue(['one/one.csproj', 'two/two.csproj']);
      Fixtures.mock({
        '/tmp/repo/one/one.csproj': Fixtures.get(
          'two-one-reference/one/one.csproj'
        ),
        '/tmp/repo/two/two.csproj': Fixtures.get(
          'two-one-reference/two/two.csproj'
        ),
      });

      expect(await getDependentPackageFiles('one/one.csproj')).toEqual([
        'two/two.csproj',
      ]);
    });

    it('throws error on circular reference', async () => {
      git.getFileList.mockResolvedValue(['one/one.csproj', 'two/two.csproj']);
      Fixtures.mock({
        '/tmp/repo/one/one.csproj': Fixtures.get(
          'circular-reference/one/one.csproj'
        ),
        '/tmp/repo/two/two.csproj': Fixtures.get(
          'circular-reference/two/two.csproj'
        ),
      });

      await expect(getDependentPackageFiles('one/one.csproj')).rejects.toThrow(
        'Circular reference detected in NuGet package files'
      );
    });
  });
});
