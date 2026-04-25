import { isArray } from '@sindresorhus/is';
import { mockDeep } from 'vitest-mock-extended';
import { git, logger } from '~test/util.ts';
import { GitRefsDatasource } from '../../../../modules/datasource/git-refs/index.ts';
import * as _batectWrapper from '../../../../modules/manager/batect-wrapper/index.ts';
import * as _bundler from '../../../../modules/manager/bundler/index.ts';
import * as _composer from '../../../../modules/manager/composer/index.ts';
import * as _gitSubmodules from '../../../../modules/manager/git-submodules/index.ts';
import * as _gomod from '../../../../modules/manager/gomod/index.ts';
import * as _helmv3 from '../../../../modules/manager/helmv3/index.ts';
import * as _npm from '../../../../modules/manager/npm/index.ts';
import * as _pep621 from '../../../../modules/manager/pep621/index.ts';
import * as _pipCompile from '../../../../modules/manager/pip-compile/index.ts';
import * as _poetry from '../../../../modules/manager/poetry/index.ts';
import type {
  LookupUpdate,
  PackageDependency,
  PackageFile,
  UpdateArtifact,
} from '../../../../modules/manager/types.ts';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types.ts';
import * as _autoReplace from './auto-replace.ts';
import * as _executeUpdateCommands from './execute-update-commands.ts';
import { getUpdatedPackageFiles } from './get-updated.ts';

const bundler = vi.mocked(_bundler);
const composer = vi.mocked(_composer);
const gitSubmodules = vi.mocked(_gitSubmodules);
const gomod = vi.mocked(_gomod);
const helmv3 = vi.mocked(_helmv3);
const npm = vi.mocked(_npm);
const batectWrapper = vi.mocked(_batectWrapper);
const autoReplace = vi.mocked(_autoReplace);
const executeUpdateCommandsMod = vi.mocked(_executeUpdateCommands);
const pep621 = vi.mocked(_pep621);
const pipCompile = vi.mocked(_pipCompile);
const poetry = vi.mocked(_poetry);

vi.mock('../../../../modules/manager/bundler/index.ts');
vi.mock('../../../../modules/manager/composer/index.ts');
vi.mock('../../../../modules/manager/helmv3/index.ts');
vi.mock('../../../../modules/manager/npm/index.ts');
vi.mock('../../../../modules/manager/git-submodules/index.ts');
vi.mock('../../../../modules/manager/gomod/index.ts', () => mockDeep());
vi.mock('../../../../modules/manager/batect-wrapper/index.ts');
vi.mock('../../../../modules/manager/pep621/index.ts');
vi.mock('../../../../modules/manager/pip-compile/index.ts');
vi.mock('../../../../modules/manager/poetry/index.ts');
vi.mock('./auto-replace.ts');
vi.mock('./execute-update-commands.ts', () => mockDeep());

describe('workers/repository/update/branch/get-updated', () => {
  describe('getUpdatedPackageFiles()', () => {
    let config: BranchConfig;

    beforeEach(() => {
      config = {
        baseBranch: 'base-branch',
        manager: 'some-manager',
        branchName: 'renovate/pin',
        upgrades: [],
      } satisfies BranchConfig;
      npm.updateDependency = vi.fn();
      git.getFile.mockResolvedValueOnce('existing content');
    });

    it('handles autoreplace base updated', async () => {
      config.upgrades.push({
        packageFile: 'index.html',
        manager: 'html',
        branchName: '',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('updated-file');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          { type: 'addition', path: 'index.html', contents: 'updated-file' },
        ],
      });
    });

    it('handles autoreplace branch no update', async () => {
      config.upgrades.push({
        packageFile: 'index.html',
        manager: 'html',
        branchName: '',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('existing content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toEqual({
        artifactErrors: [],
        reuseExistingBranch: undefined,
        updatedArtifacts: [],
        updatedPackageFiles: [],
        artifactNotices: [],
      });
    });

    it('handles autoreplace failure', async () => {
      config.upgrades.push({ manager: 'html', branchName: '' });
      autoReplace.doAutoReplace.mockResolvedValueOnce(null);
      await expect(getUpdatedPackageFiles(config)).rejects.toThrow();
    });

    it('handles autoreplace branch needs update', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'index.html',
        manager: 'html',
        branchName: '',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce(null);
      autoReplace.doAutoReplace.mockResolvedValueOnce('updated-file');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          { type: 'addition', path: 'index.html', contents: 'updated-file' },
        ],
      });
    });

    it('handles empty', async () => {
      const res = await getUpdatedPackageFiles(config);
      expect(res).toEqual({
        artifactErrors: [],
        reuseExistingBranch: undefined,
        updatedArtifacts: [],
        updatedPackageFiles: [],
        artifactNotices: [],
      });
    });

    it('handles null content', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        manager: 'npm',
        branchName: 'some-branch',
      } satisfies BranchUpgradeConfig);
      await expect(getUpdatedPackageFiles(config)).rejects.toThrow();
    });

    it('handles content change', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'package.json',
        manager: 'npm',
        branchName: 'some-branch',
      } satisfies BranchUpgradeConfig);
      npm.updateDependency.mockReturnValue('some new content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'package.json',
            contents: 'some new content',
          },
        ],
      });
    });

    it('handles lock files', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.json',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'composer.json',
            contents: 'some contents',
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'composer.json',
            contents: 'some new content',
          },
        ],
      });
    });

    it('handles artifact notices', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'go.mod',
        manager: 'gomod',
        branchName: 'foo/bar',
      });
      gomod.updateDependency.mockReturnValue('some new content');
      gomod.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'go.mod',
            contents: 'some content',
          },
          notice: {
            file: 'go.mod',
            message: 'some notice',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toEqual({
        artifactErrors: [],
        artifactNotices: [
          {
            file: 'go.mod',
            message: 'some notice',
          },
        ],
        reuseExistingBranch: false,
        updatedArtifacts: [
          {
            contents: 'some content',
            path: 'go.mod',
            type: 'addition',
          },
        ],
        updatedPackageFiles: [
          {
            contents: 'some new content',
            path: 'go.mod',
            type: 'addition',
          },
        ],
      });
    });

    it('handles lockFileMaintenance', async () => {
      config.upgrades.push({
        manager: 'composer',
        updateType: 'lockFileMaintenance',
        branchName: 'some-branch',
      } satisfies BranchUpgradeConfig);
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.json',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'composer.json',
            contents: 'some contents',
          },
        ],
      });
    });

    it('for updatedArtifacts passes proper lockFiles', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
      });
      config.lockFiles = ['different.lock'];
      config.packageFiles = {
        composer: [
          {
            packageFile: 'composer.json',
            lockFiles: ['composer.lock'],
            deps: [],
          },
        ] satisfies PackageFile[],
      };
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some contents',
          },
        },
      ]);
      await getUpdatedPackageFiles(config);
      expect(composer.updateArtifacts).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          config: expect.objectContaining({
            lockFiles: ['composer.lock'],
          }),
        }),
      );
    });

    it('for nonUpdatedArtifacts passes proper lockFiles', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        isLockfileUpdate: true,
      });
      composer.updateLockedDependency.mockReturnValueOnce({
        status: 'unsupported',
      });
      config.lockFiles = ['different.lock'];
      config.packageFiles = {
        composer: [
          {
            packageFile: 'composer.json',
            lockFiles: ['composer.lock'],
            deps: [],
          },
        ] satisfies PackageFile[],
      };
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some contents',
          },
        },
      ]);
      await getUpdatedPackageFiles(config);
      expect(composer.updateArtifacts).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          config: expect.objectContaining({
            lockFiles: ['composer.lock'],
          }),
        }),
      );
    });

    it('for lockFileMaintenance passes proper lockFiles', async () => {
      config.upgrades.push({
        manager: 'composer',
        updateType: 'lockFileMaintenance',
        packageFile: 'composer.json',
        branchName: 'some-branch',
      } satisfies BranchUpgradeConfig);
      config.lockFiles = ['different.lock'];
      config.packageFiles = {
        composer: [
          {
            packageFile: 'composer.json',
            lockFiles: ['composer.lock'],
            deps: [],
          },
        ] satisfies PackageFile[],
      };
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.json',
            contents: 'some contents',
          },
        },
      ]);
      await getUpdatedPackageFiles(config);
      expect(composer.updateArtifacts).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          config: expect.objectContaining({
            lockFiles: ['composer.lock'],
          }),
        }),
      );
    });

    it('handles isRemediation success', async () => {
      config.upgrades.push({
        manager: 'npm',
        lockFile: 'package-lock.json',
        isRemediation: true,
        branchName: 'some-branch',
      } satisfies BranchUpgradeConfig);
      npm.updateLockedDependency.mockResolvedValueOnce({
        status: 'updated',
        files: { 'package-lock.json': 'new contents' },
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'package-lock.json',
            contents: 'new contents',
          },
        ],
      });
    });

    it('handles unsupported isRemediation', async () => {
      config.upgrades.push({
        manager: 'npm',
        lockFile: 'package-lock.json',
        isRemediation: true,
        branchName: 'some-branch',
      } satisfies BranchUpgradeConfig);
      npm.updateLockedDependency.mockResolvedValueOnce({
        status: 'unsupported',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchInlineSnapshot(`
        {
          "artifactErrors": [],
          "artifactNotices": [],
          "reuseExistingBranch": undefined,
          "updatedArtifacts": [],
          "updatedPackageFiles": [],
        }
      `);
    });

    it('handles isRemediation rebase', async () => {
      config.upgrades.push({
        manager: 'npm',
        isRemediation: true,
        branchName: 'some-branch',
      } satisfies BranchUpgradeConfig);
      config.reuseExistingBranch = true;
      git.getFile.mockResolvedValueOnce('existing content');
      npm.updateLockedDependency.mockResolvedValue({
        status: 'updated',
        files: { 'package-lock.json': 'new contents' },
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'package-lock.json',
            contents: 'new contents',
          },
        ],
      });
    });

    it('handles lockFileMaintenance error', async () => {
      config.upgrades.push({
        manager: 'composer',
        updateType: 'lockFileMaintenance',
        branchName: 'some-branch',
      } satisfies BranchUpgradeConfig);
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          artifactError: {
            fileName: 'composer.lock',
            stderr: 'some error',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        artifactErrors: [{ fileName: 'composer.lock', stderr: 'some error' }],
      });
    });

    it('handles lock file errors', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        manager: 'composer',
        packageFile: 'composer.json',
        branchName: '',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          artifactError: {
            fileName: 'composer.lock',
            stderr: 'some error',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        artifactErrors: [{ fileName: 'composer.lock', stderr: 'some error' }],
      });
    });

    it('handles git submodules', async () => {
      config.upgrades.push({
        packageFile: '.gitmodules',
        manager: 'git-submodules',
        datasource: GitRefsDatasource.id,
        branchName: 'some-branch',
      } satisfies BranchUpgradeConfig);
      gitSubmodules.updateDependency.mockResolvedValueOnce('existing content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: '.gitmodules',
            contents: 'existing content',
          },
        ],
      });
    });

    /*
     * The pip-compile manager uses lock files, the regex manager does not.
     * Verify pip-compile updates the lock files even if the same dependency
     * is also updated by the regex manager in the same branch.
     * Cf. #34015.
     */
    it('updates lock files in mixed-manager scenarios', async () => {
      const branchName = 'renovate/wheel-0.x';
      const updateType = 'patch';
      const depName = 'wheel';
      const packageName = depName;
      const currentVersion = '0.45.0';
      const lockedVersion = '0.45.0';
      const newVersion = '0.45.1';
      const currentRegexValue = currentVersion;
      const currentPipCompileValue = '==0.45.0';
      const newRegexValue = newVersion;
      const newPipCompileValue = '==0.45.1';

      const packageFileA = 'requirements-a.in';
      const lockFileA = 'requirements-a.txt';
      const packageFileB = 'requirements-b.in';
      const lockFileB = 'requirements-b.txt';

      const regexWheelLookup: LookupUpdate = {
        newVersion,
        newValue: newRegexValue,
        updateType,
        branchName,
      };
      const regexWheelDep = {
        depName,
        packageName,
        currentVersion,
        currentValue: currentVersion,
        updates: [regexWheelLookup],
      };
      const pipCompileWheelLookup: LookupUpdate = {
        ...regexWheelLookup,
        newValue: newPipCompileValue,
      };
      const pipCompileWheelDep = {
        ...regexWheelDep,
        currentValue: currentPipCompileValue,
        lockedVersion,
        updates: [pipCompileWheelLookup],
      };

      config.manager = 'regex';
      config.branchName = branchName;
      config.upgrades.push({
        packageFile: 'README.adoc',
        manager: 'regex',
        updateType,
        depName,
        currentValue: currentRegexValue,
        newVersion,
        branchName,
      });
      config.upgrades.push({
        packageFile: packageFileA,
        lockFiles: [lockFileA],
        manager: 'pip-compile',
        updateType,
        depName,
        currentValue: currentPipCompileValue,
        newVersion,
        branchName,
      });
      config.upgrades.push({
        packageFile: packageFileB,
        lockFiles: [lockFileB],
        manager: 'pip-compile',
        updateType,
        depName,
        currentValue: currentPipCompileValue,
        newVersion,
        branchName,
      });

      config.packageFiles = {
        'pip-compile': [
          {
            packageFile: packageFileA,
            lockFiles: [lockFileA],
            deps: [pipCompileWheelDep],
          },
          {
            packageFile: packageFileB,
            lockFiles: [lockFileB],
            deps: [pipCompileWheelDep],
          },
        ],
        regex: [
          {
            packageFile: 'README.adoc',
            deps: [regexWheelDep],
          },
        ],
      };

      pipCompile.updateArtifacts.mockResolvedValue([]);
      autoReplace.doAutoReplace.mockResolvedValue('new content');

      await getUpdatedPackageFiles(config);

      const expectPipCompilePackageAndLockFile = (
        expectedPackageFileName: string,
        expectedLockFileName: string,
      ) => {
        expect(pipCompile.updateArtifacts).toSatisfy(
          (updateArtifactsSpy) => {
            return updateArtifactsSpy.mock.calls.some((args: any[]) => {
              const updateArtifact: UpdateArtifact = args[0];
              const updateArtifactLockfiles = updateArtifact?.config?.lockFiles;
              return (
                updateArtifact?.packageFileName === expectedPackageFileName &&
                isArray(updateArtifactLockfiles) &&
                updateArtifactLockfiles?.length === 1 &&
                updateArtifactLockfiles?.[0] === expectedLockFileName
              );
            });
          },
          `pipCompile.updateArtifacts() must be called for package file ${expectedPackageFileName}` +
            ` and with lock file ${expectedLockFileName}`,
        );
      };

      expectPipCompilePackageAndLockFile(packageFileA, lockFileA);
      expectPipCompilePackageAndLockFile(packageFileB, lockFileB);
    });

    it('update artifacts on update-lockfile strategy', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        isLockfileUpdate: true,
      });
      composer.updateLockedDependency.mockReturnValueOnce({
        status: 'unsupported',
      });
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some contents',
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'composer.json',
            contents: 'existing content',
          },
        ],
      });
    });

    it('update artifacts on update-lockfile strategy with no updateLockedDependency', async () => {
      config.upgrades.push({
        packageFile: 'abc.tf',
        manager: 'batect-wrapper',
        branchName: '',
        isLockfileUpdate: true,
      });
      batectWrapper.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'terraform.lock',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'terraform.lock',
            contents: 'some contents',
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'abc.tf',
            contents: 'existing content',
          },
        ],
      });
    });

    it('does not update artifacts when skipArtifactsUpdate=true', async () => {
      const branchName = 'renovate/wheel-0.x';
      const updateType = 'patch';
      const lockedVersion = '0.45.0';
      const newVersion = '0.45.1';
      const currentValue = '==0.45.0';
      const newRegexValue = newVersion;
      const newValue = '==0.45.1';

      const packageFile = 'requirements.in';
      const lockFile = 'requirements.txt';

      const regexWheelLookup: LookupUpdate = {
        newVersion,
        newValue: newRegexValue,
        updateType,
        branchName,
      };

      const pipCompileWheelLookup: LookupUpdate = {
        ...regexWheelLookup,
        newValue,
      };
      const pipCompileWheelDep = {
        currentValue,
        lockedVersion,
        updates: [pipCompileWheelLookup],
      };

      config.manager = 'pip-compile';
      config.branchName = branchName;
      config.skipArtifactsUpdate = true;
      config.upgrades.push({
        packageFile,
        lockFiles: [lockFile],
        manager: 'pip-compile',
        updateType,
        depName: 'alpha',
        currentValue,
        newVersion,
        branchName,
      });
      config.upgrades.push({
        packageFile,
        lockFiles: [lockFile],
        manager: 'pip-compile',
        updateType,
        depName: 'beta',
        currentValue,
        newVersion,
        branchName,
      });

      config.packageFiles = {
        'pip-compile': [
          {
            packageFile,
            lockFiles: [lockFile],
            deps: [pipCompileWheelDep],
          },
        ],
      };

      pipCompile.updateArtifacts.mockResolvedValue([]);
      autoReplace.doAutoReplace.mockResolvedValue('new content');

      await getUpdatedPackageFiles(config);

      expect(pipCompile.updateArtifacts).not.toHaveBeenCalled();
    });

    it.each([false, undefined])(
      'updates artifacts when skipArtifactsUpdate=$0',
      async (skipArtifactsUpdate) => {
        const branchName = 'renovate/wheel-0.x';
        const updateType = 'patch';
        const lockedVersion = '0.45.0';
        const newVersion = '0.45.1';
        const currentValue = '==0.45.0';
        const newRegexValue = newVersion;
        const newValue = '==0.45.1';

        const packageFile = 'requirements.in';
        const lockFile = 'requirements.txt';

        const regexWheelLookup: LookupUpdate = {
          newVersion,
          newValue: newRegexValue,
          updateType,
          branchName,
        };

        const pipCompileWheelLookup: LookupUpdate = {
          ...regexWheelLookup,
          newValue,
        };
        const pipCompileWheelDep = {
          currentValue,
          lockedVersion,
          updates: [pipCompileWheelLookup],
        };

        config.manager = 'pip-compile';
        config.branchName = branchName;
        config.skipArtifactsUpdate = skipArtifactsUpdate;
        config.upgrades.push({
          packageFile,
          lockFiles: [lockFile],
          manager: 'pip-compile',
          updateType,
          depName: 'alpha',
          currentValue,
          newVersion,
          branchName,
        });
        config.upgrades.push({
          packageFile,
          lockFiles: [lockFile],
          manager: 'pip-compile',
          updateType,
          depName: 'beta',
          currentValue,
          newVersion,
          branchName,
        });

        config.packageFiles = {
          'pip-compile': [
            {
              packageFile,
              lockFiles: [lockFile],
              deps: [pipCompileWheelDep],
            },
          ],
        };

        pipCompile.updateArtifacts.mockResolvedValue([]);
        autoReplace.doAutoReplace.mockResolvedValue('new content');

        await getUpdatedPackageFiles(config);

        expect(pipCompile.updateArtifacts).toHaveBeenCalledTimes(1);
      },
    );

    it('attempts updateLockedDependency and handles unsupported', async () => {
      config.upgrades.push({
        packageFile: 'package.json',
        lockFiles: ['package-lock.json'],
        manager: 'npm',
        branchName: '',
        isLockfileUpdate: true,
      });
      npm.updateLockedDependency.mockResolvedValue({
        status: 'unsupported',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchInlineSnapshot(`
        {
          "artifactErrors": [],
          "artifactNotices": [],
          "reuseExistingBranch": undefined,
          "updatedArtifacts": [],
          "updatedPackageFiles": [],
        }
      `);
    });

    it('attempts updateLockedDependency and handles already-updated', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'package.json',
        lockFile: 'package-lock.json',
        manager: 'npm',
        branchName: '',
        isLockfileUpdate: true,
      });
      npm.updateLockedDependency.mockResolvedValueOnce({
        status: 'already-updated',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchInlineSnapshot(`
        {
          "artifactErrors": [],
          "artifactNotices": [],
          "reuseExistingBranch": false,
          "updatedArtifacts": [],
          "updatedPackageFiles": [],
        }
      `);
    });

    it('attempts updateLockedDependency and handles updated files with reuse branch', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'package.json',
        lockFile: 'package-lock.json',
        manager: 'npm',
        branchName: '',
        isLockfileUpdate: true,
      });
      git.getFile.mockResolvedValue('some content');
      npm.updateLockedDependency.mockResolvedValue({
        status: 'updated',
        files: {},
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchInlineSnapshot(`
        {
          "artifactErrors": [],
          "artifactNotices": [],
          "reuseExistingBranch": false,
          "updatedArtifacts": [],
          "updatedPackageFiles": [],
        }
      `);
    });

    it('bumps versions in updateDependency managers', async () => {
      config.upgrades.push({
        packageFile: 'package.json',
        branchName: '',
        bumpVersion: 'patch',
        manager: 'npm',
        packageFileVersion: 'old version',
      });
      npm.updateDependency.mockReturnValue('old version');
      npm.bumpPackageVersion.mockReturnValue({ bumpedContent: 'new version' });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'package.json',
            contents: 'new version',
          },
        ],
      });
    });

    it('bumps versions in autoReplace managers', async () => {
      config.upgrades.push({
        packageFile: 'Chart.yaml',
        branchName: '',
        bumpVersion: 'patch',
        manager: 'helmv3',
        packageFileVersion: '0.0.1',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('version: 0.0.1');
      helmv3.bumpPackageVersion.mockReturnValue({
        bumpedContent: 'version: 0.0.2',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'Chart.yaml',
            contents: 'version: 0.0.2',
          },
        ],
      });
    });

    it('handles replacement', async () => {
      config.upgrades.push({
        packageFile: 'index.html',
        manager: 'html',
        updateType: 'replacement',
        branchName: undefined!,
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('my-new-dep:1.0.0');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchObject({
        updatedPackageFiles: [
          { path: 'index.html', contents: 'my-new-dep:1.0.0' },
        ],
      });
    });

    it('handles package files updated by multiple managers', async () => {
      config.upgrades.push({
        packageFile: 'pyproject.toml',
        manager: 'poetry',
        branchName: '',
      });
      config.upgrades.push({
        packageFile: 'pyproject.toml',
        manager: 'pep621',
        branchName: '',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('my-new-dep:1.0.0');
      autoReplace.doAutoReplace.mockResolvedValueOnce('my-new-dep:1.0.0');

      await getUpdatedPackageFiles(config);

      expect(pep621.updateArtifacts).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          packageFileName: 'pyproject.toml',
          newPackageFileContent: 'my-new-dep:1.0.0',
          config: expect.objectContaining({
            upgrades: expect.arrayContaining([
              expect.objectContaining({
                packageFile: 'pyproject.toml',
                manager: 'pep621',
              }),
            ]),
          }),
        }),
      );
      expect(poetry.updateArtifacts).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          packageFileName: 'pyproject.toml',
          newPackageFileContent: 'my-new-dep:1.0.0',
          config: expect.objectContaining({
            upgrades: expect.arrayContaining([
              expect.objectContaining({
                packageFile: 'pyproject.toml',
                manager: 'poetry',
              }),
            ]),
          }),
        }),
      );
    });

    describe('when some artifacts have changed and others have not', () => {
      const pushGemUpgrade = (opts: Partial<BranchUpgradeConfig>) =>
        config.upgrades.push({
          packageFile: 'Gemfile',
          lockFiles: ['Gemfile.lock'],
          branchName: '',
          manager: 'bundler',
          ...opts,
        });

      const mockUpdated = () => {
        bundler.updateLockedDependency.mockReturnValueOnce({
          status: 'updated',
          files: { Gemfile: 'new contents' },
        });
      };

      const mockUnsupported = () => {
        bundler.updateLockedDependency.mockReturnValueOnce({
          status: 'unsupported',
        });
      };

      beforeEach(() => {
        git.getFile.mockResolvedValue('existing content');
      });

      describe('updated lockfile + unsupported lockfile', () => {
        it('only writes changed contents', async () => {
          pushGemUpgrade({ depName: 'flipper', isLockfileUpdate: true });
          mockUpdated();

          pushGemUpgrade({ depName: 'flipper-redis', isLockfileUpdate: true });
          mockUnsupported();

          await getUpdatedPackageFiles(config);
          expect(bundler.updateArtifacts).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ newPackageFileContent: 'new contents' }),
          );
        });
      });

      describe('unsupported lockfile + updated lockfile', () => {
        it('only writes changed contents', async () => {
          pushGemUpgrade({ depName: 'flipper', isLockfileUpdate: true });
          mockUnsupported();

          pushGemUpgrade({ depName: 'flipper-redis', isLockfileUpdate: true });
          mockUpdated();

          await getUpdatedPackageFiles(config);
          expect(bundler.updateArtifacts).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ newPackageFileContent: 'new contents' }),
          );
        });
      });

      describe('lockfile update + non-lockfile update', () => {
        it('only writes changed contents', async () => {
          pushGemUpgrade({ depName: 'flipper', isLockfileUpdate: true });
          pushGemUpgrade({
            depName: 'flipper-redis',
            currentValue: "'~> 0.22.2'",
            newVersion: '0.25.4',
          });
          const newContent = "gem 'flipper-redis', '~> 0.25.0'";
          autoReplace.doAutoReplace.mockResolvedValueOnce(newContent);
          mockUnsupported();
          await getUpdatedPackageFiles(config);
          expect(bundler.updateArtifacts).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ newPackageFileContent: newContent }),
          );
        });
      });

      describe('non-lockfile update + lockfile update', () => {
        it('only writes changed contents', async () => {
          pushGemUpgrade({
            depName: 'flipper-redis',
            currentValue: "'~> 0.22.2'",
            newVersion: '0.25.4',
          });
          pushGemUpgrade({ depName: 'flipper', isLockfileUpdate: true });
          const newContent = "gem 'flipper-redis', '~> 0.25.0'";
          autoReplace.doAutoReplace.mockResolvedValueOnce(newContent);
          mockUnsupported();
          await getUpdatedPackageFiles(config);
          expect(bundler.updateArtifacts).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ newPackageFileContent: newContent }),
          );
        });
      });

      describe('remediation update + lockfile unsupported update', () => {
        it('only writes changed contents', async () => {
          pushGemUpgrade({
            depName: 'flipper-redis',
            currentValue: "'~> 0.22.2'",
            newVersion: '0.25.4',
            isRemediation: true,
          });
          mockUpdated();

          pushGemUpgrade({ depName: 'flipper', isLockfileUpdate: true });
          mockUnsupported();

          await getUpdatedPackageFiles(config);
          expect(bundler.updateArtifacts).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ newPackageFileContent: 'new contents' }),
          );
        });
      });

      describe('lockfile unsupported update + remediation update', () => {
        it('only writes changed contents', async () => {
          pushGemUpgrade({ depName: 'flipper', isLockfileUpdate: true });
          mockUnsupported();

          pushGemUpgrade({
            depName: 'flipper-redis',
            currentValue: "'~> 0.22.2'",
            newVersion: '0.25.4',
            isRemediation: true,
          });
          mockUpdated();

          await getUpdatedPackageFiles(config);
          expect(bundler.updateArtifacts).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ newPackageFileContent: 'new contents' }),
          );
        });
      });

      it('passes package files to updateArtifacts in the same order they were returned by the manager', async () => {
        config.upgrades.push({
          packageFile: 'requirements-dev.in',
          manager: 'pip-compile',
          updateType: 'replacement',
          depName: 'awscli',
          currentValue: '==1.32.86',
          newVersion: '1.32.92',
          branchName: 'renovate/aws-packages',
        });
        config.upgrades.push({
          packageFile: 'requirements.in',
          manager: 'pip-compile',
          updateType: 'replacement',
          depName: 'botocore',
          currentValue: '==1.34.86',
          newVersion: '1.34.92',
          branchName: 'renovate/aws-packages',
        });
        config.packageFiles = {
          'pip-compile': [
            {
              packageFile: 'requirement.in',
              deps: [],
            },
            {
              packageFile: 'requirements-dev.in',
              deps: [],
            },
          ],
        };

        pipCompile.updateArtifacts.mockResolvedValue([]);
        autoReplace.doAutoReplace.mockResolvedValue('new content');

        await getUpdatedPackageFiles(config);

        expect(pipCompile.updateArtifacts).toHaveBeenCalledTimes(2);
        expect(pipCompile.updateArtifacts).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ packageFileName: 'requirements.in' }),
        );
        expect(pipCompile.updateArtifacts).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ packageFileName: 'requirements-dev.in' }),
        );
      });
    });
  });

  // As per #41622
  describe('checks if an artifact update introduces a pending version', () => {
    let config: BranchConfig;

    beforeEach(() => {
      config = {
        baseBranch: 'base-branch',
        manager: 'some-manager',
        branchName: 'renovate/pin',
        upgrades: [],
        minimumReleaseAgeBehaviour: 'timestamp-required',
      } satisfies BranchConfig;
      git.getFile.mockResolvedValueOnce('existing content');
    });

    describe('when artifact update introduces a pending version', () => {
      it('logs an artifact error', async () => {
        config.upgrades.push({
          packageFile: 'composer.json',
          manager: 'composer',
          branchName: '',
          depName: 'some-dep',
          newVersion: '1.2.3',
          pendingVersions: ['1.3.0', '1.4.0'],
        });
        autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
        composer.updateArtifacts.mockResolvedValueOnce([
          {
            file: {
              type: 'addition',
              path: 'composer.lock',
              contents: 'some lock contents',
            },
          },
        ]);
        composer.extractPackageFile.mockResolvedValueOnce({
          deps: [
            {
              depName: 'some-dep',
              lockedVersion: '1.3.0',
            },
          ],
        });
        const res = await getUpdatedPackageFiles(config);
        expect(res.artifactErrors).toHaveLength(1);
        expect(res.artifactErrors[0]).toMatchObject({
          fileName: 'composer.json',
          stderr: expect.stringContaining('1.3.0'),
        });
        expect(res.artifactErrors[0].stderr).toContain(
          'Artifact update for some-dep resolved to version 1.3.0, which is a pending version that has not yet passed the Minimum Release Age threshold.\nRenovate was attempting to update to 1.2.3\nThis is (likely) not a bug in Renovate, but due to the way your project pins dependencies, _and_ how Renovate calls your package manager to update them.\nUntil Renovate supports specifying an exact update to your package manager (https://github.com/renovatebot/renovate/issues/41624), it is recommended to directly pin your dependencies (with `rangeStrategy=pin` for apps, or `rangeStrategy=widen` for libraries)\nSee also: https://docs.renovatebot.com/dependency-pinning/',
        );
      });

      // TODO doesn't fire for **??**

      it.each<{
        description: string;
        dep: PackageDependency;
      }>([
        {
          description: 'detects lockedVersion',
          dep: {
            depName: 'some-dep',
            lockedVersion: '1.3.0',
          },
        },
        {
          description: 'detects newVersion',
          dep: {
            depName: 'some-dep',
            newVersion: '1.3.0',
          },
        },
        {
          description: 'detects currentVersion',
          dep: {
            depName: 'some-dep',
            currentVersion: '1.3.0',
          },
        },
        {
          description: 'detects currentValue',
          dep: {
            depName: 'some-dep',
            currentValue: '1.3.0',
          },
        },
      ])(`$description`, async ({ dep }) => {
        config.upgrades.push({
          packageFile: 'composer.json',
          manager: 'composer',
          branchName: '',
          depName: 'some-dep',
          newVersion: '1.2.3',
          pendingVersions: ['1.3.0', '1.4.0'],
        });
        autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
        composer.updateArtifacts.mockResolvedValueOnce([
          {
            file: {
              type: 'addition',
              path: 'composer.lock',
              contents: 'some lock contents',
            },
          },
        ]);
        composer.extractPackageFile.mockResolvedValueOnce({
          deps: [dep],
        });
        const res = await getUpdatedPackageFiles(config);
        expect(res.artifactErrors).toHaveLength(1);
        expect(res.artifactErrors[0]).toMatchObject({
          fileName: 'composer.json',
          stderr: expect.stringContaining('1.3.0'),
        });
      });
    });

    it('does not add artifact error when no deps match pending versions', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: '1.2.3',
        pendingVersions: ['1.3.0', '1.4.0'],
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some lock contents',
          },
        },
      ]);
      composer.extractPackageFile.mockResolvedValueOnce({
        deps: [
          {
            depName: 'some-dep',
            currentVersion: '1.2.5',
          },
        ],
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res.artifactErrors).toHaveLength(0);
    });

    it('does not add artifact error when a different dependency has the same version as the pending version', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: '1.2.3',
        pendingVersions: ['1.2.5'],
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some lock contents',
          },
        },
      ]);
      composer.extractPackageFile.mockResolvedValueOnce({
        deps: [
          {
            depName: 'some-dep',
            currentVersion: '1.2.3',
          },
          {
            depName: 'transitive-dep',
            currentVersion: '1.2.5',
          },
        ],
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res.artifactErrors).toHaveLength(0);
    });

    it('skips pending version check when upgrade has no pendingVersions', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: '1.2.3',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some lock contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res.artifactErrors).toHaveLength(0);
      expect(composer.extractPackageFile).not.toHaveBeenCalled();
    });

    it('skips pending version check when no artifact results', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: '1.2.3',
        pendingVersions: ['1.3.0'],
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([]);
      const res = await getUpdatedPackageFiles(config);
      expect(res.artifactErrors).toHaveLength(0);
      expect(composer.extractPackageFile).not.toHaveBeenCalled();
    });

    it('does not add artifact error when extractPackageFile returns null', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: '1.2.3',
        pendingVersions: ['1.3.0'],
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some lock contents',
          },
        },
      ]);
      composer.extractPackageFile.mockResolvedValueOnce(null);
      const res = await getUpdatedPackageFiles(config);
      expect(res.artifactErrors).toHaveLength(0);
    });

    it('adds multiple artifact errors when multiple deps match pending versions', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: '1.2.3',
        pendingVersions: ['1.3.0', '1.4.0'],
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some lock contents',
          },
        },
      ]);
      composer.extractPackageFile.mockResolvedValueOnce({
        deps: [
          {
            depName: 'some-dep',
            lockedVersion: '1.3.0',
          },
          {
            depName: 'some-dep',
            lockedVersion: '1.4.0',
          },
          {
            depName: 'dep-c',
            lockedVersion: '1.2.5',
          },
        ],
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res.artifactErrors).toHaveLength(2);
      expect(res.artifactErrors[0]).toMatchObject({
        stderr: expect.stringContaining('1.3.0'),
      });
      expect(res.artifactErrors[1]).toMatchObject({
        stderr: expect.stringContaining('1.4.0'),
      });
    });

    it('skips pending version check when minimumReleaseAgeBehaviour is not timestamp-required', async () => {
      config.minimumReleaseAgeBehaviour = 'timestamp-optional';
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: '1.2.3',
        pendingVersions: ['1.3.0'],
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some lock contents',
          },
        },
      ]);
      composer.extractPackageFile.mockResolvedValueOnce({
        deps: [
          {
            depName: 'some-dep',
            lockedVersion: '1.3.0',
          },
        ],
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res.artifactErrors).toHaveLength(0);
      expect(composer.extractPackageFile).toHaveBeenCalled();
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        {
          packageFileName: 'composer.json',
          depName: 'some-dep',
          expectedVersion: '1.2.3',
          resolvedVersion: '1.3.0',
        },
        "Artifact error would be reported due to a pending version in use which hasn't passed Minimum Release Age, but as we're running with minimumReleaseAgeBehaviour=timestamp-optional, proceeding. See debug logs for more information",
      );
    });

    it('adds logs a debug log if it fails to re-extract the package file', async () => {
      config.upgrades.push({
        packageFile: 'go.mod',
        manager: 'gomod',
        branchName: '',
        depName: 'github.com/foo/bar',
        newVersion: '0.5.1',
        pendingVersions: ['0.6.0'],
      });
      gomod.updateDependency.mockReturnValue('some new content');
      gomod.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'go.mod',
            contents: 'some content',
          },
        },
      ]);
      gomod.extractPackageFile.mockResolvedValueOnce(null);
      await getUpdatedPackageFiles(config);

      expect(logger.logger.warn).toHaveBeenCalledWith(
        { packageFile: 'go.mod', manager: 'gomod' },
        'Could not re-extract the packageFile after updating it',
      );
    });

    // should never happen, but our types allow this
    it('rejects when an updated dependency has no depName or packageName', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: '1.2.3',
        pendingVersions: ['1.3.0'],
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some lock contents',
          },
        },
      ]);
      composer.extractPackageFile.mockResolvedValueOnce({
        deps: [
          {
            depName: undefined,
            packageName: undefined,
            lockedVersion: '1.3.0',
          },
        ],
      });

      await expect(getUpdatedPackageFiles(config)).rejects.toThrowError(
        'update-failure',
      );

      expect(logger.logger.error).toHaveBeenCalledWith(
        {
          packageFile: 'composer.json',
          manager: 'composer',
          branchName: 'renovate/pin',
          depName: undefined,
        },
        "No depName found after updating 'composer.json'",
      );
    });

    it('adds an artifact error when an updated dependency has no depName, but does have a packageName', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: '1.2.3',
        pendingVersions: ['1.3.0'],
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some lock contents',
          },
        },
      ]);
      composer.extractPackageFile.mockResolvedValueOnce({
        deps: [
          {
            depName: undefined,
            packageName: 'some-dep',
            lockedVersion: '1.3.0',
          },
        ],
      });

      const res = await getUpdatedPackageFiles(config);
      expect(res.artifactErrors).toHaveLength(1);
      expect(res.artifactErrors[0]).toMatchObject({
        stderr: expect.stringContaining('some-dep'),
      });
    });

    // should never happen, but our types allow this
    it('rejects when an updated dependency has no new version', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: '1.2.3',
        pendingVersions: ['1.3.0'],
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some lock contents',
          },
        },
      ]);
      composer.extractPackageFile.mockResolvedValueOnce({
        deps: [
          {
            depName: 'some-dep',
            lockedVersion: undefined,
            newVersion: undefined,
            currentVersion: undefined,
            currentValue: undefined,
          },
        ],
      });

      await expect(getUpdatedPackageFiles(config)).rejects.toThrowError(
        'update-failure',
      );

      expect(logger.logger.error).toHaveBeenCalledWith(
        {
          packageFile: 'composer.json',
          manager: 'composer',
          branchName: 'renovate/pin',
          depName: 'some-dep',
          newVersion: undefined,
        },
        "No new version found for 'some-dep' after updating 'composer.json'",
      );
    });

    // should never happen, but our types allow this
    it('rejects when upgrade has no depName', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: 'renovate/pin',
        depName: undefined,
        newVersion: '5.6.7',
      });

      await expect(getUpdatedPackageFiles(config)).rejects.toThrowError(
        'update-failure',
      );
    });

    // should never happen, but our types allow this
    it('rejects when upgrade has no depName', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: undefined,
      });

      await expect(getUpdatedPackageFiles(config)).rejects.toThrowError(
        'update-failure',
      );
    });

    it('adds artifact error for nonUpdatedPackageFiles (lockfile update scenario)', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        depName: 'some-dep',
        newVersion: '1.2.3',
        pendingVersions: ['1.3.0'],
        isLockfileUpdate: true,
      });
      composer.updateLockedDependency.mockReturnValueOnce({
        status: 'unsupported',
      });
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some lock contents',
          },
        },
      ]);
      composer.extractPackageFile.mockResolvedValueOnce({
        deps: [
          {
            depName: 'some-dep',
            lockedVersion: '1.3.0',
          },
        ],
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res.artifactErrors).toHaveLength(1);
      expect(res.artifactErrors[0]).toMatchObject({
        fileName: 'composer.json',
        stderr: expect.stringContaining('1.3.0'),
      });
    });

    describe('customUpdateCommands', () => {
      it('skips auto-replace and uses executeCustomUpdateCommands when customUpdateCommands is set', async () => {
        config.upgrades.push({
          packageFile: 'backstage.json',
          manager: 'regex',
          branchName: '',
          depName: 'backstage/backstage',
          newValue: '1.2.3',
          customUpdateCommands: {
            commands: ['yarn backstage-cli versions:bump --release 1.2.3'],
          },
        });
        git.getFile.mockResolvedValueOnce('{"version":"1.0.0"}');
        executeUpdateCommandsMod.executeCustomUpdateCommands.mockResolvedValueOnce(
          {
            updatedPackageFiles: [
              {
                type: 'addition',
                path: 'backstage.json',
                contents: '{"version":"1.2.3"}',
              },
            ],
            updatedArtifacts: [
              {
                type: 'addition',
                path: 'yarn.lock',
                contents: 'updated lockfile',
              },
            ],
            artifactErrors: [],
          },
        );

        const res = await getUpdatedPackageFiles(config);

        expect(autoReplace.doAutoReplace).not.toHaveBeenCalled();
        expect(
          executeUpdateCommandsMod.executeCustomUpdateCommands,
        ).toHaveBeenCalledOnce();
        expect(res).toMatchObject({
          updatedPackageFiles: [{ path: 'backstage.json' }],
          updatedArtifacts: [{ path: 'yarn.lock' }],
          artifactErrors: [],
        });
      });

      it('forces rebase when reuseExistingBranch is true and customUpdateCommands is set', async () => {
        config.reuseExistingBranch = true;
        config.upgrades.push({
          packageFile: 'backstage.json',
          manager: 'regex',
          branchName: '',
          depName: 'backstage/backstage',
          newValue: '1.2.3',
          customUpdateCommands: {
            commands: ['yarn backstage-cli versions:bump --release 1.2.3'],
          },
        });
        git.getFile.mockResolvedValueOnce('{"version":"1.0.0"}');
        // Second call after rebase
        git.getFile.mockResolvedValueOnce('{"version":"1.0.0"}');
        executeUpdateCommandsMod.executeCustomUpdateCommands.mockResolvedValueOnce(
          {
            updatedPackageFiles: [],
            updatedArtifacts: [],
            artifactErrors: [],
          },
        );

        const res = await getUpdatedPackageFiles(config);

        // Should have been called with reuseExistingBranch: false after forced rebase
        expect(
          executeUpdateCommandsMod.executeCustomUpdateCommands,
        ).toHaveBeenCalledOnce();
        expect(res).toMatchObject({ reuseExistingBranch: false });
      });

      it('merges artifact errors from customUpdateCommands into final result', async () => {
        config.upgrades.push({
          packageFile: 'backstage.json',
          manager: 'regex',
          branchName: '',
          depName: 'backstage/backstage',
          newValue: '1.2.3',
          customUpdateCommands: {
            commands: ['disallowed-command'],
          },
        });
        git.getFile.mockResolvedValueOnce('{"version":"1.0.0"}');
        executeUpdateCommandsMod.executeCustomUpdateCommands.mockResolvedValueOnce(
          {
            updatedPackageFiles: [],
            updatedArtifacts: [],
            artifactErrors: [
              {
                fileName: 'backstage.json',
                stderr: 'command not in allowedCommands',
              },
            ],
          },
        );

        const res = await getUpdatedPackageFiles(config);

        expect(autoReplace.doAutoReplace).not.toHaveBeenCalled();
        expect(res).toMatchObject({
          artifactErrors: [{ fileName: 'backstage.json' }],
        });
      });

      it('uses customUpdateCommands for lockFileMaintenance instead of updateArtifacts', async () => {
        config.upgrades.push({
          packageFile: 'composer.json',
          manager: 'composer',
          branchName: '',
          updateType: 'lockFileMaintenance',
          customUpdateCommands: {
            commands: ['composer update'],
            fileFilters: ['composer.lock'],
          },
        } satisfies BranchUpgradeConfig);
        git.getFile.mockResolvedValueOnce('{"require":{}}');
        executeUpdateCommandsMod.executeCustomUpdateCommands.mockResolvedValueOnce(
          {
            updatedPackageFiles: [],
            updatedArtifacts: [
              {
                type: 'addition',
                path: 'composer.lock',
                contents: 'updated lockfile',
              },
            ],
            artifactErrors: [],
          },
        );

        const res = await getUpdatedPackageFiles(config);

        expect(
          executeUpdateCommandsMod.executeCustomUpdateCommands,
        ).toHaveBeenCalledOnce();
        expect(composer.updateArtifacts).not.toHaveBeenCalled();
        expect(res).toMatchObject({
          updatedArtifacts: [{ path: 'composer.lock' }],
          artifactErrors: [],
        });
      });

      it('forces rebase for lockFileMaintenance when reuseExistingBranch is true and customUpdateCommands is set', async () => {
        config.reuseExistingBranch = true;
        config.upgrades.push({
          packageFile: 'composer.json',
          manager: 'composer',
          branchName: '',
          updateType: 'lockFileMaintenance',
          customUpdateCommands: {
            commands: ['composer update'],
          },
        } satisfies BranchUpgradeConfig);
        git.getFile.mockResolvedValueOnce('{"require":{}}');
        // Second call after forced rebase
        git.getFile.mockResolvedValueOnce('{"require":{}}');
        executeUpdateCommandsMod.executeCustomUpdateCommands.mockResolvedValueOnce(
          {
            updatedPackageFiles: [],
            updatedArtifacts: [],
            artifactErrors: [],
          },
        );

        const res = await getUpdatedPackageFiles(config);

        expect(
          executeUpdateCommandsMod.executeCustomUpdateCommands,
        ).toHaveBeenCalledOnce();
        expect(res).toMatchObject({ reuseExistingBranch: false });
      });

      it('falls through to normal lockFileMaintenance when customUpdateCommands is not set', async () => {
        config.upgrades.push({
          manager: 'composer',
          updateType: 'lockFileMaintenance',
          branchName: 'some-branch',
        } satisfies BranchUpgradeConfig);
        composer.updateArtifacts.mockResolvedValueOnce([
          {
            file: {
              type: 'addition',
              path: 'composer.lock',
              contents: 'some contents',
            },
          },
        ]);

        await getUpdatedPackageFiles(config);

        expect(composer.updateArtifacts).toHaveBeenCalledOnce();
        expect(
          executeUpdateCommandsMod.executeCustomUpdateCommands,
        ).not.toHaveBeenCalled();
      });
    });
  });
});
