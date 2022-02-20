import mockfs from 'mock-fs';
import upath from 'upath';
import { loadFixture } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import { getDependentPackageFiles } from './package-tree';

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('/tmp/repo'),
};

describe('manager/nuget/package-tree', () => {
  describe('getDependentPackageFiles()', () => {
    beforeEach(() => {
      GlobalConfig.set(adminConfig);
      mockfs.restore();
    });
    afterEach(() => {
      GlobalConfig.reset();
      mockfs.restore();
    });
    it('returns empty list for single project', async () => {
      mockfs({
        '/tmp/repo': {
          'single.csproj': loadFixture('single-project-file/single.csproj'),
        },
      });

      expect(await getDependentPackageFiles('single.csproj')).toBeEmpty();
    });
    it('returns empty list for two projects with no references', async () => {
      mockfs({
        '/tmp/repo': {
          'one.csproj': loadFixture('two-no-reference/one.csproj'),
          'two.csproj': loadFixture('two-no-reference/two.csproj'),
        },
      });

      expect(await getDependentPackageFiles('one.csproj')).toBeEmpty();
    });
    it('returns project for two projects with one reference', async () => {
      mockfs({
        '/tmp/repo/one': {
          'one.csproj': loadFixture('two-one-reference/one/one.csproj'),
        },
        '/tmp/repo/two': {
          'two.csproj': loadFixture('two-one-reference/two/two.csproj'),
        },
      });

      expect(await getDependentPackageFiles('one/one.csproj')).toEqual([
        'two/two.csproj',
      ]);
    });
    it('throws error on undefined localDir', async () => {
      GlobalConfig.set({
        localDir: undefined,
      });
      await expect(getDependentPackageFiles('test.csproj')).rejects.toThrow(
        'localDir must be set'
      );
    });
    it('throws error on undefined localDir with project reference', async () => {
      GlobalConfig.set({
        localDir: undefined,
      });
      mockfs({
        '/tmp/repo/one': {
          'one.csproj': loadFixture('two-one-reference/one/one.csproj'),
        },
        '/tmp/repo/two': {
          'two.csproj': loadFixture('two-one-reference/two/two.csproj'),
        },
      });
      await expect(getDependentPackageFiles('one/one.csproj')).rejects.toThrow(
        'localDir must be set'
      );
    });
    it('throws error on circular reference', async () => {
      mockfs({
        '/tmp/repo/one': {
          'one.csproj': loadFixture('circular-reference/one/one.csproj'),
        },
        '/tmp/repo/two': {
          'two.csproj': loadFixture('circular-reference/two/two.csproj'),
        },
      });
      await expect(getDependentPackageFiles('one/one.csproj')).rejects.toThrow(
        'Circular reference detected in NuGet package files'
      );
    });
  });
});
