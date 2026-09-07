import upath from 'upath';
import { Fixtures } from '~test/fixtures.ts';
import { scm } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import { getDependentPackageFiles } from './package-tree.ts';

vi.mock('fs-extra', async () =>
  (
    await vi.importActual<typeof import('~test/fixtures.ts')>(
      '~test/fixtures.ts',
    )
  ).fsExtra(),
);

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
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

      await expect(getDependentPackageFiles('single.csproj')).resolves.toEqual([
        { isLeaf: true, name: 'single.csproj' },
      ]);
    });

    it('returns self for two projects with no references', async () => {
      scm.getFileList.mockResolvedValue(['one.csproj', 'two.csproj']);
      Fixtures.mock({
        '/tmp/repo/one.csproj': Fixtures.get('two-no-reference/one.csproj'),
        '/tmp/repo/two.csproj': Fixtures.get('two-no-reference/two.csproj'),
      });

      await expect(getDependentPackageFiles('one.csproj')).resolves.toEqual([
        { isLeaf: true, name: 'one.csproj' },
      ]);
      await expect(getDependentPackageFiles('two.csproj')).resolves.toEqual([
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

      await expect(getDependentPackageFiles('one/one.csproj')).resolves.toEqual(
        [
          { isLeaf: false, name: 'one/one.csproj' },
          { isLeaf: true, name: 'two/two.csproj' },
        ],
      );
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

      await expect(
        getDependentPackageFiles('Directory.Packages.props', true),
      ).resolves.toEqual([
        { isLeaf: false, name: 'one/one.csproj' },
        { isLeaf: true, name: 'two/two.csproj' },
      ]);
    });

    it('returns projects for two projects with one reference and Directory.Build.props', async () => {
      scm.getFileList.mockResolvedValue(['one/one.csproj', 'two/two.csproj']);
      Fixtures.mock({
        '/tmp/repo/one/one.csproj': Fixtures.get(
          'two-one-reference-with-directory-build-props/one/one.csproj',
        ),
        '/tmp/repo/two/two.csproj': Fixtures.get(
          'two-one-reference-with-directory-build-props/two/two.csproj',
        ),
        '/tmp/repo/Directory.Build.props': Fixtures.get(
          'two-one-reference-with-directory-build-props/Directory.Build.props',
        ),
      });

      await expect(
        getDependentPackageFiles('Directory.Build.props', true),
      ).resolves.toEqual([
        { isLeaf: false, name: 'one/one.csproj' },
        { isLeaf: true, name: 'two/two.csproj' },
      ]);
    });

    it('returns only projects under nested Directory.Build.props directory', async () => {
      scm.getFileList.mockResolvedValue([
        'src/one/one.csproj',
        'other/two.csproj',
      ]);
      Fixtures.mock({
        '/tmp/repo/src/one/one.csproj': Fixtures.get(
          'two-one-reference-with-directory-build-props/one/one.csproj',
        ),
        '/tmp/repo/other/two.csproj': Fixtures.get(
          'two-one-reference-with-directory-build-props/one/one.csproj',
        ),
        '/tmp/repo/src/Directory.Build.props': Fixtures.get(
          'two-one-reference-with-directory-build-props/Directory.Build.props',
        ),
      });

      await expect(
        getDependentPackageFiles('src/Directory.Build.props', true),
      ).resolves.toEqual([{ isLeaf: true, name: 'src/one/one.csproj' }]);
    });

    it('returns project for two projects with one reference and global.json', async () => {
      scm.getFileList.mockResolvedValue(['one/one.csproj', 'two/two.csproj']);
      Fixtures.mock({
        '/tmp/repo/one/one.csproj': Fixtures.get(
          'two-one-reference-with-central-versions/one/one.csproj',
        ),
        '/tmp/repo/two/two.csproj': Fixtures.get(
          'two-one-reference-with-central-versions/two/two.csproj',
        ),
        '/tmp/repo/global.json': '{}',
      });

      await expect(
        getDependentPackageFiles('global.json', false, true),
      ).resolves.toEqual([
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

      await expect(getDependentPackageFiles('one/one.csproj')).resolves.toEqual(
        [
          { isLeaf: false, name: 'one/one.csproj' },
          { isLeaf: false, name: 'two/two.csproj' },
          { isLeaf: true, name: 'three/three.csproj' },
        ],
      );

      await expect(getDependentPackageFiles('two/two.csproj')).resolves.toEqual(
        [
          { isLeaf: false, name: 'two/two.csproj' },
          { isLeaf: true, name: 'three/three.csproj' },
        ],
      );

      await expect(
        getDependentPackageFiles('three/three.csproj'),
      ).resolves.toEqual([{ isLeaf: true, name: 'three/three.csproj' }]);
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

      await expect(getDependentPackageFiles('one/one.csproj')).resolves.toEqual(
        [
          { isLeaf: false, name: 'one/one.csproj' },
          { isLeaf: true, name: 'two/two.csproj' },
          { isLeaf: true, name: 'three/three.csproj' },
        ],
      );

      await expect(getDependentPackageFiles('two/two.csproj')).resolves.toEqual(
        [{ isLeaf: true, name: 'two/two.csproj' }],
      );
      await expect(
        getDependentPackageFiles('three/three.csproj'),
      ).resolves.toEqual([{ isLeaf: true, name: 'three/three.csproj' }]);
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
      await expect(getDependentPackageFiles('foo/bar.csproj')).resolves.toEqual(
        [{ isLeaf: true, name: 'foo/bar.csproj' }],
      );
    });
  });
});
