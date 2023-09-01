import { logger, mocked } from '../../../../../test/util';
import { getLockedVersions } from './locked-versions';
import * as _npm from './npm';

const npm = mocked(_npm);

jest.mock('./npm');

describe('modules/manager/npm/extract/locked-versions', () => {
  describe('.getLockedVersions()', () => {
    it('uses package-lock.json with npm v6.0.0', async () => {
      npm.getNpmLock.mockResolvedValue({
        lockedVersions: { a: '1.0.0', b: '2.0.0', c: '3.0.0' },
        lockfileVersion: 1,
      });
      const packageFiles = [
        {
          managerData: { npmLock: 'package-lock.json' },
          extractedConstraints: {},
          deps: [
            { depName: 'a', currentValue: '1.0.0' },
            { depName: 'b', currentValue: '2.0.0' },
          ],
          packageFile: 'some-file',
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: { npm: '<7' },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
          ],
          lockFiles: ['package-lock.json'],
          managerData: { npmLock: 'package-lock.json' },
          packageFile: 'some-file',
        },
      ]);
    });

    it('uses package-lock.json with npm v7.0.0', async () => {
      npm.getNpmLock.mockResolvedValue({
        lockedVersions: { a: '1.0.0', b: '2.0.0', c: '3.0.0' },
        lockfileVersion: 2,
      });
      const packageFiles = [
        {
          managerData: {
            npmLock: 'package-lock.json',
          },
          extractedConstraints: {},
          deps: [
            { depName: 'a', currentValue: '1.0.0' },
            { depName: 'b', currentValue: '2.0.0' },
          ],
          packageFile: 'some-file',
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: {
            npm: '<9',
          },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
          ],
          packageFile: 'some-file',
          lockFiles: ['package-lock.json'],
          managerData: {
            npmLock: 'package-lock.json',
          },
        },
      ]);
    });

    it('augments v2 lock file constraint', async () => {
      npm.getNpmLock.mockResolvedValue({
        lockedVersions: { a: '1.0.0', b: '2.0.0', c: '3.0.0' },
        lockfileVersion: 2,
      });
      const packageFiles = [
        {
          managerData: {
            npmLock: 'package-lock.json',
          },
          extractedConstraints: {
            npm: '>=7.0.0',
          },
          deps: [
            { depName: 'a', currentValue: '1.0.0' },
            { depName: 'b', currentValue: '2.0.0' },
          ],
          packageFile: 'some-file',
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: {
            npm: '>=7.0.0 <9',
          },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
          ],
          lockFiles: ['package-lock.json'],
          managerData: { npmLock: 'package-lock.json' },
          packageFile: 'some-file',
        },
      ]);
    });

    it('skips augmenting v2 lock file constraint', async () => {
      npm.getNpmLock.mockResolvedValue({
        lockedVersions: { a: '1.0.0', b: '2.0.0', c: '3.0.0' },
        lockfileVersion: 2,
      });
      const packageFiles = [
        {
          managerData: {
            npmLock: 'package-lock.json',
          },
          extractedConstraints: {
            npm: '>=9.0.0',
          },
          deps: [
            { depName: 'a', currentValue: '1.0.0' },
            { depName: 'b', currentValue: '2.0.0' },
          ],
          packageFile: 'some-file',
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: {
            npm: '>=9.0.0',
          },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
          ],
          lockFiles: ['package-lock.json'],
          managerData: { npmLock: 'package-lock.json' },
          packageFile: 'some-file',
        },
      ]);
    });

    it('appends <7 to npm extractedConstraints', async () => {
      npm.getNpmLock.mockResolvedValue({
        lockedVersions: {
          a: '1.0.0',
          b: '2.0.0',
          c: '3.0.0',
        },
        lockfileVersion: 1,
      });
      const packageFiles = [
        {
          managerData: {
            npmLock: 'package-lock.json',
          },
          extractedConstraints: {
            npm: '>=6.0.0',
          },
          deps: [
            {
              depName: 'a',
              currentValue: '1.0.0',
            },
            {
              depName: 'b',
              currentValue: '2.0.0',
            },
          ],
          packageFile: 'some-file',
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: { npm: '>=6.0.0 <7' },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
          ],
          lockFiles: ['package-lock.json'],
          managerData: { npmLock: 'package-lock.json' },
          packageFile: 'some-file',
        },
      ]);
    });

    it('skips appending <7 to npm extractedConstraints', async () => {
      npm.getNpmLock.mockResolvedValue({
        lockedVersions: {
          a: '1.0.0',
          b: '2.0.0',
          c: '3.0.0',
        },
        lockfileVersion: 1,
      });
      const packageFiles = [
        {
          managerData: {
            npmLock: 'package-lock.json',
          },
          extractedConstraints: {
            npm: '^8.0.0',
          },
          deps: [
            {
              depName: 'a',
              currentValue: '1.0.0',
            },
            {
              depName: 'b',
              currentValue: '2.0.0',
            },
          ],
          packageFile: 'some-file',
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: { npm: '^8.0.0' },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
          ],
          lockFiles: ['package-lock.json'],
          managerData: { npmLock: 'package-lock.json' },
          packageFile: 'some-file',
        },
      ]);
    });
  });

  it('should log warning if unsupported lockfileVersion is found', async () => {
    npm.getNpmLock.mockResolvedValue({
      lockedVersions: {},
      lockfileVersion: 99,
    });
    const packageFiles = [
      {
        managerData: {
          npmLock: 'package-lock.json',
        },
        extractedConstraints: {},
        deps: [
          { depName: 'a', currentValue: '1.0.0' },
          { depName: 'b', currentValue: '2.0.0' },
        ],
        packageFile: 'some-file',
      },
    ];
    await getLockedVersions(packageFiles);
    expect(packageFiles).toEqual(packageFiles);
    expect(logger.logger.warn).toHaveBeenCalledWith(
      {
        lockfileVersion: 99,
        npmLock: 'package-lock.json',
      },
      'Found unsupported npm lockfile version'
    );
  });

  describe('lockfileVersion 3', () => {
    it('uses package-lock.json with npm v9.0.0', async () => {
      npm.getNpmLock.mockResolvedValue({
        lockedVersions: {
          a: '1.0.0',
          b: '2.0.0',
          c: '3.0.0',
        },
        lockfileVersion: 3,
      });
      const packageFiles = [
        {
          managerData: {
            npmLock: 'package-lock.json',
          },
          extractedConstraints: {},
          deps: [
            { depName: 'a', currentValue: '1.0.0' },
            { depName: 'b', currentValue: '2.0.0' },
          ],
          packageFile: 'some-file',
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: {
            npm: '>=7',
          },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
          ],
          packageFile: 'some-file',
          lockFiles: ['package-lock.json'],
          managerData: {
            npmLock: 'package-lock.json',
          },
        },
      ]);
    });

    it('uses package-lock.json with npm v7.0.0', async () => {
      npm.getNpmLock.mockResolvedValue({
        lockedVersions: {
          a: '1.0.0',
          b: '2.0.0',
          c: '3.0.0',
        },
        lockfileVersion: 3,
      });
      const packageFiles = [
        {
          managerData: {
            npmLock: 'package-lock.json',
          },
          extractedConstraints: {
            npm: '^9.0.0',
          },
          deps: [
            { depName: 'a', currentValue: '1.0.0' },
            { depName: 'b', currentValue: '2.0.0' },
          ],
          packageFile: 'some-file',
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: {
            npm: '^9.0.0',
          },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
          ],
          packageFile: 'some-file',
          lockFiles: ['package-lock.json'],
          managerData: {
            npmLock: 'package-lock.json',
          },
        },
      ]);
    });
  });
});
