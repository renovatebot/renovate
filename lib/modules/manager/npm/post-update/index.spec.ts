// TODO: add tests
import upath from 'upath';
import { Fixtures } from '../../../../../test/fixtures';
import { fs, git, logger, partial } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { FileChange } from '../../../../util/git/types';
import type { PostUpdateConfig } from '../../types';
import * as lerna from './lerna';
import * as npm from './npm';
import * as pnpm from './pnpm';
import type { AdditionalPackageFiles } from './types';
import * as yarn from './yarn';
import {
  determineLockFileDirs,
  getAdditionalFiles,
  updateYarnBinary,
  writeExistingFiles,
  writeUpdatedPackageFiles,
} from './';

jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');
jest.mock('./lerna');
jest.mock('./npm');
jest.mock('./yarn');
jest.mock('./pnpm');

describe('modules/manager/npm/post-update/index', () => {
  let baseConfig: PostUpdateConfig;
  let updateConfig: PostUpdateConfig;
  const additionalFiles: AdditionalPackageFiles = {
    npm: [
      { packageFile: 'dummy.txt' },
      {
        packageFile: 'packages/core/package.json',
        managerData: {
          lernaJsonFile: 'lerna.json',
        },
        npmLock: 'package-lock.json',
        npmrc: '#dummy',
      },
      {
        packageFile: 'packages/cli/package.json',
        managerData: {
          lernaJsonFile: 'lerna.json',
        },
        yarnLock: 'yarn.lock',
      },
      {
        packageFile: 'packages/test/package.json',
        yarnLock: 'yarn.lock',
      },
      {
        packageFile: 'packages/pnpm/package.json',
        pnpmShrinkwrap: 'packages/pnpm/pnpm-lock.yaml',
      },
    ],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    GlobalConfig.set({ localDir: '' });
    baseConfig = partial<PostUpdateConfig>({
      upgrades: [],
    });
    updateConfig = {
      ...baseConfig,
      upgrades: [
        {
          isRemediation: true,
        },
        {
          depName: 'postcss',
          isRemediation: true,
          managerData: {
            lernaJsonFile: 'lerna.json',
          },
          npmLock: 'package-lock.json',
          rangeStrategy: 'widen',
        },
        {
          depName: 'core-js',
          isRemediation: true,
          managerData: {
            lernaJsonFile: 'lerna.json',
          },
          npmLock: 'randomFolder/package-lock.json',
          lockFiles: ['randomFolder/package-lock.json'],
          rangeStrategy: 'pin',
        },
        {
          isLockfileUpdate: true,
          npmLock: 'package-lock.json',
        },
        {
          yarnLock: 'yarn.lock',
          isLockfileUpdate: true,
        },
      ],
      updatedPackageFiles: [
        {
          type: 'addition',
          path: 'dummy.txt',
          contents: '',
        },
        {
          type: 'deletion',
          path: 'some.txt',
        },
        {
          type: 'addition',
          path: 'package-lock.json',
          contents: '{}',
        },
        {
          type: 'addition',
          path: 'yarn.lock',
          contents: '{}',
        },
        {
          type: 'addition',
          path: 'packages/pnpm/pnpm-lock.yaml',
          contents: '',
        },
        {
          type: 'addition',
          path: 'packages/core/package.json',
          contents: '{}',
        },
        {
          type: 'addition',
          path: 'packages/cli/package.json',
          contents: '{}',
        },
        {
          type: 'addition',
          path: 'packages/pnpm/package.json',
          contents: '{}',
        },
        {
          type: 'addition',
          path: 'package.json',
          contents: '{}',
        },
      ],
    };

    // reset mocked version
    fs.getParentDir.mockImplementation((p) => upath.parse(p).dir);
  });

  describe('determineLockFileDirs()', () => {
    it('works', () => {
      expect(
        determineLockFileDirs(
          updateConfig,

          additionalFiles
        )
      ).toStrictEqual({
        lernaJsonFiles: ['lerna.json'],
        npmLockDirs: ['package-lock.json'],
        pnpmShrinkwrapDirs: ['packages/pnpm/pnpm-lock.yaml'],
        yarnLockDirs: ['yarn.lock'],
      });
    });

    it('lockfile maintenance', () => {
      expect(
        determineLockFileDirs(
          {
            ...baseConfig,
            upgrades: [
              {
                isLockfileUpdate: true,
                yarnLock: 'yarn.lock',
              },
            ],
          },
          {}
        )
      ).toStrictEqual({
        lernaJsonFiles: [],
        npmLockDirs: [],
        pnpmShrinkwrapDirs: [],
        yarnLockDirs: ['yarn.lock'],
      });
    });
  });

  describe('writeExistingFiles()', () => {
    it('works', async () => {
      git.getFile.mockResolvedValueOnce(
        Fixtures.get('update-lockfile-massage-1/package-lock.json')
      );
      await expect(
        writeExistingFiles(updateConfig, additionalFiles)
      ).resolves.toBeUndefined();

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      expect(fs.deleteLocalFile).not.toHaveBeenCalled();
      expect(git.getFile).toHaveBeenCalledOnce();
    });

    it('works no reuse lockfiles', async () => {
      await expect(
        writeExistingFiles(
          { ...updateConfig, reuseLockFiles: false },
          additionalFiles
        )
      ).resolves.toBeUndefined();

      expect(fs.writeLocalFile).toHaveBeenCalledOnce();
      expect(fs.deleteLocalFile.mock.calls).toEqual([
        ['package-lock.json'],
        ['yarn.lock'],
        ['yarn.lock'],
        ['packages/pnpm/pnpm-lock.yaml'],
      ]);
    });

    it('works only on relevant folders', async () => {
      git.getFile.mockResolvedValueOnce(
        Fixtures.get('update-lockfile-massage-1/package-lock.json')
      );
      await expect(
        writeExistingFiles(updateConfig, additionalFiles)
      ).resolves.toBeUndefined();

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      expect(fs.deleteLocalFile).not.toHaveBeenCalled();
      expect(git.getFile).toHaveBeenCalledOnce();
    });

    it('has no npm files', async () => {
      await expect(writeExistingFiles(baseConfig, {})).toResolve();
    });
  });

  describe('writeUpdatedPackageFiles()', () => {
    it('works', async () => {
      await writeUpdatedPackageFiles({
        ...updateConfig,
        upgrades: [{ gitRef: true }],
      });
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(6);
    });

    it('missing updated packages files', async () => {
      await expect(
        writeUpdatedPackageFiles(baseConfig)
      ).resolves.toBeUndefined();
      expect(fs.writeLocalFile).not.toHaveBeenCalled();
    });
  });

  describe('updateYarnBinary()', () => {
    const lockFileDir = `path/to/lockfile`;
    const oldYarnrcYml = `yarnPath: .yarn/releases/yarn-3.0.1.cjs\na: b\n`;
    const newYarnrcYml = `yarnPath: .yarn/releases/yarn-3.0.2.cjs\nc: d\n`;
    const newYarn = `new yarn\n`;

    it('should update the Yarn binary', async () => {
      git.getFile.mockResolvedValueOnce(oldYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarn);
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toMatchSnapshot();
    });

    it('should return .yarnrc.yml content if it has been overwritten', async () => {
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarn);
      const updatedArtifacts: FileChange[] = [];
      const existingYarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        oldYarnrcYml
      );
      expect(git.getFile).not.toHaveBeenCalled();
      expect(existingYarnrcYmlContent).toMatchSnapshot();
      expect(updatedArtifacts).toMatchSnapshot();
    });

    it("should not update the Yarn binary if the old .yarnrc.yml doesn't exist", async () => {
      git.getFile.mockResolvedValueOnce(null);
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toBeEmpty();
    });

    it("should not update the Yarn binary if the new .yarnrc.yml doesn't exist", async () => {
      git.getFile.mockResolvedValueOnce(oldYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toBeEmpty();
    });

    it("should return existing .yarnrc.yml if the new one doesn't exist", async () => {
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      const updatedArtifacts: FileChange[] = [];
      const existingYarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        oldYarnrcYml
      );
      expect(existingYarnrcYmlContent).toMatch(oldYarnrcYml);
      expect(updatedArtifacts).toBeEmpty();
    });

    it('should support Yarn with corepack', async () => {
      git.getFile.mockResolvedValueOnce('');
      fs.readLocalFile.mockResolvedValueOnce('');
      fs.readLocalFile.mockResolvedValueOnce('');
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        ''
      );
      expect(yarnrcYmlContent).toBe('');
      expect(updatedArtifacts).toEqual([]);
      expect(logger.logger.debug).not.toHaveBeenCalled();
      expect(logger.logger.error).not.toHaveBeenCalled();
    });
  });

  describe('getAdditionalFiles()', () => {
    const spyNpm = jest.spyOn(npm, 'generateLockFile');
    const spyLerna = jest.spyOn(lerna, 'generateLockFiles');
    const spyYarn = jest.spyOn(yarn, 'generateLockFile');
    const spyPnpm = jest.spyOn(pnpm, 'generateLockFile');

    beforeEach(() => {
      spyNpm.mockResolvedValue({});
      spyLerna.mockResolvedValue({});
      spyPnpm.mockResolvedValue({});
      spyYarn.mockResolvedValue({});
    });

    it('works', async () => {
      expect(
        await getAdditionalFiles(
          { ...updateConfig, updateLockFiles: true },
          additionalFiles
        )
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [],
      });
    });

    it('works for npm', async () => {
      spyNpm.mockResolvedValueOnce({ error: false, lockFile: '{}' });
      fs.readLocalFile.mockImplementation((f) => {
        if (f === '.npmrc') {
          return Promise.resolve('# dummy');
        }
        return Promise.resolve('');
      });
      expect(
        await getAdditionalFiles(
          { ...updateConfig, updateLockFiles: true, reuseExistingBranch: true },
          additionalFiles
        )
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'package-lock.json',
            contents: '{}',
          },
        ],
      });

      expect(fs.readLocalFile).toHaveBeenCalledWith('.npmrc', 'utf8');
      expect(fs.writeLocalFile).toHaveBeenCalledWith('.npmrc', '# dummy');
      expect(fs.deleteLocalFile.mock.calls).toMatchObject([
        ['packages/pnpm/.npmrc'],
      ]);
    });

    it('works for yarn', async () => {
      spyYarn.mockResolvedValueOnce({ error: false, lockFile: '{}' });
      expect(
        await getAdditionalFiles(
          { ...updateConfig, updateLockFiles: true, reuseExistingBranch: true },
          additionalFiles
        )
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: '{}',
          },
        ],
      });
      expect(fs.deleteLocalFile).toHaveBeenCalled();
    });

    it('works for pnpm', async () => {
      spyPnpm.mockResolvedValueOnce({
        error: false,
        lockFile: 'some-contents:',
      });
      expect(
        await getAdditionalFiles(
          {
            ...updateConfig,
            updateLockFiles: true,
            reuseExistingBranch: true,
            upgrades: [
              {
                isRemediation: true,
                packageFile: 'packages/pnpm/package.json',
              },
            ],
          },
          additionalFiles
        )
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'packages/pnpm/pnpm-lock.yaml',
            contents: 'some-contents:',
          },
        ],
      });
      expect(fs.deleteLocalFile).toHaveBeenCalled();
    });

    it('works for lerna (yarn)', async () => {
      git.getFile.mockImplementation((f) => {
        if (f === 'yarn.lock') {
          return Promise.resolve('# some contents');
        }
        return Promise.resolve(null);
      });
      expect(
        await getAdditionalFiles(
          {
            ...updateConfig,
            updateLockFiles: true,
            reuseExistingBranch: true,
            upgrades: [
              {
                isRemediation: true,
                packageFile: 'packages/core/package.json',
              },
            ],
          },
          additionalFiles
        )
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'packages/pnpm/pnpm-lock.yaml',
            contents: undefined,
          },
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: undefined,
          },
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: undefined,
          },
        ],
      });
      expect(fs.deleteLocalFile).toHaveBeenCalled();
    });

    it('works for lerna (npm)', async () => {
      git.getFile.mockImplementation((f) => {
        if (f === 'package-lock.json') {
          return Promise.resolve('{}');
        }
        return Promise.resolve(null);
      });
      expect(
        await getAdditionalFiles(
          {
            ...updateConfig,
            updateLockFiles: true,
            upgrades: [{}],
          },
          {
            npm: [
              {
                packageFile: 'package.json',
                managerData: {
                  lernaJsonFile: 'lerna.json',
                },
                npmLock: 'package-lock.json',
                lernaClient: 'npm',
              },
            ],
          }
        )
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'package-lock.json',
            contents: undefined,
          },
        ],
      });
      expect(fs.deleteLocalFile).toHaveBeenCalled();
    });

    it('no npm files', async () => {
      expect(await getAdditionalFiles(baseConfig, {})).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [],
      });
    });

    it('no lockfiles updates', async () => {
      expect(
        await getAdditionalFiles(baseConfig, additionalFiles)
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [],
      });
    });

    it('reuse existing up-to-date', async () => {
      expect(
        await getAdditionalFiles(
          {
            ...baseConfig,
            reuseExistingBranch: true,
            upgrades: [{ isLockfileUpdate: true }],
            updateLockFiles: true,
          },
          additionalFiles
        )
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [],
      });
    });

    it('lockfile maintenance branch exists', async () => {
      // TODO: can this really happen?
      git.branchExists.mockReturnValueOnce(true);
      expect(
        await getAdditionalFiles(
          {
            ...baseConfig,
            upgrades: [{ isLockfileUpdate: false }],
            reuseExistingBranch: true,
            updateType: 'lockFileMaintenance',
            updateLockFiles: true,
          },
          additionalFiles
        )
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [],
      });
    });

    it('skip transitive remediation', async () => {
      expect(
        await getAdditionalFiles(
          {
            ...baseConfig,
            upgrades: [{ isVulnerabilityAlert: true }],
            transitiveRemediation: true,
            updateLockFiles: true,
          },
          additionalFiles
        )
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [],
      });
    });

    it('fails for npm', async () => {
      spyNpm.mockResolvedValueOnce({ error: true, stderr: 'some-error' });
      expect(
        await getAdditionalFiles(
          { ...updateConfig, updateLockFiles: true },
          additionalFiles
        )
      ).toStrictEqual({
        artifactErrors: [
          { lockFile: 'package-lock.json', stderr: 'some-error' },
        ],
        updatedArtifacts: [],
      });
    });

    it('fails for yarn', async () => {
      spyYarn.mockResolvedValueOnce({ error: true, stdout: 'some-error' });
      expect(
        await getAdditionalFiles(
          { ...updateConfig, updateLockFiles: true, reuseExistingBranch: true },
          additionalFiles
        )
      ).toStrictEqual({
        artifactErrors: [{ lockFile: 'yarn.lock', stderr: 'some-error' }],
        updatedArtifacts: [],
      });
    });

    it('fails for pnpm', async () => {
      spyPnpm.mockResolvedValueOnce({ error: true, stdout: 'some-error' });
      expect(
        await getAdditionalFiles(
          {
            ...updateConfig,
            updateLockFiles: true,
            upgrades: [
              {
                isRemediation: true,
                packageFile: 'packages/pnpm/package.json',
              },
            ],
          },
          additionalFiles
        )
      ).toStrictEqual({
        artifactErrors: [
          { lockFile: 'packages/pnpm/pnpm-lock.yaml', stderr: 'some-error' },
        ],
        updatedArtifacts: [],
      });
    });

    it('fails for lerna', async () => {
      spyLerna.mockResolvedValueOnce({ stderr: 'some-error' });
      spyLerna.mockResolvedValueOnce({ stderr: 'some-error' });
      expect(
        await getAdditionalFiles(
          {
            ...updateConfig,
            npmLock: 'npm-shrinkwrap.json',
            updateLockFiles: true,
            upgrades: [{}],
          },
          {
            npm: [
              {
                packageFile: 'package.json',
                managerData: {
                  lernaJsonFile: 'lerna.json',
                },
                npmLock: 'npm-shrinkwrap.json',
                lernaClient: 'npm',
              },
            ],
          }
        )
      ).toStrictEqual({
        artifactErrors: [
          { lockFile: 'npm-shrinkwrap.json', stderr: 'some-error' },
        ],
        updatedArtifacts: [],
      });
    });
  });
});
