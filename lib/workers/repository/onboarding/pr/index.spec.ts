import type { RequestError, Response } from 'got';
import {
  RenovateConfig,
  partial,
  platform,
  scm,
} from '../../../../../test/util';
import { getConfig } from '../../../../config/defaults';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../../../modules/manager/types';
import type { Pr } from '../../../../modules/platform';
import * as memCache from '../../../../util/cache/memory';
import type { BranchConfig } from '../../../types';
import { OnboardingState } from '../common';
import { ensureOnboardingPr } from '.';

jest.mock('../../../../util/git');

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
      GlobalConfig.reset();
    });

    it('returns if onboarded', async () => {
      config.repoIsOnboarded = true;
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
      expect(platform.createPr).toHaveBeenCalledWith(
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
        'label',
        'additional-label',
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
      GlobalConfig.set({ dryRun: 'full' });
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would check branch renovate/configure',
      );
      expect(logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would create onboarding PR',
      );
    });

    it('dryrun of updates PR', async () => {
      GlobalConfig.set({ dryRun: 'full' });
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
