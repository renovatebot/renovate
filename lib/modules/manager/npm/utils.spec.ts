import { Fixtures } from '../../../../test/fixtures';
import type { LockFile } from './types';
import { composeLockFile, parseLockFile } from './utils';

describe('modules/manager/npm/utils', () => {
  describe('parseLockFile', () => {
    it('parses lockfile string into an object', () => {
      const lockFile = Fixtures.get('lockfile-parsing/package-lock.json');
      const parseLockFileResult = parseLockFile(lockFile);
      expect(parseLockFileResult).toStrictEqual({
        detectedIndent: '  ',
        lockFileParsed: {
          lockfileVersion: 2,
          name: 'lockfile-parsing',
          packages: {
            '': {
              license: 'ISC',
              name: 'lockfile-parsing',
              version: '1.0.0',
            },
          },
          requires: true,
          version: '1.0.0',
        },
      });
    });

    it('can deal with invalid lockfiles', () => {
      const lockFile = '';
      const parseLockFileResult = parseLockFile(lockFile);
      expect(parseLockFileResult).toStrictEqual({
        detectedIndent: '  ',
        lockFileParsed: undefined,
      });
    });
  });

  describe('composeLockFile', () => {
    it('composes lockfile string out of an object', () => {
      const lockFile: LockFile = {
        lockfileVersion: 2,
        name: 'lockfile-parsing',
        packages: {
          '': {
            license: 'ISC',
            name: 'lockfile-parsing',
            version: '1.0.0',
          },
        },
        requires: true,
        version: '1.0.0',
      };
      const lockFileComposed = composeLockFile(lockFile, '  ');
      expect(lockFileComposed).toMatchSnapshot();
    });

    it('adds trailing newline to match npms behavior and avoid diffs', () => {
      const lockFile = Fixtures.get('lockfile-parsing/package-lock.json');
      const { detectedIndent, lockFileParsed } = parseLockFile(lockFile);
      // TODO #22198
      const lockFileComposed = composeLockFile(lockFileParsed!, detectedIndent);
      expect(lockFileComposed).toBe(lockFile);
    });
  });
});
