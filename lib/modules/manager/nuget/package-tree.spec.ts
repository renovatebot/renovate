import { fs as memfs } from 'memfs';
import upath from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { scm } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { getDependentPackageFiles } from './package-tree';

jest.mock('fs', () => memfs);
jest.mock('fs-extra', () =>
  jest
    .requireActual<typeof import('../../../../test/fixtures')>(
      '../../../../test/fixtures',
    )
    .fsExtra(),
);
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

    it('returns self for single project', async () => {
      scm.getFileList.mockResolvedValue(['single.csproj']);
      Fixtures.mock({
        '/tmp/repo/single.csproj': Fixtures.get(
          'single-project-file/single.csproj',
        ),
      });

      expect(await getDependentPackageFiles('single.csproj')).toEqual([
        { isLeaf: true, name: 'single.csproj' },
      ]);
    });

    it('returns self for two projects with no references', async () => {
      scm.getFileList.mockResolvedValue(['one.csproj', 'two.csproj']);
      Fixtures.mock({
        '/tmp/repo/one.csproj': Fixtures.get('two-no-reference/one.csproj'),
        '/tmp/repo/two.csproj': Fixtures.get('two-no-reference/two.csproj'),
      });

      expect(await getDependentPackageFiles('one.csproj')).toEqual([
        { isLeaf: true, name: 'one.csproj' },
      ]);
      expect(await getDependentPackageFiles('two.csproj')).toEqual([
        { isLeaf: true, name: 'two.csproj' },
      ]);
    });

    it('returns projects for two projects with one reference', async () => {
      scm.getFileList.mockResolvedValue(['one/one.csproj', 'two/two.csproj']);
      Fixtures.mock({
        '/tmp/repo/one/one.csproj': Fixtures.get(
          'two-one-reference/one/one.csproj',
        ),
        '/tmp/repo/two/two.csproj': Fixtures.get(
          'two-one-reference/two/two.csproj',
        ),
      });

      expect(await getDependentPackageFiles('one/one.csproj')).toEqual([
        { isLeaf: false, name: 'one/one.csproj' },
        { isLeaf: true, name: 'two/two.csproj' },
      ]);
    });

    it('returns project for two projects with one reference and central versions', async () => {
      scm.getFileList.mockResolvedValue(['one/one.csproj', 'two/two.csproj']);
      Fixtures.mock({
        '/tmp/repo/one/one.csproj': Fixtures.get(
          'two-one-reference-with-central-versions/one/one.csproj',
        ),
        '/tmp/repo/two/two.csproj': Fixtures.get(
          'two-one-reference-with-central-versions/two/two.csproj',
        ),
        '/tmp/repo/Directory.Packages.props': Fixtures.get(
          'two-one-reference-with-central-versions/Directory.Packages.props',
        ),
      });

      expect(
        await getDependentPackageFiles('Directory.Packages.props', true),
      ).toEqual([
        { isLeaf: false, name: 'one/one.csproj' },
        { isLeaf: true, name: 'two/two.csproj' },
      ]);
    });

    it('returns projects for three projects with two linear references', async () => {
      scm.getFileList.mockResolvedValue([
        'one/one.csproj',
        'two/two.csproj',
        'three/three.csproj',
      ]);
      Fixtures.mock({
        '/tmp/repo/one/one.csproj': Fixtures.get(
          'three-two-linear-references/one/one.csproj',
        ),
        '/tmp/repo/two/two.csproj': Fixtures.get(
          'three-two-linear-references/two/two.csproj',
        ),
        '/tmp/repo/three/three.csproj': Fixtures.get(
          'three-two-linear-references/three/three.csproj',
        ),
      });

      expect(await getDependentPackageFiles('one/one.csproj')).toEqual([
        { isLeaf: false, name: 'one/one.csproj' },
        { isLeaf: false, name: 'two/two.csproj' },
        { isLeaf: true, name: 'three/three.csproj' },
      ]);

      expect(await getDependentPackageFiles('two/two.csproj')).toEqual([
        { isLeaf: false, name: 'two/two.csproj' },
        { isLeaf: true, name: 'three/three.csproj' },
      ]);

      expect(await getDependentPackageFiles('three/three.csproj')).toEqual([
        { isLeaf: true, name: 'three/three.csproj' },
      ]);
    });

    it('returns projects for three projects with two tree-like references', async () => {
      scm.getFileList.mockResolvedValue([
        'one/one.csproj',
        'two/two.csproj',
        'three/three.csproj',
      ]);
      Fixtures.mock({
        '/tmp/repo/one/one.csproj': Fixtures.get(
          'three-two-treelike-references/one/one.csproj',
        ),
        '/tmp/repo/two/two.csproj': Fixtures.get(
          'three-two-treelike-references/two/two.csproj',
        ),
        '/tmp/repo/three/three.csproj': Fixtures.get(
          'three-two-treelike-references/three/three.csproj',
        ),
      });

      expect(await getDependentPackageFiles('one/one.csproj')).toEqual([
        { isLeaf: false, name: 'one/one.csproj' },
        { isLeaf: true, name: 'two/two.csproj' },
        { isLeaf: true, name: 'three/three.csproj' },
      ]);

      expect(await getDependentPackageFiles('two/two.csproj')).toEqual([
        { isLeaf: true, name: 'two/two.csproj' },
      ]);
      expect(await getDependentPackageFiles('three/three.csproj')).toEqual([
        { isLeaf: true, name: 'three/three.csproj' },
      ]);
    });

    it('throws error on circular reference', async () => {
      scm.getFileList.mockResolvedValue(['one/one.csproj', 'two/two.csproj']);
      Fixtures.mock({
        '/tmp/repo/one/one.csproj': Fixtures.get(
          'circular-reference/one/one.csproj',
        ),
        '/tmp/repo/two/two.csproj': Fixtures.get(
          'circular-reference/two/two.csproj',
        ),
      });

      await expect(getDependentPackageFiles('one/one.csproj')).rejects.toThrow(
        'Circular reference detected in NuGet package files',
      );
    });

    it('skips on invalid xml file', async () => {
      scm.getFileList.mockResolvedValue(['foo/bar.csproj']);
      Fixtures.mock({ '/tmp/repo/foo/bar.csproj': '<invalid' });
      expect(await getDependentPackageFiles('foo/bar.csproj')).toEqual([
        { isLeaf: true, name: 'foo/bar.csproj' },
      ]);
    });
  });
});
