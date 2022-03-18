import { loadFixture } from '../../../../test/util';
import { composeLockFile, parseLockFile } from './utils';

describe('modules/manager/npm/utils', () => {
  describe('parseLockFile', () => {
    it('parses lockfile string into an object', () => {
      const lockFile = loadFixture('lockfile-parsing/package-lock.json');
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
      const lockFile = {
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
  });
});
