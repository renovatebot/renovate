import { mocked } from '../../../../../test/util';
import type { PackageFile } from '../../types';
import type { NpmManagerData } from '../types';
import { getLockedVersions } from './locked-versions';
import * as _yarn from './yarn';

const yarn = mocked(_yarn);

jest.mock('./npm');
jest.mock('./yarn', () => ({
  ...jest.requireActual<any>('./yarn'),
  getYarnLock: jest.fn(),
}));
jest.mock('./pnpm');

describe('modules/manager/yarn/extract/locked-versions', () => {
  describe('.getLockedVersions()', () => {
    function getPackageFiles(
      yarnVersion: string
    ): PackageFile<NpmManagerData>[] {
      return [
        {
          managerData: {
            npmLock: 'package-lock.json',
            yarnLock: 'yarn.lock',
          },
          extractedConstraints: {},
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
          packageFile: 'some-file',
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
      yarn.getYarnLock.mockResolvedValue({
        isYarn1,
        lockfileVersion,
        lockedVersions,
      });
      const packageFiles = getPackageFiles(yarnVersion);
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: {},
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
          packageFile: 'some-file',
          managerData: { npmLock: 'package-lock.json', yarnLock: 'yarn.lock' },
        },
      ]);
    });

    it('uses yarn.lock with yarn v2.1.0', async () => {
      const yarnVersion = '2.1.0';
      const lockfileVersion = undefined;
      const isYarn1 = false;
      yarn.getYarnLock.mockResolvedValue({
        isYarn1,
        lockfileVersion,
        lockedVersions,
      });
      const packageFiles = getPackageFiles(yarnVersion);
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: { yarn: '^2.0.0' },
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
              packageName: '@yarnpkg/cli',
            },
            {
              currentValue: '2.1.0',
              depName: 'yarn',
              depType: 'packageManager',
              lockedVersion: undefined,
              packageName: '@yarnpkg/cli',
            },
          ],
          lockFiles: ['yarn.lock'],
          packageFile: 'some-file',
          managerData: { npmLock: 'package-lock.json', yarnLock: 'yarn.lock' },
        },
      ]);
    });

    it('uses yarn.lock with yarn v2.2.0', async () => {
      const yarnVersion = '2.2.0';
      const lockfileVersion = 6;
      const isYarn1 = false;
      yarn.getYarnLock.mockResolvedValue({
        isYarn1,
        lockfileVersion,
        lockedVersions,
      });
      const packageFiles = getPackageFiles(yarnVersion);
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: { yarn: '^2.2.0' },
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
              packageName: '@yarnpkg/cli',
            },
            {
              currentValue: '2.2.0',
              depName: 'yarn',
              depType: 'packageManager',
              lockedVersion: undefined,
              packageName: '@yarnpkg/cli',
            },
          ],
          lockFiles: ['yarn.lock'],
          packageFile: 'some-file',
          managerData: { npmLock: 'package-lock.json', yarnLock: 'yarn.lock' },
        },
      ]);
    });

    it('uses yarn.lock with yarn v3.0.0', async () => {
      const yarnVersion = '3.0.0';
      const lockfileVersion = 8;
      const isYarn1 = false;
      yarn.getYarnLock.mockResolvedValue({
        isYarn1,
        lockfileVersion,
        lockedVersions,
      });
      const packageFiles = getPackageFiles(yarnVersion);
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: { yarn: '^3.0.0' },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
            {
              currentValue: '^3.0.0',
              depName: 'yarn',
              depType: 'engines',
              lockedVersion: undefined,
              packageName: '@yarnpkg/cli',
            },
            {
              currentValue: '3.0.0',
              depName: 'yarn',
              depType: 'packageManager',
              lockedVersion: undefined,
              packageName: '@yarnpkg/cli',
            },
          ],
          lockFiles: ['yarn.lock'],
          packageFile: 'some-file',
          managerData: { npmLock: 'package-lock.json', yarnLock: 'yarn.lock' },
        },
      ]);
    });

    it("uses yarn.lock but doesn't override extractedConstraints", async () => {
      const yarnVersion = '3.2.0';
      const lockfileVersion = 8;
      const isYarn1 = false;
      yarn.getYarnLock.mockResolvedValue({
        isYarn1,
        lockfileVersion,
        lockedVersions,
      });
      const packageFiles = getPackageFiles(yarnVersion);
      packageFiles[0].extractedConstraints = { yarn: '3.2.0' };
      await getLockedVersions(packageFiles);
      expect(packageFiles).toEqual([
        {
          extractedConstraints: { yarn: '3.2.0' },
          deps: [
            { currentValue: '1.0.0', depName: 'a', lockedVersion: '1.0.0' },
            { currentValue: '2.0.0', depName: 'b', lockedVersion: '2.0.0' },
            {
              currentValue: '^3.2.0',
              depName: 'yarn',
              depType: 'engines',
              lockedVersion: undefined,
              packageName: '@yarnpkg/cli',
            },
            {
              currentValue: '3.2.0',
              depName: 'yarn',
              depType: 'packageManager',
              lockedVersion: undefined,
              packageName: '@yarnpkg/cli',
            },
          ],
          lockFiles: ['yarn.lock'],
          packageFile: 'some-file',
          managerData: { npmLock: 'package-lock.json', yarnLock: 'yarn.lock' },
        },
      ]);
    });
  });
});
