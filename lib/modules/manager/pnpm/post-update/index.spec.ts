// TODO: add tests
import upath from 'upath';
import { fs, partial, scm } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { PostUpdateConfig } from '../../types';
import * as pnpm from './pnpm';
import type { AdditionalPackageFiles } from './types';
import {
  determineLockFileDirs,
  getAdditionalFiles,
  writeExistingFiles,
  writeUpdatedPackageFiles,
} from './';

jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');
jest.mock('./pnpm');

describe('modules/manager/pnpm/post-update/index', () => {
  let baseConfig: PostUpdateConfig;
  let updateConfig: PostUpdateConfig;
  const additionalFiles: AdditionalPackageFiles = {
    npm: [
      { packageFile: 'dummy.txt' },
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
        pnpmShrinkwrapDirs: ['packages/pnpm/pnpm-lock.yaml'],
      });
    });
  });

  describe('writeExistingFiles()', () => {
    it('works no reuse lockfiles', async () => {
      await expect(
        writeExistingFiles(
          { ...updateConfig, reuseLockFiles: false },
          additionalFiles
        )
      ).resolves.toBeUndefined();

      expect(fs.deleteLocalFile.mock.calls).toEqual([
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
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(5);
    });

    it('missing updated packages files', async () => {
      await expect(
        writeUpdatedPackageFiles(baseConfig)
      ).resolves.toBeUndefined();
      expect(fs.writeLocalFile).not.toHaveBeenCalled();
    });
  });

  describe('getAdditionalFiles()', () => {
    const spyPnpm = jest.spyOn(pnpm, 'generateLockFile');

    beforeEach(() => {
      spyPnpm.mockResolvedValue({});
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
  });
});
