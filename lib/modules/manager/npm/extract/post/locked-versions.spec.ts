import { logger, mocked } from '../../../../../../test/util';
import type { PackageFile } from '../../../types';
import type { NpmManagerData } from '../../types';
import * as _npm from '../npm';
import * as _pnpm from '../pnpm';
import * as _yarn from '../yarn';
import { getLockedVersions } from './locked-versions';

const npm = mocked(_npm);
const pnpm = mocked(_pnpm);
const yarn = mocked(_yarn);

jest.mock('../npm');
jest.mock('../yarn', () => ({
  ...jest.requireActual<typeof import('../yarn')>('../yarn'),
  getYarnLock: jest.fn(),
}));
jest.mock('../pnpm');

describe('modules/manager/npm/extract/post/locked-versions', () => {
  describe('.getLockedVersions()', () => {
    function getPackageFiles(
      yarnVersion: string,
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

    it('does nothing if managerData is not present', async () => {
      npm.getNpmLock.mockResolvedValue({
        lockedVersions: { a: '1.0.0', b: '2.0.0', c: '3.0.0' },
        lockfileVersion: 1,
      });
      const packageFiles = [
        {
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
          extractedConstraints: {},
          deps: [
            { currentValue: '1.0.0', depName: 'a' },
            { currentValue: '2.0.0', depName: 'b' },
          ],
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

  it('uses pnpm-lock', async () => {
    pnpm.getPnpmLock.mockResolvedValue({
      lockedVersionsWithPath: {
        '.': {
          dependencies: {
            a: '1.0.0',
            b: '2.0.0',
            c: '3.0.0',
          },
        },
      },
      lockfileVersion: 6.0,
    });
    const packageFiles = [
      {
        managerData: {
          pnpmShrinkwrap: 'pnpm-lock.yaml',
        },
        extractedConstraints: {
          pnpm: '>=6.0.0',
        },
        deps: [
          {
            depName: 'a',
            depType: 'dependencies',
            currentValue: '1.0.0',
          },
          {
            depName: 'b',
            depType: 'dependencies',
            currentValue: '2.0.0',
          },
        ],
        packageFile: 'package.json',
      },
    ];
    await getLockedVersions(packageFiles);
    expect(packageFiles).toEqual([
      {
        extractedConstraints: { pnpm: '>=6.0.0' },
        deps: [
          {
            currentValue: '1.0.0',
            depName: 'a',
            lockedVersion: '1.0.0',
            depType: 'dependencies',
          },
          {
            currentValue: '2.0.0',
            depName: 'b',
            lockedVersion: '2.0.0',
            depType: 'dependencies',
          },
        ],
        lockFiles: ['pnpm-lock.yaml'],
        managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
        packageFile: 'package.json',
      },
    ]);
  });

  it('uses pnpm-lock in subfolder', async () => {
    pnpm.getPnpmLock.mockResolvedValue({
      lockedVersionsWithPath: {
        '.': {
          dependencies: {
            a: '1.0.0',
            b: '2.0.0',
            c: '3.0.0',
          },
        },
      },
      lockfileVersion: 6.0,
    });
    const packageFiles = [
      {
        managerData: {
          pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml',
        },
        extractedConstraints: {
          pnpm: '>=6.0.0',
        },
        deps: [
          {
            depName: 'a',
            depType: 'dependencies',
            currentValue: '1.0.0',
          },
          {
            depName: 'b',
            depType: 'dependencies',
            currentValue: '2.0.0',
          },
        ],
        packageFile: 'subfolder/package.json',
      },
    ];
    await getLockedVersions(packageFiles);
    expect(packageFiles).toEqual([
      {
        extractedConstraints: { pnpm: '>=6.0.0' },
        deps: [
          {
            currentValue: '1.0.0',
            depName: 'a',
            lockedVersion: '1.0.0',
            depType: 'dependencies',
          },
          {
            currentValue: '2.0.0',
            depName: 'b',
            lockedVersion: '2.0.0',
            depType: 'dependencies',
          },
        ],
        lockFiles: ['subfolder/pnpm-lock.yaml'],
        managerData: { pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml' },
        packageFile: 'subfolder/package.json',
      },
    ]);
  });

  it('uses pnpm-lock with workspaces', async () => {
    pnpm.getPnpmLock.mockResolvedValue({
      lockedVersionsWithPath: {
        'workspace-package': {
          dependencies: {
            a: '1.0.0',
            b: '2.0.0',
            c: '3.0.0',
          },
        },
      },
      lockfileVersion: 6.0,
    });
    const packageFiles = [
      {
        managerData: {
          pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml',
        },
        extractedConstraints: {
          pnpm: '>=6.0.0',
        },
        deps: [],
        packageFile: 'subfolder/package.json',
      },
      {
        managerData: {
          pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml',
        },
        extractedConstraints: {
          pnpm: '>=6.0.0',
        },
        deps: [
          {
            depName: 'a',
            depType: 'dependencies',
            currentValue: '1.0.0',
          },
          {
            depName: 'b',
            depType: 'dependencies',
            currentValue: '2.0.0',
          },
        ],
        packageFile: 'subfolder/workspace-package/package.json',
      },
    ];
    await getLockedVersions(packageFiles);
    expect(packageFiles).toEqual([
      {
        extractedConstraints: { pnpm: '>=6.0.0' },
        deps: [],
        lockFiles: ['subfolder/pnpm-lock.yaml'],
        managerData: { pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml' },
        packageFile: 'subfolder/package.json',
      },
      {
        extractedConstraints: { pnpm: '>=6.0.0' },
        deps: [
          {
            currentValue: '1.0.0',
            depName: 'a',
            lockedVersion: '1.0.0',
            depType: 'dependencies',
          },
          {
            currentValue: '2.0.0',
            depName: 'b',
            lockedVersion: '2.0.0',
            depType: 'dependencies',
          },
        ],
        lockFiles: ['subfolder/pnpm-lock.yaml'],
        managerData: { pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml' },
        packageFile: 'subfolder/workspace-package/package.json',
      },
    ]);
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
      'Found unsupported npm lockfile version',
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
