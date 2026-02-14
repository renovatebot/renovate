import type { RequestError, Response } from 'got';
import { DateTime } from 'luxon';
import type { RenovateConfig } from '~test/util.ts';
import { partial, platform, scm } from '~test/util.ts';
import { getConfig } from '../../../../config/defaults.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { InheritConfig } from '../../../../config/inherit.ts';
import { REPOSITORY_CLOSED_ONBOARDING } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import type { PackageFile } from '../../../../modules/manager/types.ts';
import type { Pr } from '../../../../modules/platform/index.ts';
import * as memCache from '../../../../util/cache/memory/index.ts';
import type { BranchConfig } from '../../../types.ts';
import { OnboardingState } from '../common.ts';
import { ensureOnboardingPr } from './index.ts';

describe('workers/repository/onboarding/pr/index', () => {
  describe('ensureOnboardingPr()', () => {
    let config: RenovateConfig;
    let packageFiles: Record<string, PackageFile[]>;
    let branches: BranchConfig[];

    const bodyStruct = {
      hash: '6aa71f8cb7b1503b883485c8f5bd564b31923b9c7fa765abe2a7338af40e03b1',
    };

    beforeEach(() => {
      memCache.init();
      config = {
        ...getConfig(),
        errors: [],
        warnings: [],
        description: [],
      };
      packageFiles = { npm: [{ packageFile: 'package.json', deps: [] }] };
      branches = [];
      platform.massageMarkdown.mockImplementation((input) => input);
      platform.createPr.mockResolvedValueOnce(partial<Pr>());
      GlobalConfig.set({ onboardingBranch: config.onboardingBranch });
    });

    it('returns if onboarded', async () => {
      config.repoIsOnboarded = true;
      await expect(
        ensureOnboardingPr(config, packageFiles, branches),
      ).resolves.not.toThrow();
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('returns if onboarded cache is valid', async () => {
      OnboardingState.onboardingCacheValid = true;
      await expect(
        ensureOnboardingPr(config, packageFiles, branches),
      ).resolves.not.toThrow();
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it.each`
      onboardingRebaseCheckbox | prUpdateRequested | expected
      ${false}                 | ${false}          | ${1}
      ${false}                 | ${true}           | ${1}
      ${true}                  | ${false}          | ${0}
      ${true}                  | ${true}           | ${1}
    `(
      'breaks early when onboarding ' +
        '(onboardingRebaseCheckbox="$onboardingRebaseCheckbox", prUpdateRequeste="$prUpdateRequested" )',
      async ({ onboardingRebaseCheckbox, prUpdateRequested, expected }) => {
        config.repoIsOnboarded = false;
        config.onboardingRebaseCheckbox = onboardingRebaseCheckbox;
        OnboardingState.prUpdateRequested = prUpdateRequested;
        await expect(
          ensureOnboardingPr(config, packageFiles, branches),
        ).resolves.not.toThrow();
        expect(platform.updatePr).toHaveBeenCalledTimes(0);
        expect(platform.createPr).toHaveBeenCalledTimes(expected);
      },
    );

    it('creates PR', async () => {
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
    });

    it('creates semantic PR', async () => {
      await ensureOnboardingPr(
        {
          ...config,
          semanticCommitType: undefined, // should default to "chore"
          semanticCommits: 'enabled',
        },
        packageFiles,
        branches,
      );
      expect(platform.createPr).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          prTitle: 'chore: Configure Renovate',
        }),
      );
    });

    it('creates PR with labels', async () => {
      await ensureOnboardingPr(
        {
          ...config,
          labels: ['label'],
          addLabels: ['label', 'additional-label'],
        },
        packageFiles,
        branches,
      );
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].labels).toEqual([
        'additional-label',
        'label',
      ]);
    });

    it.each`
      onboardingRebaseCheckbox
      ${false}
      ${true}
    `(
      'creates PR with empty footer and header' +
        '(onboardingRebaseCheckbox="$onboardingRebaseCheckbox")',
      async ({ onboardingRebaseCheckbox }) => {
        config.onboardingRebaseCheckbox = onboardingRebaseCheckbox;
        OnboardingState.prUpdateRequested = true; // case 'false' is tested in "breaks early when onboarding"
        await ensureOnboardingPr(
          {
            ...config,
            prHeader: '',
            prFooter: '',
          },
          packageFiles,
          branches,
        );
        expect(platform.createPr).toHaveBeenCalledTimes(1);
        expect(platform.createPr.mock.calls[0][0].prBody).toMatchSnapshot();
      },
    );

    it.each`
      onboardingRebaseCheckbox
      ${false}
      ${true}
    `(
      'creates PR with footer and header with trailing and leading newlines' +
        '(onboardingRebaseCheckbox="$onboardingRebaseCheckbox")',
      async ({ onboardingRebaseCheckbox }) => {
        config.onboardingRebaseCheckbox = onboardingRebaseCheckbox;
        OnboardingState.prUpdateRequested = true; // case 'false' is tested in "breaks early when onboarding"
        await ensureOnboardingPr(
          {
            ...config,
            prHeader: '\r\r\nThis should not be the first line of the PR',
            prFooter:
              'There should be several empty lines at the end of the PR\r\n\n\n',
          },
          packageFiles,
          branches,
        );
        expect(platform.createPr).toHaveBeenCalledTimes(1);
        expect(platform.createPr.mock.calls[0][0].prBody).toMatchSnapshot();
      },
    );

    it.each`
      onboardingRebaseCheckbox
      ${false}
      ${true}
    `(
      'creates PR with footer and header using templating' +
        '(onboardingRebaseCheckbox="$onboardingRebaseCheckbox")',
      async ({ onboardingRebaseCheckbox }) => {
        config.baseBranch = 'some-branch';
        config.repository = 'test';
        config.onboardingRebaseCheckbox = onboardingRebaseCheckbox;
        config.onboardingConfigFileName = undefined; // checks the case when fileName isn't available
        OnboardingState.prUpdateRequested = true; // case 'false' is tested in "breaks early when onboarding"
        await ensureOnboardingPr(
          {
            ...config,
            prHeader: 'This is a header for platform:{{platform}}',
            prFooter:
              'And this is a footer for repository:{{repository}} baseBranch:{{baseBranch}}',
          },
          packageFiles,
          branches,
        );
        expect(platform.createPr).toHaveBeenCalledTimes(1);
        expect(platform.createPr.mock.calls[0][0].prBody).toMatch(
          /platform:github/,
        );
        expect(platform.createPr.mock.calls[0][0].prBody).toMatch(
          /repository:test/,
        );
        expect(platform.createPr.mock.calls[0][0].prBody).toMatchSnapshot();
      },
    );

    it.each`
      onboardingRebaseCheckbox
      ${false}
      ${true}
    `(
      'returns if PR does not need updating' +
        '(onboardingRebaseCheckbox="$onboardingRebaseCheckbox")',
      async ({ onboardingRebaseCheckbox }) => {
        const hash =
          '30029ee05ed80b34d2f743afda6e78fe20247a1eedaa9ce6a8070045c229ebfa'; // no rebase checkbox PR hash
        config.onboardingRebaseCheckbox = onboardingRebaseCheckbox;
        OnboardingState.prUpdateRequested = true; // case 'false' is tested in "breaks early when onboarding"
        platform.getBranchPr.mockResolvedValue(
          partial<Pr>({
            title: 'Configure Renovate',
            bodyStruct: onboardingRebaseCheckbox ? bodyStruct : { hash },
          }),
        );
        await ensureOnboardingPr(config, packageFiles, branches);
        expect(platform.createPr).toHaveBeenCalledTimes(0);
        expect(platform.updatePr).toHaveBeenCalledTimes(0);
      },
    );

    it('ensures comment, when PR is conflicted', async () => {
      config.baseBranch = 'some-branch';
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'Configure Renovate',
          bodyStruct,
        }),
      );
      scm.isBranchConflicted.mockResolvedValueOnce(true);
      await ensureOnboardingPr(config, {}, branches);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    describe('when onboardingAutoCloseAge is set', () => {
      beforeAll(() => {
        vi.useFakeTimers();
      });

      it('ensures comment, if onboarding cache is up-to-date, but when onboarding pr is over onboardingAutoCloseAge', async () => {
        OnboardingState.onboardingCacheValid = true;
        const now = DateTime.now();
        vi.setSystemTime(now.toMillis());
        const createdAt = now.minus({ hour: 48 });

        config.baseBranch = 'some-branch';
        GlobalConfig.set({ onboardingAutoCloseAge: 1 });
        platform.getBranchPr.mockResolvedValueOnce(
          partial<Pr>({
            title: 'Configure Renovate',
            bodyStruct,
            createdAt: createdAt.toISO(),
            number: 1,
          }),
        );
        await expect(ensureOnboardingPr(config, {}, branches)).rejects.toThrow(
          REPOSITORY_CLOSED_ONBOARDING,
        );
        expect(platform.ensureComment).toHaveBeenCalledTimes(1);
        expect(platform.updatePr).toHaveBeenCalledWith({
          number: 1,
          state: 'closed',
          prTitle: 'Configure Renovate',
        });
      });

      it('does not comment, when onboarding pr is exactly at onboardingAutoCloseAge', async () => {
        const now = DateTime.now();
        vi.setSystemTime(now.toMillis());
        // at exactly 1 day ago, which means that an `onboardingAutoCloseAge=1` SHOULD NOT trigger, as it's > 1
        const createdAt = now.minus({ hour: 24 });

        config.baseBranch = 'some-branch';
        GlobalConfig.set({ onboardingAutoCloseAge: 1 });
        platform.getBranchPr.mockResolvedValueOnce(
          partial<Pr>({
            title: 'Configure Renovate',
            bodyStruct,
            createdAt: createdAt.toISO(),
            number: 1,
          }),
        );
        await ensureOnboardingPr(config, {}, branches);
        expect(platform.ensureComment).toHaveBeenCalledTimes(0);
        expect(platform.createPr).toHaveBeenCalledTimes(0);
      });

      it('ensures comment, when onboarding pr is partially over onboardingAutoCloseAge', async () => {
        const now = DateTime.now();
        vi.setSystemTime(now.toMillis());
        // we're currently 1 day and 1 second ahead of the creation time, which is 1.x days since the PR was created, which means that an `onboardingAutoCloseAge=1` should trigger, as it's > 1
        const createdAt = now.minus({ hour: 24, seconds: 1 });

        config.baseBranch = 'some-branch';
        GlobalConfig.set({ onboardingAutoCloseAge: 1 });
        platform.getBranchPr.mockResolvedValueOnce(
          partial<Pr>({
            title: 'Configure Renovate',
            bodyStruct,
            createdAt: createdAt.toISO(),
            number: 1,
          }),
        );
        await expect(ensureOnboardingPr(config, {}, branches)).rejects.toThrow(
          REPOSITORY_CLOSED_ONBOARDING,
        );
        expect(platform.ensureComment).toHaveBeenCalledTimes(1);
        expect(platform.updatePr).toHaveBeenCalledWith({
          number: 1,
          state: 'closed',
          prTitle: 'Configure Renovate',
        });
      });

      it('ensures comment, when onboarding pr is 1 day older than onboardingAutoCloseAge', async () => {
        const now = DateTime.now();
        vi.setSystemTime(now.toMillis());
        // we're currently 25 hours ahead of the creation time, which is 1.x days since the PR was created, which means that an `onboardingAutoCloseAge=1` should trigger, as it's > 1
        const createdAt = now.minus({ hour: 48 });

        config.baseBranch = 'some-branch';
        GlobalConfig.set({ onboardingAutoCloseAge: 1 });
        platform.getBranchPr.mockResolvedValueOnce(
          partial<Pr>({
            title: 'Configure Renovate',
            bodyStruct,
            createdAt: createdAt.toISO(),
            number: 1,
          }),
        );
        await expect(ensureOnboardingPr(config, {}, branches)).rejects.toThrow(
          REPOSITORY_CLOSED_ONBOARDING,
        );
        expect(platform.ensureComment).toHaveBeenCalledTimes(1);
        expect(platform.updatePr).toHaveBeenCalledWith({
          number: 1,
          state: 'closed',
          prTitle: 'Configure Renovate',
        });
      });

      it('ensures comment,when onboarding pr is significantly older than onboardingAutoCloseAge', async () => {
        config.baseBranch = 'some-branch';
        GlobalConfig.set({ onboardingAutoCloseAge: 1 });
        platform.getBranchPr.mockResolvedValueOnce(
          partial<Pr>({
            title: 'Configure Renovate',
            bodyStruct,
            createdAt: '2020-02-29T01:40:21Z',
            number: 1,
          }),
        );
        await expect(ensureOnboardingPr(config, {}, branches)).rejects.toThrow(
          REPOSITORY_CLOSED_ONBOARDING,
        );
        expect(platform.ensureComment).toHaveBeenCalledTimes(1);
        expect(platform.updatePr).toHaveBeenCalledWith({
          number: 1,
          state: 'closed',
          prTitle: 'Configure Renovate',
        });
      });

      it('prefers inherited onboardingAutoCloseAge over global config', async () => {
        const now = DateTime.now();
        vi.setSystemTime(now.toMillis());
        // PR was created 36 hours ago (1.5 days)
        const createdAt = now.minus({ hour: 36 });

        config.baseBranch = 'some-branch';
        GlobalConfig.set({ onboardingAutoCloseAge: 2 });
        InheritConfig.set({ onboardingAutoCloseAge: 1 });

        platform.getBranchPr.mockResolvedValueOnce(
          partial<Pr>({
            title: 'Configure Renovate',
            bodyStruct,
            createdAt: createdAt.toISO(),
            number: 1,
          }),
        );
        await expect(ensureOnboardingPr(config, {}, branches)).rejects.toThrow(
          REPOSITORY_CLOSED_ONBOARDING,
        );
        expect(platform.ensureComment).toHaveBeenCalledTimes(1);
        expect(platform.updatePr).toHaveBeenCalledWith({
          number: 1,
          state: 'closed',
          prTitle: 'Configure Renovate',
        });
      });

      it('does not allow inherited onboardingAutoCloseAge to be higher than global config', async () => {
        const now = DateTime.now();
        vi.setSystemTime(now.toMillis());
        // PR was created 36 hours ago (1.5 days)
        const createdAt = now.minus({ hour: 36 });

        config.baseBranch = 'some-branch';
        GlobalConfig.set({ onboardingAutoCloseAge: 1 });
        InheritConfig.set({ onboardingAutoCloseAge: 10 });

        platform.getBranchPr.mockResolvedValueOnce(
          partial<Pr>({
            title: 'Configure Renovate',
            bodyStruct,
            createdAt: createdAt.toISO(),
            number: 1,
          }),
        );
        await expect(ensureOnboardingPr(config, {}, branches)).rejects.toThrow(
          REPOSITORY_CLOSED_ONBOARDING,
        );
        expect(platform.ensureComment).toHaveBeenCalledTimes(1);
        expect(platform.updatePr).toHaveBeenCalledWith({
          number: 1,
          state: 'closed',
          prTitle: 'Configure Renovate',
        });
      });
    });

    it('does nothing in dry run when PR is conflicted', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      config.baseBranch = 'some-branch';
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'Configure Renovate',
          bodyStruct,
        }),
      );
      scm.isBranchConflicted.mockResolvedValueOnce(true);
      await ensureOnboardingPr(config, {}, branches);
      expect(logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would comment that Onboarding PR is conflicted and needs manual resolving',
      );
      expect(platform.ensureComment).toHaveBeenCalledTimes(0);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('updates PR when modified', async () => {
      config.baseBranch = 'some-branch';
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'Configure Renovate',
          bodyStruct,
        }),
      );
      await ensureOnboardingPr(config, {}, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });

    it('creates PR (no require config)', async () => {
      config.requireConfig = 'optional';
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
    });

    it('creates PR (require config)', async () => {
      config.requireConfig = 'required';
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
    });

    it('dryrun of creates PR', async () => {
      GlobalConfig.set({
        dryRun: 'full',
        onboardingBranch: config.onboardingBranch,
      });
      await ensureOnboardingPr(config, packageFiles, branches);

      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would check branch renovate/configure',
      );
      expect(logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would create onboarding PR',
      );
    });

    it('dryrun of updates PR', async () => {
      GlobalConfig.set({
        dryRun: 'full',
        onboardingBranch: config.onboardingBranch,
      });
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'Configure Renovate',
          bodyStruct,
        }),
      );
      await ensureOnboardingPr(config, packageFiles, branches);

      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would check branch renovate/configure',
      );
      expect(logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would update onboarding PR',
      );
    });

    describe('ensureOnboardingPr() throws', () => {
      const response = partial<Response>({ statusCode: 422 });
      const err = partial<RequestError>({ response });

      beforeEach(() => {
        GlobalConfig.reset();
        scm.deleteBranch.mockResolvedValue();
        platform.createPr.mockReset();
      });

      it('throws when trying to create a new PR', async () => {
        platform.createPr.mockRejectedValueOnce(err);
        await expect(
          ensureOnboardingPr(config, packageFiles, branches),
        ).toReject();
        expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
      });

      it('deletes branch when PR already exists but cannot find it', async () => {
        response.body = {
          errors: [{ message: 'A pull request already exists' }],
        };
        platform.createPr.mockRejectedValueOnce(err);
        await expect(
          ensureOnboardingPr(config, packageFiles, branches),
        ).toResolve();

        expect(logger.warn).toHaveBeenCalledWith(
          'Onboarding PR already exists but cannot find it. It was probably created by a different user.',
        );
        expect(scm.deleteBranch).toHaveBeenCalledTimes(1);
      });
    });
  });
});
