// TODO: add tests
import upath from 'upath';
import { Fixtures } from '~test/fixtures.ts';
import { fs, git, logger, partial, scm } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import type { FileChange } from '../../../../util/git/types.ts';
import type { PostUpdateConfig } from '../../types.ts';
import {
  determineLockFileDirs,
  getAdditionalFiles,
  updateYarnBinary,
  writeExistingFiles,
  writeUpdatedPackageFiles,
} from './index.ts';
import * as npm from './npm.ts';
import * as pnpm from './pnpm.ts';
import * as rules from './rules.ts';
import type { AdditionalPackageFiles } from './types.ts';
import * as yarn from './yarn.ts';

vi.mock('../../../../util/fs/index.ts');
vi.mock('./npm.ts');
vi.mock('./yarn.ts');
vi.mock('./pnpm.ts');

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
          pnpmLockFile: 'packages/pnpm/pnpm-lock.yaml',
        },
      },
    ],
  };

  beforeEach(() => {
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

          additionalFiles,
        ),
      ).toStrictEqual({
        npmLockDirs: ['package-lock.json', 'randomFolder/package-lock.json'],
        pnpmLockFileDirs: ['packages/pnpm/pnpm-lock.yaml'],
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
          {},
        ),
      ).toStrictEqual({
        npmLockDirs: [],
        pnpmLockFileDirs: [],
        yarnLockDirs: ['yarn.lock'],
      });
    });
  });

  describe('writeExistingFiles()', () => {
    it('works', async () => {
      git.getFile.mockResolvedValueOnce(
        Fixtures.get('update-lockfile-massage-1/package-lock.json'),
      );
      await expect(
        writeExistingFiles(updateConfig, additionalFiles),
      ).resolves.toBeUndefined();

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      expect(fs.deleteLocalFile).not.toHaveBeenCalled();
      expect(git.getFile).toHaveBeenCalledExactlyOnceWith('package-lock.json');
    });

    it('massages out lockstep siblings pinning the old version', async () => {
      git.getFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'update-lockfile-massage-2',
          version: '1.0.0',
          lockfileVersion: 3,
          requires: true,
          packages: {
            '': {
              name: 'update-lockfile-massage-2',
              version: '1.0.0',
              dependencies: { vue: '^3.3.10' },
              devDependencies: { '@vue/test-utils': '^2.4.3' },
            },
            'node_modules/vue': {
              version: '3.5.39',
              dependencies: {
                '@vue/server-renderer': '3.5.39',
                '@vue/shared': '3.5.39',
              },
            },
            // lockstep sibling pinning vue via peerDependencies
            'node_modules/@vue/server-renderer': {
              version: '3.5.39',
              dependencies: { '@vue/shared': '3.5.39' },
              peerDependencies: { vue: '3.5.39' },
            },
            // lockstep sibling pinning vue via dependencies
            'node_modules/@vue/compiler-sfc': {
              version: '3.5.39',
              dependencies: { vue: '3.5.39' },
            },
            // lockstep sibling pinning vue via optionalDependencies
            'node_modules/@vue/optional-consumer': {
              version: '3.5.39',
              optionalDependencies: { vue: '3.5.39' },
            },
            'node_modules/@vue/shared': {
              version: '3.5.39',
            },
            // range peer pin on vue, must stay
            'node_modules/@vue/test-utils': {
              version: '2.4.11',
              dev: true,
              peerDependencies: { vue: '3.x' },
            },
          },
        }),
      );
      const config = {
        ...baseConfig,
        upgrades: [
          {
            depName: 'vue',
            lockedVersion: '3.5.39',
            newVersion: '3.5.40',
            managerData: { npmLock: 'package-lock.json' },
          },
        ],
      };

      await writeExistingFiles(config, {
        npm: [
          {
            packageFile: 'package.json',
            managerData: { npmLock: 'package-lock.json' },
          },
        ],
      });

      const lockWrite = fs.writeLocalFile.mock.calls.find(
        (call) => call[0] === 'package-lock.json',
      );
      expect(lockWrite).toBeDefined();
      const written = JSON.parse(lockWrite![1] as string);
      // the updated dep itself and its exact-pinned lockstep siblings go
      expect(written.packages['node_modules/vue']).toBeUndefined();
      expect(
        written.packages['node_modules/@vue/server-renderer'],
      ).toBeUndefined();
      expect(
        written.packages['node_modules/@vue/compiler-sfc'],
      ).toBeUndefined();
      expect(
        written.packages['node_modules/@vue/optional-consumer'],
      ).toBeUndefined();
      // packages without an exact pin on the updated dep stay
      expect(written.packages['node_modules/@vue/test-utils']).toBeDefined();
      expect(written.packages['node_modules/@vue/shared']).toBeDefined();
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

      expect(fs.writeLocalFile).toHaveBeenCalledExactlyOnceWith(
        'packages/core/.npmrc',
        '#dummy\n',
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
        },
      );

      expect(fs.writeLocalFile).toHaveBeenCalledExactlyOnceWith(
        'packages/core/.npmrc',
        '#dummy\n',
      );
    });

    it('works only on relevant folders', async () => {
      git.getFile.mockResolvedValueOnce(
        Fixtures.get('update-lockfile-massage-1/package-lock.json'),
      );
      await expect(
        writeExistingFiles(updateConfig, additionalFiles),
      ).resolves.toBeUndefined();

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      expect(fs.deleteLocalFile).not.toHaveBeenCalled();
      expect(git.getFile).toHaveBeenCalledExactlyOnceWith('package-lock.json');
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
        writeUpdatedPackageFiles(baseConfig),
      ).resolves.toBeUndefined();
      expect(fs.writeLocalFile).not.toHaveBeenCalled();
    });

    it('prefers artifact content over package file content for the same path', async () => {
      await writeUpdatedPackageFiles({
        ...baseConfig,
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents: 'catalog:\n  effect: ^3.20.0\nminimumReleaseAge: 10080\n',
          },
        ],
        updatedArtifacts: [
          {
            type: 'deletion',
            path: 'some-deleted-file.yaml',
          },
          {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'catalog:\n  effect: ^3.20.0\nminimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  - effect@3.20.0\n',
          },
        ],
      });
      expect(fs.writeLocalFile).toHaveBeenCalledOnce();
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        'pnpm-workspace.yaml',
        'catalog:\n  effect: ^3.20.0\nminimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  - effect@3.20.0\n',
      );
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
        undefined,
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toEqual([
        {
          type: 'addition',
          path: 'path/to/lockfile/.yarnrc.yml',
          contents: 'yarnPath: .yarn/releases/yarn-3.0.2.cjs\na: b\n',
        },
        {
          type: 'deletion',
          path: 'path/to/lockfile/.yarn/releases/yarn-3.0.1.cjs',
        },
        {
          type: 'addition',
          path: 'path/to/lockfile/.yarn/releases/yarn-3.0.2.cjs',
          contents: 'new yarn\n',
          isExecutable: true,
        },
      ]);
    });

    it('should return .yarnrc.yml content if it has been overwritten', async () => {
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarn);
      const updatedArtifacts: FileChange[] = [];
      const existingYarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        oldYarnrcYml,
      );
      expect(git.getFile).not.toHaveBeenCalled();
      expect(existingYarnrcYmlContent).toBe(
        'yarnPath: .yarn/releases/yarn-3.0.2.cjs\na: b\n',
      );
      expect(updatedArtifacts).toEqual([
        {
          type: 'addition',
          path: 'path/to/lockfile/.yarnrc.yml',
          contents: 'yarnPath: .yarn/releases/yarn-3.0.2.cjs\na: b\n',
        },
        {
          type: 'deletion',
          path: 'path/to/lockfile/.yarn/releases/yarn-3.0.1.cjs',
        },
        {
          type: 'addition',
          path: 'path/to/lockfile/.yarn/releases/yarn-3.0.2.cjs',
          contents: 'new yarn\n',
          isExecutable: true,
        },
      ]);
    });

    it("should not update the Yarn binary if the old .yarnrc.yml doesn't exist", async () => {
      git.getFile.mockResolvedValueOnce(null);
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined,
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toBeEmpty();
    });

    it("should not update the Yarn binary if the new .yarnrc.yml doesn't exist", async () => {
      git.getFile.mockResolvedValueOnce(oldYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(null);
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined,
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toBeEmpty();
    });

    it("should return existing .yarnrc.yml if the new one doesn't exist", async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      const updatedArtifacts: FileChange[] = [];
      const existingYarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        oldYarnrcYml,
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
        '',
      );
      expect(yarnrcYmlContent).toBe('');
      expect(updatedArtifacts).toEqual([]);
      expect(logger.logger.debug).not.toHaveBeenCalled();
      expect(logger.logger.error).not.toHaveBeenCalled();
    });
  });

  describe('getAdditionalFiles()', () => {
    const spyNpm = vi.spyOn(npm, 'generateLockFile');
    const spyYarn = vi.spyOn(yarn, 'generateLockFile');
    const spyPnpm = vi.spyOn(pnpm, 'generateLockFile');
    const spyProcessHostRules = vi.spyOn(rules, 'processHostRules');

    beforeEach(() => {
      spyNpm.mockResolvedValue({});
      spyPnpm.mockResolvedValue({});
      spyYarn.mockResolvedValue({});
      spyProcessHostRules.mockReturnValue({
        additionalNpmrcContent: [],
        additionalYarnRcYml: undefined,
      });
    });

    it('works', async () => {
      await expect(
        getAdditionalFiles({ ...updateConfig }, additionalFiles),
      ).resolves.toStrictEqual({
        artifactErrors: [],
        artifactNotices: [],
        updatedArtifacts: [],
      });
    });

    it('works for npm', async () => {
      spyNpm.mockResolvedValueOnce({ error: false, lockFile: '{}' });
      fs.readLocalFile.mockImplementation((f): Promise<string> => {
        if (f === '.npmrc') {
          return Promise.resolve('# dummy');
        }
        return Promise.resolve('');
      });
      await expect(
        getAdditionalFiles(
          { ...updateConfig, reuseExistingBranch: true },
          additionalFiles,
        ),
      ).resolves.toStrictEqual({
        artifactErrors: [],
        artifactNotices: [],
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
        ['packages/pnpm/.npmrc'],
      ]);
    });

    it('adds artifact notice on beforeFallback', async () => {
      spyNpm.mockResolvedValueOnce({
        error: false,
        lockFile: '{}',
        beforeFallback: true,
      });
      fs.readLocalFile.mockImplementation((f): Promise<string> => {
        if (f === '.npmrc') {
          return Promise.resolve('# dummy');
        }
        return Promise.resolve('');
      });
      const res = await getAdditionalFiles(
        { ...updateConfig, reuseExistingBranch: true },
        additionalFiles,
      );

      expect(res.artifactNotices).toEqual([
        {
          file: 'package-lock.json',
          message:
            'npm `--before` could not be enforced because existing locked packages were published after the `minimumReleaseAge` cutoff. This will resolve after the next lock file maintenance run.',
        },
      ]);
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { npmLock: 'package-lock.json' },
        'npm `--before` could not be enforced because existing locked packages were published after the `minimumReleaseAge` cutoff. This will resolve after the next lock file maintenance run.',
      );
    });

    it('detects if lock file contents are unchanged(reuseExistingBranch=true)', async () => {
      spyNpm.mockResolvedValueOnce({ error: false, lockFile: '{}' });
      fs.readLocalFile.mockImplementation((f): Promise<any> => {
        if (f === 'package-lock.json') {
          return Promise.resolve('{}');
        }
        return Promise.resolve(null);
      });
      git.getFile.mockImplementation((f) => {
        if (f === 'package-lock.json') {
          return Promise.resolve('{}');
        }
        return Promise.resolve(null);
      });
      expect(
        (
          await getAdditionalFiles(
            {
              ...updateConfig,
              reuseExistingBranch: true,
            },
            additionalFiles,
          )
        ).updatedArtifacts.find((a) => a.path === 'package-lock.json'),
      ).toBeUndefined();
    });

    // for coverage run once when not reusing the branch
    it('detects if lock file contents are unchanged(reuseExistingBranch=false)', async () => {
      spyNpm.mockResolvedValueOnce({ error: false, lockFile: '{}' });
      fs.readLocalFile.mockImplementation((f): Promise<any> => {
        if (f === 'package-lock.json') {
          return Promise.resolve('{}');
        }
        return Promise.resolve(null);
      });
      git.getFile.mockImplementation((f) => {
        if (f === 'package-lock.json') {
          return Promise.resolve('{}');
        }
        return Promise.resolve(null);
      });
      expect(
        (
          await getAdditionalFiles(
            {
              ...updateConfig,
              reuseExistingBranch: false,
              baseBranch: 'base',
            },
            additionalFiles,
          )
        ).updatedArtifacts.find((a) => a.path === 'package-lock.json'),
      ).toBeUndefined();
    });

    it('works for yarn', async () => {
      spyYarn.mockResolvedValueOnce({ error: false, lockFile: '{}' });
      await expect(
        getAdditionalFiles(
          { ...updateConfig, reuseExistingBranch: true },
          additionalFiles,
        ),
      ).resolves.toStrictEqual({
        artifactErrors: [],
        artifactNotices: [],
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
      await expect(
        getAdditionalFiles(
          {
            ...updateConfig,
            reuseExistingBranch: true,
            upgrades: [
              {
                isRemediation: true,
                packageFile: 'packages/pnpm/package.json',
              },
            ],
          },
          additionalFiles,
        ),
      ).resolves.toStrictEqual({
        artifactErrors: [],
        artifactNotices: [],
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
      await expect(getAdditionalFiles(baseConfig, {})).resolves.toStrictEqual({
        artifactErrors: [],
        artifactNotices: [],
        updatedArtifacts: [],
      });
    });

    it('no lockfiles updates', async () => {
      await expect(
        getAdditionalFiles(baseConfig, additionalFiles),
      ).resolves.toStrictEqual({
        artifactErrors: [],
        artifactNotices: [],
        updatedArtifacts: [],
      });
    });

    it('skip lock file updating', async () => {
      await expect(
        getAdditionalFiles(
          {
            ...updateConfig,
            skipArtifactsUpdate: true,
            reuseExistingBranch: true,
            upgrades: [
              {
                depName: 'postcss',
                isRemediation: true,
                managerData: {
                  npmLock: 'package-lock.json',
                },
                rangeStrategy: 'widen',
              },
            ],
          },
          additionalFiles,
        ),
      ).resolves.toStrictEqual({
        artifactErrors: [],
        artifactNotices: [],
        updatedArtifacts: [],
      });
      expect(spyNpm).not.toHaveBeenCalled();

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Skipping lock file generation',
      );
    });

    it('reuse existing up-to-date', async () => {
      await expect(
        getAdditionalFiles(
          {
            ...baseConfig,
            reuseExistingBranch: true,
            upgrades: [{ isLockfileUpdate: true }],
          },
          additionalFiles,
        ),
      ).resolves.toStrictEqual({
        artifactErrors: [],
        artifactNotices: [],
        updatedArtifacts: [],
      });
    });

    it('lockfile maintenance branch exists', async () => {
      // TODO: can this really happen?
      scm.branchExists.mockResolvedValueOnce(true);
      await expect(
        getAdditionalFiles(
          {
            ...baseConfig,
            upgrades: [{ isLockfileUpdate: false }],
            reuseExistingBranch: true,
            isLockFileMaintenance: true,
          },
          additionalFiles,
        ),
      ).resolves.toStrictEqual({
        artifactErrors: [],
        artifactNotices: [],
        updatedArtifacts: [],
      });
    });

    it('fails for npm', async () => {
      spyNpm.mockResolvedValueOnce({ error: true, stderr: 'some-error' });
      await expect(
        getAdditionalFiles({ ...updateConfig }, additionalFiles),
      ).resolves.toStrictEqual({
        artifactErrors: [
          { fileName: 'package-lock.json', stderr: 'some-error' },
        ],
        artifactNotices: [],
        updatedArtifacts: [],
      });
    });

    it('fails for yarn', async () => {
      spyYarn.mockResolvedValueOnce({ error: true, stdout: 'some-error' });
      await expect(
        getAdditionalFiles(
          { ...updateConfig, reuseExistingBranch: true },
          additionalFiles,
        ),
      ).resolves.toStrictEqual({
        artifactErrors: [{ fileName: 'yarn.lock', stderr: 'some-error' }],
        artifactNotices: [],
        updatedArtifacts: [],
      });
    });

    it('fails for pnpm', async () => {
      spyPnpm.mockResolvedValueOnce({ error: true, stdout: 'some-error' });
      await expect(
        getAdditionalFiles(
          {
            ...updateConfig,
            upgrades: [
              {
                isRemediation: true,
                packageFile: 'packages/pnpm/package.json',
              },
            ],
          },
          additionalFiles,
        ),
      ).resolves.toStrictEqual({
        artifactErrors: [
          { fileName: 'packages/pnpm/pnpm-lock.yaml', stderr: 'some-error' },
        ],
        artifactNotices: [],
        updatedArtifacts: [],
      });
    });

    describe('should fuzzy merge yarn npmRegistries', () => {
      beforeEach(() => {
        spyProcessHostRules.mockReturnValue({
          additionalNpmrcContent: [],
          additionalYarnRcYml: {
            npmRegistries: {
              '//my-private-registry': {
                npmAuthToken: 'xxxxxx',
              },
            },
          },
        });
        fs.getSiblingFileName.mockReturnValue('.yarnrc.yml');
      });

      it('should fuzzy merge the yarnrc Files', async () => {
        vi.mocked(yarn.fuzzyMatchAdditionalYarnrcYml).mockReturnValue({
          npmRegistries: {
            'https://my-private-registry': { npmAuthToken: 'xxxxxx' },
          },
        });
        fs.readLocalFile.mockImplementation((f): Promise<any> => {
          if (f === '.yarnrc.yml') {
            return Promise.resolve(
              'npmRegistries:\n' +
                '  https://my-private-registry:\n' +
                '    npmAlwaysAuth: true\n',
            );
          }
          return Promise.resolve(null);
        });

        spyYarn.mockResolvedValueOnce({ error: false, lockFile: '{}' });
        await getAdditionalFiles(
          {
            ...updateConfig,
            reuseExistingBranch: true,
          },
          additionalFiles,
        );

        expect(fs.writeLocalFile).toHaveBeenCalledWith(
          '.yarnrc.yml',
          'npmRegistries:\n' +
            '  https://my-private-registry:\n' +
            '    npmAlwaysAuth: true\n' +
            '    npmAuthToken: xxxxxx\n',
        );
      });

      it('should warn if there is an error writing the yarnrc.yml', async () => {
        fs.readLocalFile.mockImplementation((f): Promise<any> => {
          if (f === '.yarnrc.yml') {
            return Promise.resolve(
              `yarnPath: .yarn/releases/yarn-3.0.1.cjs\na: b\n`,
            );
          }
          return Promise.resolve(null);
        });

        fs.writeLocalFile.mockImplementation((f): Promise<any> => {
          if (f === '.yarnrc.yml') {
            throw new Error();
          }
          return Promise.resolve(null);
        });

        spyYarn.mockResolvedValueOnce({ error: false, lockFile: '{}' });

        await expect(
          getAdditionalFiles(
            {
              ...updateConfig,
              reuseExistingBranch: true,
            },
            additionalFiles,
          ),
        ).rejects.toThrow(Error);

        expect(logger.logger.warn).toHaveBeenCalledWith(
          expect.anything(),
          'Error appending .yarnrc.yml content',
        );
      });
    });
  });
});
