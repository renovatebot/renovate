import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import { outputCacheFile } from '../../../util/fs';
import { computeFileChecksum, parseChecksumsFromInRelease } from './checksum';

const fixtureInRelease = Fixtures.getBinary(`InRelease`).toString();

describe('modules/datasource/deb/checksum', () => {
  let cacheDir: DirectoryResult | null;

  beforeEach(async () => {
    const cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });
  });

  afterEach(async () => {
    await cacheDir?.cleanup();
    cacheDir = null;
  });

  describe('parseChecksumsFromInRelease', () => {
    it('parses the checksum for the specified package', () => {
      const expectedHash =
        'bf77b15e68c5bfd7267c76a34172021de8f10f861f41ebda7b39d1390dd4bf9a';
      expect(
        parseChecksumsFromInRelease(
          fixtureInRelease,
          'contrib/binary-amd64/Packages.gz',
        ),
      ).toBe(expectedHash);

      expect(
        parseChecksumsFromInRelease(
          fixtureInRelease,
          'non-existing/binary-amd64/Packages.gz',
        ),
      ).toBeNull();
    });
  });

  describe('computeFileChecksum', () => {
    it('computes the checksum of a file', async () => {
      await outputCacheFile('file.txt', 'bar');

      const expectedHash =
        'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9';

      expect(await computeFileChecksum('file.txt')).toBe(expectedHash);
    });

    it('should fail if there is an error in the stream', async () => {
      await expect(computeFileChecksum('file.txt')).rejects.toThrow();
    });
  });
});
