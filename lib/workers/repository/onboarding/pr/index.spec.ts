import type { RequestError, Response } from 'got';
import type { RenovateConfig } from '../../../../../test/util';
import { mocked, partial, platform, scm } from '../../../../../test/util';
import { getConfig } from '../../../../config/defaults';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../../../modules/manager/types';
import type { Pr } from '../../../../modules/platform';
import * as memCache from '../../../../util/cache/memory';
import type { BranchConfig } from '../../../types';
import { OnboardingState } from '../common';
import * as _prBody from './body';
import { ensureOnboardingPr } from '.';

jest.mock('../../../../util/git');

jest.mock('./body');
const prBody = mocked(_prBody);

describe('workers/repository/onboarding/pr/index', () => {
  describe('ensureOnboardingPr()', () => {
    let config: RenovateConfig;
    let packageFiles: Record<string, PackageFile[]>;
    let branches: BranchConfig[];

    const bodyStruct = {
      hash: '230d8358dc8e8890b4c58deeb62912ee2f20357ae92a5cc861b98e68fe31acb5',
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
      platform.createPr.mockResolvedValueOnce(partial<Pr>({ number: 3.14 }));
      platform.maxBodyLength.mockReturnValueOnce(Infinity);
      prBody.getPrBody.mockReturnValue({
        body: 'body',
        comments: [
          { content: 'content', title: 'PR List' },
          { content: 'content', title: 'Package Files' },
        ],
      });
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
        'additional-label',
        'label',
      ]);
    });

    it('returns if PR does not need updating', async () => {
      OnboardingState.prUpdateRequested = true; // case 'false' is tested in "breaks early when onboarding"
      platform.getBranchPr.mockResolvedValue(
        partial<Pr>({
          title: 'Configure Renovate',
          bodyStruct,
        }),
      );

      await ensureOnboardingPr(config, packageFiles, branches);

      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

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
      prBody.getPrBody.mockReturnValueOnce({
        body: 'changed Body',
        comments: [],
      });

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
      prBody.getPrBody.mockReturnValueOnce({
        body: 'changed Body',
        comments: [],
      });

      await ensureOnboardingPr(config, packageFiles, branches);

      expect(logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would update onboarding PR',
      );
    });

    it('creates comments if prBody contains comments', async () => {
      prBody.getPrBody.mockReturnValueOnce({
        body: 'body',
        comments: [
          { content: 'content', title: 'PR List' },
          { content: 'content', title: 'Package Files' },
        ],
      });

      await ensureOnboardingPr(config, packageFiles, branches);

      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.ensureComment).toHaveBeenCalledWith({
        number: expect.anything(),
        topic: 'PR List',
        content: 'content',
      });
      expect(platform.ensureComment).toHaveBeenCalledWith({
        number: expect.anything(),
        topic: 'Package Files',
        content: 'content',
      });
      expect(platform.ensureCommentRemoval).not.toHaveBeenCalled();
    });

    it('creates comments if prBody contains comments on existing Pr', async () => {
      prBody.getPrBody.mockReturnValueOnce({
        body: 'body',
        comments: [
          { content: 'content', title: 'PR List' },
          { content: 'content', title: 'Package Files' },
        ],
      });
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'Configure Renovate',
          bodyStruct,
          number: 1234,
        }),
      );

      await ensureOnboardingPr(config, packageFiles, branches);

      expect(platform.ensureComment).toHaveBeenCalledWith({
        number: expect.anything(),
        topic: 'PR List',
        content: 'content',
      });
      expect(platform.ensureComment).toHaveBeenCalledWith({
        number: expect.anything(),
        topic: 'Package Files',
        content: 'content',
      });
      expect(platform.ensureCommentRemoval).not.toHaveBeenCalled();
    });

    it('removes comments if prBody does not contains comments', async () => {
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'Configure Renovate',
          bodyStruct,
          number: 1234,
        }),
      );
      prBody.getPrBody.mockReturnValue({
        body: 'body',
        comments: [],
      });

      await ensureOnboardingPr(config, packageFiles, branches);

      expect(platform.ensureComment).not.toHaveBeenCalled();
      expect(platform.ensureCommentRemoval).toHaveBeenCalledWith({
        number: expect.anything(),
        type: 'by-topic',
        topic: 'PR List',
      });
      expect(platform.ensureCommentRemoval).toHaveBeenCalledWith({
        number: expect.anything(),
        type: 'by-topic',
        topic: 'Package Files',
      });
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
