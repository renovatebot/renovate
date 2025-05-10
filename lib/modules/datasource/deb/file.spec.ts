import { copyFile } from 'fs';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { extract } from './file';
import { Fixtures } from '~test/fixtures';
import { fs } from '~test/util';

const fixturePackagesArchiveGzPath = Fixtures.getPath(`Packages.gz`);
const fixturePackagesArchiveBz2Path = Fixtures.getPath(`Packages.bz2`);
const fixturePackagesArchiveXzPath = Fixtures.getPath(`Packages.xz`);

describe('modules/datasource/deb/file', () => {
  let cacheDir: DirectoryResult | null;
  let extractedPackageFile: string;
  let extractionFolder: string;
  let packageArchiveCache: string;

  beforeEach(async () => {
    cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });

    extractionFolder = await fs.ensureCacheDir('file');
    extractedPackageFile = upath.join(extractionFolder, `package.txt`);

    packageArchiveCache = upath.join(extractionFolder, `Package`);
  });

  afterEach(async () => {
    await cacheDir?.cleanup();
    cacheDir = null;
  });

  describe('extract', () => {
    it('should support xz compression', async () => {
      await copyFixtureToCache(
        fixturePackagesArchiveXzPath,
        packageArchiveCache,
      );
      await extract(packageArchiveCache, 'xz', extractedPackageFile);
      const fileContent = await fs.readCacheFile(extractedPackageFile, 'utf8');
      expect(fileContent).toContain('Package:');
    });

    it('should support gz compression', async () => {
      await copyFixtureToCache(
        fixturePackagesArchiveGzPath,
        packageArchiveCache,
      );
      await extract(packageArchiveCache, 'gz', extractedPackageFile);
      const fileContent = await fs.readCacheFile(extractedPackageFile, 'utf8');
      expect(fileContent).toContain('Package:');
    });

    it('should support bz2 compression', async () => {
      await copyFixtureToCache(
        fixturePackagesArchiveBz2Path,
        packageArchiveCache,
      );
      await extract(packageArchiveCache, 'bz2', extractedPackageFile);
      const fileContent = await fs.readCacheFile(extractedPackageFile, 'utf8');
      expect(fileContent).toContain('Package:');
    });
  });
});

function copyFixtureToCache(
  fixturePath: string,
  cachePath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    copyFile(fixturePath, cachePath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
