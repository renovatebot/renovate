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

describe('modules/manager/nuget/package-tree', () => {
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

    it('returns two projects for three projects with two linear references', async () => {
      git.getFileList.mockResolvedValue([
        'one/one.csproj',
        'two/two.csproj',
        'three/three.csproj',
      ]);
      Fixtures.mock({
        '/tmp/repo/one/one.csproj': Fixtures.get(
          'three-two-linear-references/one/one.csproj'
        ),
        '/tmp/repo/two/two.csproj': Fixtures.get(
          'three-two-linear-references/two/two.csproj'
        ),
        '/tmp/repo/three/three.csproj': Fixtures.get(
          'three-two-linear-references/three/three.csproj'
        ),
      });

      expect(await getDependentPackageFiles('one/one.csproj')).toEqual([
        'two/two.csproj',
        'three/three.csproj',
      ]);

      expect(await getDependentPackageFiles('two/two.csproj')).toEqual([
        'three/three.csproj',
      ]);

      expect(await getDependentPackageFiles('three/three.csproj')).toEqual([]);
    });

    it('returns two projects for three projects with two tree-like references', async () => {
      git.getFileList.mockResolvedValue([
        'one/one.csproj',
        'two/two.csproj',
        'three/three.csproj',
      ]);
      Fixtures.mock({
        '/tmp/repo/one/one.csproj': Fixtures.get(
          'three-two-treelike-references/one/one.csproj'
        ),
        '/tmp/repo/two/two.csproj': Fixtures.get(
          'three-two-treelike-references/two/two.csproj'
        ),
        '/tmp/repo/three/three.csproj': Fixtures.get(
          'three-two-treelike-references/three/three.csproj'
        ),
      });

      expect(await getDependentPackageFiles('one/one.csproj')).toEqual([
        'two/two.csproj',
        'three/three.csproj',
      ]);

      expect(await getDependentPackageFiles('two/two.csproj')).toEqual([]);
      expect(await getDependentPackageFiles('three/three.csproj')).toEqual([]);
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
