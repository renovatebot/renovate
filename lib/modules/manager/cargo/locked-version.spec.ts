import { Fixtures } from '../../../../test/fixtures';
import { parseLockFile } from './locked-version';

describe('modules/manager/cargo/locked-version', () => {
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
