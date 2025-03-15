import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { extract } from './file';
import { Fixtures } from '~test/fixtures';
import { fs } from '~test/util';

const fixturePackagesArchivePath = Fixtures.getPath(`Packages.gz`);

describe('modules/datasource/deb/file', () => {
  let cacheDir: DirectoryResult | null;
  let extractedPackageFile: string;

  beforeEach(async () => {
    cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });

    const extractionFolder = await fs.ensureCacheDir('file');
    extractedPackageFile = upath.join(extractionFolder, `package.txt`);
  });

  afterEach(async () => {
    await cacheDir?.cleanup();
    cacheDir = null;
  });

  describe('extract', () => {
    it('should throw error for unsupported compression', async () => {
      await expect(
        extract(fixturePackagesArchivePath, 'xz', extractedPackageFile),
      ).rejects.toThrow('Unsupported compression standard');
    });
  });
});
