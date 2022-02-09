import type { PackageFile } from '../../types';
import { getLockedVersions } from './locked-versions';

/** @type any */
const npm = require('./npm');
/** @type any */
const yarn = require('./yarn');

jest.mock('./npm');
jest.mock('./yarn');

describe('manager/npm/extract/locked-versions', () => {
  describe('.getLockedVersions()', () => {
    function getPackageFiles(yarnVersion: string): PackageFile[] {
      return [
        {
          npmLock: 'package-lock.json',
          yarnLock: 'yarn.lock',
          constraints: {},
          deps: [
            { depName: 'a', currentValue: '1.0.0' },
            { depName: 'b', currentValue: '2.0.0' },
            {
              depType: 'engines',
              depName: 'yarn',
              currentValue: `^${yarnVersion}`,
            },
            {
              depType: 'packageManager',
              depName: 'yarn',
              currentValue: `${yarnVersion}`,
            },
          ],
        },
      ];
    }

    const lockedVersions = {
      'a@1.0.0': '1.0.0',
      'b@2.0.0': '2.0.0',
      'c@2.0.0': '3.0.0',
    };

    it('uses yarn.lock with yarn v1.22.0', async () => {
      const yarnVersion = '1.22.0';
      const lockfileVersion = undefined;
      const isYarn1 = true;
      yarn.getYarnLock.mockReturnValue({
        isYarn1,
        lockfileVersion,
        lockedVersions,
      });
      const packageFiles = getPackageFiles(yarnVersion);
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          constraints: {},
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
            {
              currentValue: '^1.22.0',
              depName: 'yarn',
              depType: 'engines',
              lockedVersion: undefined,
            },
            {
              currentValue: '1.22.0',
              depName: 'yarn',
              depType: 'packageManager',
              lockedVersion: undefined,
            },
          ],
          lockFiles: ['yarn.lock'],
          npmLock: 'package-lock.json',
          yarnLock: 'yarn.lock',
        },
      ]);
    });
    it('uses yarn.lock with yarn v2.1.0', async () => {
      const yarnVersion = '2.1.0';
      const lockfileVersion = undefined;
      const isYarn1 = false;
      yarn.getYarnLock.mockReturnValue({
        isYarn1,
        lockfileVersion,
        lockedVersions,
      });
      const packageFiles = getPackageFiles(yarnVersion);
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          constraints: { yarn: '^2.0.0' },
          deps: [
            {
              currentValue: '1.0.0',
              depName: 'a',
              lockedVersion: '1.0.0',
            },
            {
              currentValue: '2.0.0',
              depName: 'b',
              lockedVersion: '2.0.0',
            },
            {
              currentValue: '^2.1.0',
              depName: 'yarn',
              depType: 'engines',
              lockedVersion: undefined,
              lookupName: '@yarnpkg/cli',
            },
            {
              currentValue: '2.1.0',
              depName: 'yarn',
              depType: 'packageManager',
              lockedVersion: undefined,
              lookupName: '@yarnpkg/cli',
            },
          ],
          lockFiles: ['yarn.lock'],
          npmLock: 'package-lock.json',
          yarnLock: 'yarn.lock',
        },
      ]);
    });
    it('uses yarn.lock with yarn v2.2.0', async () => {
      const yarnVersion = '2.2.0';
      const lockfileVersion = 6;
      const isYarn1 = false;
      yarn.getYarnLock.mockReturnValue({
        isYarn1,
        lockfileVersion,
        lockedVersions,
      });
      const packageFiles = getPackageFiles(yarnVersion);
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          constraints: { yarn: '^2.2.0' },
          deps: [
            {
              currentValue: '1.0.0',
              depName: 'a',
              lockedVersion: '1.0.0',
            },
            {
              currentValue: '2.0.0',
              depName: 'b',
              lockedVersion: '2.0.0',
            },
            {
              currentValue: '^2.2.0',
              depName: 'yarn',
              depType: 'engines',
              lockedVersion: undefined,
              lookupName: '@yarnpkg/cli',
            },
            {
              currentValue: '2.2.0',
              depName: 'yarn',
              depType: 'packageManager',
              lockedVersion: undefined,
              lookupName: '@yarnpkg/cli',
            },
          ],
          lockFiles: ['yarn.lock'],
          npmLock: 'package-lock.json',
          yarnLock: 'yarn.lock',
        },
      ]);
    });
    it('uses yarn.lock with yarn v3.0.0', async () => {
      const yarnVersion = '3.0.0';
      const lockfileVersion = 8;
      const isYarn1 = false;
      yarn.getYarnLock.mockReturnValue({
        isYarn1,
        lockfileVersion,
        lockedVersions,
      });
      const packageFiles = getPackageFiles(yarnVersion);
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          constraints: { yarn: '^3.0.0' },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
            {
              currentValue: '^3.0.0',
              depName: 'yarn',
              depType: 'engines',
              lockedVersion: undefined,
              lookupName: '@yarnpkg/cli',
            },
            {
              currentValue: '3.0.0',
              depName: 'yarn',
              depType: 'packageManager',
              lockedVersion: undefined,
              lookupName: '@yarnpkg/cli',
            },
          ],
          lockFiles: ['yarn.lock'],
          npmLock: 'package-lock.json',
          yarnLock: 'yarn.lock',
        },
      ]);
    });

    it('uses package-lock.json with npm v6.0.0', async () => {
      npm.getNpmLock.mockReturnValue({
        lockedVersions: { a: '1.0.0', b: '2.0.0', c: '3.0.0' },
        lockfileVersion: 1,
      });
      const packageFiles = [
        {
          npmLock: 'package-lock.json',
          constraints: {},
          deps: [
            { depName: 'a', currentValue: '1.0.0' },
            { depName: 'b', currentValue: '2.0.0' },
          ],
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          constraints: { npm: '<7' },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
          ],
          lockFiles: ['package-lock.json'],
          npmLock: 'package-lock.json',
        },
      ]);
    });
    it('uses package-lock.json with npm v7.0.0', async () => {
      npm.getNpmLock.mockReturnValue({
        lockedVersions: { a: '1.0.0', b: '2.0.0', c: '3.0.0' },
        lockfileVersion: 2,
      });
      const packageFiles = [
        {
          npmLock: 'package-lock.json',
          constraints: {},
          deps: [
            { depName: 'a', currentValue: '1.0.0' },
            { depName: 'b', currentValue: '2.0.0' },
          ],
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          constraints: {},
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
          ],
          lockFiles: ['package-lock.json'],
          npmLock: 'package-lock.json',
        },
      ]);
    });

    it('appends <7 to npm constraints', async () => {
      npm.getNpmLock.mockReturnValue({
        lockedVersions: {
          a: '1.0.0',
          b: '2.0.0',
          c: '3.0.0',
        },
        lockfileVersion: 1,
      });
      const packageFiles = [
        {
          npmLock: 'package-lock.json',
          constraints: {
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
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          constraints: { npm: '>=6.0.0 <7' },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
          ],
          lockFiles: ['package-lock.json'],
          npmLock: 'package-lock.json',
        },
      ]);
    });
    it('ignores pnpm', async () => {
      const packageFiles = [
        {
          pnpmShrinkwrap: 'pnpm-lock.yaml',
          deps: [
            { depName: 'a', currentValue: '1.0.0' },
            { depName: 'b', currentValue: '2.0.0' },
          ],
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          deps: [
            { currentValue: '1.0.0', depName: 'a' },
            { currentValue: '2.0.0', depName: 'b' },
          ],
          lockFiles: ['pnpm-lock.yaml'],
          pnpmShrinkwrap: 'pnpm-lock.yaml',
        },
      ]);
    });
  });
});
