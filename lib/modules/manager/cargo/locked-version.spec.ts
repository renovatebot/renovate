import { DirectoryResult, dir } from 'tmp-promise';
import { join } from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { writeLocalFile } from '../../../util/fs';
import { extractLockFileVersions, parseLockFile } from './locked-version';

describe('modules/manager/cargo/locked-version', () => {
  describe('extractLockFileVersions()', () => {
    let adminConfig: RepoGlobalConfig;
    let tmpDir: DirectoryResult;

    beforeEach(async () => {
      tmpDir = await dir({ unsafeCleanup: true });
      adminConfig = {
        localDir: join(tmpDir.path, 'local'),
      };

      GlobalConfig.set(adminConfig);
    });

    afterEach(async () => {
      await tmpDir.cleanup();
      GlobalConfig.reset();
    });

    it('returns null for missing lock file', async () => {
      expect(await extractLockFileVersions('Cargo.lock')).toBeNull();
    });

    it('returns null for invalid lock file', async () => {
      await writeLocalFile('Cargo.lock', 'foo');
      expect(await extractLockFileVersions('Cargo.lock')).toBeNull();
    });

    it('returns empty map for lock file without packages', async () => {
      await writeLocalFile('Cargo.lock', '[metadata]');
      expect(await extractLockFileVersions('Cargo.lock')).toEqual(new Map());
    });

    it('returns a map of package versions', async () => {
      await writeLocalFile('Cargo.lock', Fixtures.get('Cargo.7.lock'));
      expect(await extractLockFileVersions('Cargo.lock')).toEqual(
        new Map([
          ['proc-macro2', ['1.0.66']],
          ['quote', ['1.0.33']],
          ['syn', ['1.0.1', '2.0.1']],
          ['test', ['0.1.0']],
          ['unicode-ident', ['1.0.11']],
          ['unicode-xid', ['0.2.4']],
        ])
      );
    });
  });

  describe('parseLockFile', () => {
    it('parses v1 lockfile string into an object', () => {
      const lockFile = Fixtures.get('lockfile-parsing/Cargo.v1.lock');
      const parseLockFileResult = parseLockFile(lockFile);
      expect(parseLockFileResult).toStrictEqual({
        package: [
          {
            name: 'foo',
            version: '1.0.4',
            source: 'registry+https://github.com/rust-lang/crates.io-index',
          },
          {
            name: 'bar',
            version: '0.7.6',
            source: 'registry+https://github.com/rust-lang/crates.io-index',
          },
        ],
      });
    });

    it('parses v2 lockfile string into an object', () => {
      const lockFile = Fixtures.get('lockfile-parsing/Cargo.v2.lock');
      const parseLockFileResult = parseLockFile(lockFile);
      expect(parseLockFileResult).toStrictEqual({
        package: [
          {
            name: 'foo',
            version: '1.1.0',
            source: 'registry+https://github.com/rust-lang/crates.io-index',
          },
          {
            name: 'bar',
            version: '7.0.1',
          },
        ],
      });
    });

    it('parses v3 lockfile string into an object', () => {
      const lockFile = Fixtures.get('lockfile-parsing/Cargo.v3.lock');
      const parseLockFileResult = parseLockFile(lockFile);
      expect(parseLockFileResult).toStrictEqual({
        package: [
          {
            name: 'foo',
            version: '1.1.0',
            source: 'registry+https://github.com/rust-lang/crates.io-index',
          },
          {
            name: 'bar',
            version: '7.0.1',
          },
        ],
      });
    });

    it('can deal with invalid lockfiles', () => {
      const lockFile = 'foo';
      const parseLockFileResult = parseLockFile(lockFile);
      expect(parseLockFileResult).toBeNull();
    });
  });
});
