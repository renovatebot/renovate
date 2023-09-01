// TODO: add tests
import upath from 'upath';
import { Fixtures } from '../../../../../test/fixtures';
import { fs, git, partial, scm } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { PostUpdateConfig } from '../../types';
import * as npm from './npm';
import type { AdditionalPackageFiles } from './types';
import {
  determineLockFileDirs,
  getAdditionalFiles,
  writeExistingFiles,
  writeUpdatedPackageFiles,
} from './';

jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');
jest.mock('./npm');

describe('modules/manager/npm/post-update/index', () => {
  let baseConfig: PostUpdateConfig;
  let updateConfig: PostUpdateConfig;
  const additionalFiles: AdditionalPackageFiles = {
    npm: [
      { packageFile: 'dummy.txt' },
      {
        packageFile: 'packages/core/package.json',
        managerData: {
          npmLock: 'package-lock.json',
        },
        npmrc: '#dummy',
      },
      {
        packageFile: 'packages/cli/package.json',
        managerData: {
          yarnLock: 'yarn.lock',
        },
      },
      {
        packageFile: 'packages/test/package.json',
        managerData: {
          yarnLock: 'yarn.lock',
        },
      },
      {
        packageFile: 'packages/pnpm/package.json',
        managerData: {
          pnpmShrinkwrap: 'packages/pnpm/pnpm-lock.yaml',
        },
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
            npmLock: 'package-lock.json',
          },
          rangeStrategy: 'widen',
        },
        {
          depName: 'core-js',
          isRemediation: true,
          managerData: {
            npmLock: 'randomFolder/package-lock.json',
          },
          lockFiles: ['randomFolder/package-lock.json'],
          rangeStrategy: 'pin',
        },
        {
          isLockfileUpdate: true,
          managerData: {
            npmLock: 'package-lock.json',
          },
        },
        {
          managerData: {
            yarnLock: 'yarn.lock',
          },
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
        npmLockDirs: ['package-lock.json', 'randomFolder/package-lock.json'],
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
                managerData: {
                  yarnLock: 'yarn.lock',
                },
              },
            ],
          },
          {}
        )
      ).toStrictEqual({
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

    it('writes .npmrc files', async () => {
      await writeExistingFiles(updateConfig, {
        npm: [
          // This package's npmrc should be written verbatim.
          {
            packageFile: 'packages/core/package.json',
            npmrc: '#dummy',
            managerData: {},
          },
          // No npmrc content should be written for this package.
          { packageFile: 'packages/core/package.json', managerData: {} },
        ],
      });

      expect(fs.writeLocalFile).toHaveBeenCalledOnce();
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        'packages/core/.npmrc',
        '#dummy\n'
      );
    });

    it('only sources npmrc content from package config', async () => {
      await writeExistingFiles(
        { ...updateConfig, npmrc: '#foobar' },
        {
          npm: [
            // This package's npmrc should be written verbatim.
            {
              packageFile: 'packages/core/package.json',
              npmrc: '#dummy',
              managerData: {},
            },
            // No npmrc content should be written for this package.
            { packageFile: 'packages/core/package.json', managerData: {} },
          ],
        }
      );

      expect(fs.writeLocalFile).toHaveBeenCalledOnce();
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        'packages/core/.npmrc',
        '#dummy\n'
      );
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

  describe('getAdditionalFiles()', () => {
    const spyNpm = jest.spyOn(npm, 'generateLockFile');

    beforeEach(() => {
      spyNpm.mockResolvedValue({});
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
      // TODO: fix types, jest is using wrong overload (#22198)
      fs.readLocalFile.mockImplementation((f): Promise<any> => {
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
        ['randomFolder/.npmrc'],
      ]);
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
      scm.branchExists.mockResolvedValueOnce(true);
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
  });
});
