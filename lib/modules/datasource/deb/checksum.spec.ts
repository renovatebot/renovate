import { createHash } from 'node:crypto';
import { codeBlock } from 'common-tags';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import { Fixtures } from '~test/fixtures.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { outputCacheFile } from '../../../util/fs/index.ts';
import {
  computeFileChecksum,
  parseChecksumsFromInRelease,
} from './checksum.ts';

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
      ).toEqual({ algorithm: 'sha256', hash: expectedHash });

      expect(
        parseChecksumsFromInRelease(
          fixtureInRelease,
          'non-existing/binary-amd64/Packages.gz',
        ),
      ).toBeNull();
    });

    it('parses a SHA512-only release file', () => {
      const hash = 'a'.repeat(128);
      const content = codeBlock`
        Suite: resolute
        MD5Sum:
         ${'b'.repeat(32)} 1234 main/binary-amd64/Packages.gz
        SHA512:
         ${hash} 1234 main/binary-amd64/Packages.gz
         ${'c'.repeat(128)} 99 main/binary-amd64/Packages.xz
      `;
      expect(
        parseChecksumsFromInRelease(content, 'main/binary-amd64/Packages.gz'),
      ).toEqual({ algorithm: 'sha512', hash });
    });

    it('prefers SHA512 over SHA256', () => {
      const hash = 'a'.repeat(128);
      const content = codeBlock`
        SHA256:
         ${'b'.repeat(64)} 1234 main/binary-amd64/Packages.gz
        SHA512:
         ${hash} 1234 main/binary-amd64/Packages.gz
      `;
      expect(
        parseChecksumsFromInRelease(content, 'main/binary-amd64/Packages.gz'),
      ).toEqual({ algorithm: 'sha512', hash });
    });

    it('falls back to SHA256 when SHA512 does not list the path', () => {
      const hash = 'b'.repeat(64);
      const content = codeBlock`
        SHA256:
         ${hash} 1234 main/binary-amd64/Packages.gz
        SHA512:
         ${'a'.repeat(128)} 1234 main/binary-amd64/Packages.xz
      `;
      expect(
        parseChecksumsFromInRelease(content, 'main/binary-amd64/Packages.gz'),
      ).toEqual({ algorithm: 'sha256', hash });
    });

    it('ignores unsupported sections and unrelated path suffixes', () => {
      const content = codeBlock`
        SHA1:
         ${'d'.repeat(40)} 1234 main/binary-amd64/Packages.gz
        SHA256:
         ${'b'.repeat(64)} 1234 other/main/binary-amd64/Packages.gz
      `;
      expect(
        parseChecksumsFromInRelease(content, 'main/binary-amd64/Packages.gz'),
      ).toBeNull();
    });
  });

  describe('computeFileChecksum', () => {
    it('computes the checksum of a file', async () => {
      await outputCacheFile('file.txt', 'bar');

      const expectedHash =
        'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9';

      await expect(computeFileChecksum('file.txt')).resolves.toBe(expectedHash);
    });

    it('computes the checksum with the given algorithm', async () => {
      await outputCacheFile('file.txt', 'bar');

      await expect(computeFileChecksum('file.txt', 'sha512')).resolves.toBe(
        createHash('sha512').update('bar').digest('hex'),
      );
    });

    it('should fail if there is an error in the stream', async () => {
      await expect(computeFileChecksum('file.txt')).rejects.toThrow(
        'ENOENT: no such file or directory',
      );
    });
  });
});
