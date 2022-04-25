// TODO: add tests
import { Fixtures } from '../../../../../test/fixtures';
import { fs, git, partial } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { FileChange } from '../../../../util/git/types';
import type { PostUpdateConfig } from '../../types';
import type { AdditionalPackageFiles } from './types';
import {
  determineLockFileDirs,
  updateYarnBinary,
  writeExistingFiles,
  writeUpdatedPackageFiles,
} from './';

jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');

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
          isLockfileUpdate: true,
          npmLock: 'package-lock.json',
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
          path: 'package.json',
          contents: '{}',
        },
      ],
    };
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
        pnpmShrinkwrapDirs: [],
        yarnLockDirs: [],
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
        writeExistingFiles({ ...updateConfig }, additionalFiles)
      ).resolves.toBeUndefined();

      expect(fs.outputFile).toHaveBeenCalledTimes(2);
      expect(fs.remove).not.toHaveBeenCalled();
    });

    it('works no reuse lockfiles', async () => {
      await expect(
        writeExistingFiles(
          { ...updateConfig, reuseLockFiles: false },
          additionalFiles
        )
      ).resolves.toBeUndefined();

      expect(fs.outputFile).toHaveBeenCalledOnce();
      expect(fs.remove).toHaveBeenCalledOnce();
    });

    it('has no npm files', async () => {
      await expect(writeExistingFiles(baseConfig, {})).toResolve();
    });
  });

  describe('writeUpdatedPackageFiles()', () => {
    it('works', async () => {
      await expect(
        writeUpdatedPackageFiles(updateConfig)
      ).resolves.toBeUndefined();
      expect(fs.outputFile).toHaveBeenCalledTimes(4);
    });

    it('missing updated packages files', async () => {
      await expect(
        writeUpdatedPackageFiles(baseConfig)
      ).resolves.toBeUndefined();
      expect(fs.outputFile).not.toHaveBeenCalled();
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
  });
});
