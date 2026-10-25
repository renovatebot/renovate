import fs from 'fs-extra';
import { dir } from 'tmp-promise';
import { platform } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as npmPostUpdate from '../../../modules/manager/npm/post-update/index.ts';
import type { Pr } from '../../../modules/platform/index.ts';
import { getPrBodyStruct } from '../../../modules/platform/pr-body.ts';
import { setPlatformScmApi } from '../../../modules/platform/scm.ts';
import { resetCache } from '../../../util/cache/repository/index.ts';
import { setCustomEnv } from '../../../util/env.ts';
import * as git from '../../../util/git/index.ts';
import { counts } from '../../global/limits.ts';
import type { BranchConfig } from '../../types.ts';
import { setBranchCache } from '../cache.ts';
import { writeUpdates } from './write.ts';

vi.unmock('../../../util/git/index.ts');
vi.unmock('../../../modules/platform/scm.ts');
vi.mock('../../../util/git/auth.ts');
vi.mock('../../../modules/manager/npm/post-update/index.ts');
vi.mock('../changelog/index.ts');

const dependencies = {
  'dep-a': '1.0.0',
  'dep-b': '1.0.0',
  'dep-c': '1.0.0',
};
const branchName = 'renovate/group';

function packageContents(deps: Record<string, string>): string {
  return `${JSON.stringify({ name: 'test', version: '1.0.0', dependencies: deps }, null, 2)}\n`;
}

function lockContents(deps: Record<string, string>): string {
  const lockfile = {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: deps },
      ...Object.fromEntries(
        Object.entries(deps).map(([name, version]) => [
          `node_modules/${name}`,
          { version },
        ]),
      ),
    },
  };
  return `${JSON.stringify(lockfile, null, 2)}\n`;
}

function branch(depNames = Object.keys(dependencies)): BranchConfig {
  const config = { ...getConfig(), major: undefined };
  return {
    ...config,
    baseBranch: 'main',
    branchName,
    manager: 'npm',
    prTitle: 'Update grouped dependencies',
    commitMessage: 'Update grouped dependencies',
    errors: [],
    warnings: [],
    packageFiles: { npm: [{ packageFile: 'package.json', deps: [] }] },
    upgrades: depNames.map((depName) => ({
      ...config,
      manager: 'npm',
      datasource: 'npm',
      depName,
      packageName: depName,
      depType: 'dependencies',
      packageFile: 'package.json',
      branchName,
      currentValue: '1.0.0',
      currentVersion: '1.0.0',
      newValue: '1.1.0',
      newVersion: '1.1.0',
      updateType: 'minor',
    })),
  };
}

describe(
  'workers/repository/process/write-integration',
  { timeout: 30000 },
  () => {
    let origin: Awaited<ReturnType<typeof dir>>;
    let local: Awaited<ReturnType<typeof dir>>;
    let prs: Map<string, Pr>;
    let bodies: Map<string, string>;

    async function run(...branches: BranchConfig[]): Promise<void> {
      await git.initRepo({ url: origin.path });
      git.setUserRepoConfig({ branchPrefix: 'renovate/' });
      git.setGitAuthor('Renovate <renovate@example.com>');
      git.setPlatformIgnoredAuthors([]);
      git.setNoVerify([]);
      await git.syncGit();
      await git
        .createSimpleGit({ config: { baseDir: local.path } })
        .addConfig('commit.gpgsign', 'false');
      await writeUpdates(getConfig(), branches);
      expect(branches.map((branch) => branch.result)).not.toContain('error');
      await setBranchCache(branches);
    }

    async function expectContents(
      name: string,
      updatedDeps: string[],
    ): Promise<void> {
      const expected = { ...dependencies };
      for (const dep of updatedDeps) {
        expected[dep as keyof typeof expected] = '1.1.0';
      }
      for (const dep of Object.keys(dependencies)) {
        expect(bodies.get(name)?.includes(`| ${dep} |`)).toBe(
          updatedDeps.includes(dep),
        );
      }
      await expect(git.getFile('package.json', name)).resolves.toBe(
        packageContents(expected),
      );
      await expect(git.getFile('package-lock.json', name)).resolves.toBe(
        lockContents(expected),
      );
    }

    beforeEach(async () => {
      resetCache();
      counts.clear();
      setCustomEnv({});
      prs = new Map();
      bodies = new Map();
      origin = await dir({ unsafeCleanup: true });
      local = await dir({ unsafeCleanup: true });
      const repo = git.createSimpleGit({ config: { baseDir: origin.path } });
      await repo.init(['--initial-branch=main']);
      await repo.addConfig('user.name', 'Renovate');
      await repo.addConfig('user.email', 'renovate@example.com');
      await repo.addConfig('commit.gpgsign', 'false');
      await fs.writeFile(
        `${origin.path}/package.json`,
        packageContents(dependencies),
      );
      await fs.writeFile(
        `${origin.path}/package-lock.json`,
        lockContents(dependencies),
      );
      await repo.add('.');
      await repo.commit('Initial dependencies');
      GlobalConfig.set({ localDir: local.path, platform: 'gitlab' });
      setPlatformScmApi('gitlab');

      platform.getBranchPr.mockImplementation((name) =>
        Promise.resolve(prs.get(name) ?? null),
      );
      platform.getPrList.mockImplementation(() =>
        Promise.resolve([...prs.values()]),
      );
      platform.massageMarkdown.mockImplementation((body) => body);
      platform.getBranchStatus.mockResolvedValue('green');
      platform.createPr.mockImplementation((config) => {
        const pr: Pr = {
          number: prs.size + 1,
          state: 'open',
          sourceBranch: config.sourceBranch,
          targetBranch: config.targetBranch,
          title: config.prTitle,
          labels: [],
          bodyStruct: getPrBodyStruct(config.prBody),
        };
        prs.set(config.sourceBranch, pr);
        bodies.set(config.sourceBranch, config.prBody);
        return Promise.resolve(pr);
      });
      platform.updatePr.mockImplementation((config) => {
        const pr = [...prs.values()].find((pr) => pr.number === config.number)!;
        pr.title = config.prTitle!;
        pr.bodyStruct = getPrBodyStruct(config.prBody);
        bodies.set(pr.sourceBranch, config.prBody!);
        return Promise.resolve();
      });
      // Replace only the external lockfile generator; the branch, Git and PR workers are real.
      vi.mocked(npmPostUpdate.getAdditionalFiles).mockImplementation(
        (config) => {
          const file = config.updatedPackageFiles?.find(
            (file) => file.path === 'package.json',
          );
          if (file?.type !== 'addition') {
            return Promise.resolve({
              artifactErrors: [],
              updatedArtifacts: [],
            });
          }
          const { dependencies: deps } = JSON.parse(file.contents!.toString());
          return Promise.resolve({
            artifactErrors: [],
            updatedArtifacts: [
              {
                type: 'addition',
                path: 'package-lock.json',
                contents: lockContents(deps),
              },
            ],
          });
        },
      );
    });

    afterEach(async () => {
      vi.useRealTimers();
      GlobalConfig.reset();
      resetCache();
      await local?.cleanup();
      await origin?.cleanup();
    });

    it.each`
      rebaseWhen              | loseFingerprint
      ${'auto'}               | ${false}
      ${'conflicted'}         | ${false}
      ${'behind-base-branch'} | ${false}
      ${'auto'}               | ${true}
      ${'conflicted'}         | ${true}
      ${'behind-base-branch'} | ${true}
    `(
      'removes excluded upgrades with rebaseWhen=$rebaseWhen, lost fingerprint=$loseFingerprint',
      async ({ rebaseWhen, loseFingerprint }) => {
        await run(branch());
        await expectContents(branchName, ['dep-a', 'dep-b', 'dep-c']);
        if (loseFingerprint) {
          resetCache();
        }

        await run({ ...branch(['dep-a', 'dep-b']), rebaseWhen });

        await expectContents(branchName, ['dep-a', 'dep-b']);
        expect(prs.get(branchName)?.number).toBe(1);
        expect(platform.createPr).toHaveBeenCalledTimes(1);
        const diff = await git
          .createSimpleGit({ config: { baseDir: local.path } })
          .diff(['main', branchName]);
        expect(diff).not.toContain('+      "dep-c": "1.1.0"');
      },
    );

    it('reuses an unchanged group without regenerating artifacts or committing', async () => {
      await run(branch());
      const sha = git.getBranchCommit(branchName);
      vi.mocked(npmPostUpdate.getAdditionalFiles).mockClear();
      platform.updatePr.mockClear();

      await run(branch());

      await expectContents(branchName, ['dep-a', 'dep-b', 'dep-c']);
      expect(git.getBranchCommit(branchName)).toBe(sha);
      expect(npmPostUpdate.getAdditionalFiles).not.toHaveBeenCalled();
      expect(platform.updatePr).not.toHaveBeenCalled();
      expect(platform.createPr).toHaveBeenCalledTimes(1);
    });

    it('does not add a commit when verifying an unchanged group after cache loss', async () => {
      await run(branch());
      const sha = git.getBranchCommit(branchName);
      resetCache();

      await run(branch());

      await expectContents(branchName, ['dep-a', 'dep-b', 'dep-c']);
      expect(git.getBranchCommit(branchName)).toBe(sha);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
    });

    it('preserves a user commit when the group shrinks', async () => {
      await run(branch());
      const repo = git.createSimpleGit({ config: { baseDir: local.path } });
      await repo.checkout(branchName);
      await fs.writeFile(`${local.path}/manual.txt`, 'Keep my changes\n');
      await repo.add('manual.txt');
      await repo.commit('User changes', {
        '--author': 'User <user@example.com>',
      });
      await repo.push('origin', branchName);
      const sha = (await repo.revparse(branchName)).trim();

      const updated = branch(['dep-a', 'dep-b']);
      await run(updated);

      expect(updated.result).toBe('pr-edited');
      expect(git.getBranchCommit(branchName)).toBe(sha);
      await expect(git.getFile('manual.txt', branchName)).resolves.toBe(
        'Keep my changes\n',
      );
      await expectContents(branchName, ['dep-a', 'dep-b', 'dep-c']);
      expect(platform.updatePr).not.toHaveBeenCalled();
    });

    it('moves the excluded upgrade to a separate PR without duplicating the group', async () => {
      await run(branch());
      resetCache();
      const separate = {
        ...branch(['dep-c']),
        branchName: 'renovate/dep-c',
        prTitle: 'Update dep-c',
      };

      await run(branch(['dep-a', 'dep-b']), separate);

      await expectContents(branchName, ['dep-a', 'dep-b']);
      await expectContents(separate.branchName, ['dep-c']);
      expect(prs.size).toBe(2);
      expect(prs.get(branchName)?.number).toBe(1);
      expect(platform.createPr).toHaveBeenCalledTimes(2);
    });

    it.each`
      overrides                                                                   | result
      ${{ rebaseWhen: 'never' }}                                                  | ${'no-work'}
      ${{ pendingChecks: true }}                                                  | ${'pending'}
      ${{ schedule: ['before 4am'], timezone: 'UTC', updateNotScheduled: false }} | ${'update-not-scheduled'}
      ${{ stopUpdatingLabel: 'stop' }}                                            | ${'no-work'}
    `(
      'preserves update suppression: $overrides',
      async ({ overrides, result }) => {
        await run(branch());
        const sha = git.getBranchCommit(branchName);
        prs.get(branchName)!.labels = ['stop'];
        resetCache();
        vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
        const updated = { ...branch(['dep-a', 'dep-b']), ...overrides };

        await run(updated);

        expect(updated.result).toBe(result);
        expect(git.getBranchCommit(branchName)).toBe(sha);
        await expectContents(branchName, ['dep-a', 'dep-b', 'dep-c']);
        expect(platform.updatePr).not.toHaveBeenCalled();
      },
    );

    it('reconciles a group with rebaseWhen=never when rebase is explicitly requested', async () => {
      await run(branch());
      prs.get(branchName)!.bodyStruct!.rebaseRequested = true;

      await run({ ...branch(['dep-a', 'dep-b']), rebaseWhen: 'never' });

      await expectContents(branchName, ['dep-a', 'dep-b']);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
    });
  },
);
