import { dir } from 'tmp-promise';
import upath from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { extract } from './file';

const fixturePackagesArchivePath = Fixtures.getPath(`Packages.gz`);

describe('modules/datasource/deb/file', () => {
  let extractedPackageFile: string;

  beforeEach(async () => {
    const cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });

    const extractionFolder = await fs.ensureCacheDir('file');
    extractedPackageFile = upath.join(extractionFolder, `package.txt`);
  });

  describe('extract', () => {
    it('should throw error for unsupported compression', async () => {
      await expect(
        extract(fixturePackagesArchivePath, 'xz', extractedPackageFile),
      ).rejects.toThrow('Unsupported compression standard');
    });
  });
});
