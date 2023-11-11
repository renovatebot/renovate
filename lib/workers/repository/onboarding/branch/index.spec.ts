import { mock } from 'jest-mock-extended';
import {
  RenovateConfig,
  fs,
  git,
  mocked,
  platform,
  scm,
} from '../../../../../test/util';
import { configFileNames } from '../../../../config/app-strings';
import { getConfig } from '../../../../config/defaults';
import { GlobalConfig } from '../../../../config/global';
import {
  REPOSITORY_FORKED,
  REPOSITORY_NO_PACKAGE_FILES,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import * as memCache from '../../../../util/cache/memory';
import * as _cache from '../../../../util/cache/repository';
import type { RepoCacheData } from '../../../../util/cache/repository/types';
import type { FileAddition } from '../../../../util/git/types';
import { OnboardingState } from '../common';
import * as _config from './config';
import * as _onboardingCache from './onboarding-branch-cache';
import { checkOnboardingBranch } from '.';

const configModule: any = _config;

jest.mock('../../../../util/cache/repository');
jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');
jest.mock('./config');
jest.mock('./onboarding-branch-cache');

const cache = mocked(_cache);
const onboardingCache = mocked(_onboardingCache);

describe('workers/repository/onboarding/branch/index', () => {
  describe('checkOnboardingBranch', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      memCache.init();
      config = getConfig();
      config.repository = 'some/repo';
      OnboardingState.prUpdateRequested = false;
      scm.getFileList.mockResolvedValue([]);
      cache.getCache.mockReturnValue({});
    });

    it('throws if no package files', async () => {
      await expect(checkOnboardingBranch(config)).rejects.toThrow(
        REPOSITORY_NO_PACKAGE_FILES,
      );
    });

    it("doesn't throw if there are no package files and onboardingNoDeps config option is set", async () => {
      config.onboardingNoDeps = true;
      await expect(checkOnboardingBranch(config)).resolves.not.toThrow(
        REPOSITORY_NO_PACKAGE_FILES,
      );
    });

    it('throws if fork', async () => {
      config.isFork = true;
      await expect(checkOnboardingBranch(config)).rejects.toThrow(
        REPOSITORY_FORKED,
      );
    });

    it.each`
      checkboxEnabled | expected
      ${true}         | ${true}
      ${false}        | ${false}
    `(
      'has default onboarding config' +
        '(config.onboardingRebaseCheckbox="$checkboxEnabled")',
      async ({ checkboxEnabled, expected }) => {
        config.onboardingRebaseCheckbox = checkboxEnabled;
        configModule.getOnboardingConfig.mockResolvedValue(
          config.onboardingConfig,
        );
        configModule.getOnboardingConfigContents.mockResolvedValue(
          '{\n' +
            '  "$schema": "https://docs.renovatebot.com/renovate-schema.json"\n' +
            '}\n',
        );
        scm.getFileList.mockResolvedValue(['package.json']);
        fs.readLocalFile.mockResolvedValue('{}');
        await checkOnboardingBranch(config);
        const file = scm.commitAndPush.mock.calls[0][0]
          .files[0] as FileAddition;
        const contents = file.contents?.toString();
        expect(contents).toBeJsonString();
        // TODO #22198
        expect(JSON.parse(contents!)).toEqual({
          $schema: 'https://docs.renovatebot.com/renovate-schema.json',
        });
        expect(OnboardingState.prUpdateRequested).toBe(expected);
      },
    );

    it('uses discovered onboarding config', async () => {
      configModule.getOnboardingConfig.mockResolvedValue({
        onboardingBranch: 'test',
      });
      configModule.getOnboardingConfigContents.mockResolvedValue(
        '{\n' +
          '  "$schema": "https://docs.renovatebot.com/renovate-schema.json",\n' +
          '  "extends": ["some/renovate-config"]\n' +
          '}\n',
      );
      scm.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      await checkOnboardingBranch(config);
      const expectConfig = {
        ...config,
        onboardingBranch: 'test',
        renovateJsonPresent: true,
        warnings: [],
      };
      delete expectConfig.extends;
      delete expectConfig.ignorePresets;
      expect(configModule.getOnboardingConfigContents).toHaveBeenCalledWith(
        expectConfig,
        configFileNames[0],
      );
      const file = scm.commitAndPush.mock.calls[0][0].files[0] as FileAddition;
      const contents = file.contents?.toString();
      expect(contents).toBeJsonString();
      // TODO #22198
      expect(JSON.parse(contents!)).toEqual({
        $schema: 'https://docs.renovatebot.com/renovate-schema.json',
        extends: ['some/renovate-config'],
      });
    });

    it('handles skipped onboarding combined with requireConfig = optional', async () => {
      config.requireConfig = 'optional';
      config.onboarding = false;
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('handles skipped onboarding, requireConfig=required, and a config file', async () => {
      config.requireConfig = 'required';
      config.onboarding = false;
      scm.getFileList.mockResolvedValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('handles skipped onboarding, requireConfig=ignored', async () => {
      config.requireConfig = 'ignored';
      config.onboarding = false;
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('handles skipped onboarding, requireConfig=required, and no config file', async () => {
      config.requireConfig = 'required';
      config.onboarding = false;
      scm.getFileList.mockResolvedValueOnce(['package.json']);
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const onboardingResult = checkOnboardingBranch(config);
      await expect(onboardingResult).rejects.toThrow('disabled');
    });

    it('detects repo is onboarded via file', async () => {
      scm.getFileList.mockResolvedValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
      expect(onboardingCache.deleteOnboardingCache).toHaveBeenCalledTimes(1); // removes onboarding cache when repo is onboarded
    });

    it('handles removed cached file name', async () => {
      cache.getCache.mockReturnValue({ configFileName: '.renovaterc' });
      scm.getFileList.mockResolvedValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('handles cached file name', async () => {
      cache.getCache.mockReturnValue({ configFileName: '.renovaterc' });
      platform.getJsonFile.mockResolvedValueOnce({});
      const res = await checkOnboardingBranch(config);
      expect(logger.debug).toHaveBeenCalledWith(
        'Checking cached config file name',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Existing config file confirmed',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        {
          fileName: '.renovaterc',
          config: {},
        },
        'Repository config',
      );
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('handles cached package.json', async () => {
      cache.getCache.mockReturnValue({ configFileName: 'package.json' });
      platform.getJsonFile.mockResolvedValueOnce({ renovate: {} });
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const res = await checkOnboardingBranch(config);
      expect(logger.debug).toHaveBeenCalledWith(
        'Checking cached config file name',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Existing config file confirmed',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        {
          fileName: 'package.json',
          config: {
            renovate: {},
          },
        },
        'Repository config',
      );
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('detects repo is onboarded via package.json config', async () => {
      scm.getFileList.mockResolvedValueOnce(['package.json']);
      fs.readLocalFile.mockResolvedValueOnce('{"renovate":{}}');
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('detects repo is onboarded via PR', async () => {
      config.requireConfig = 'optional';
      platform.findPr.mockResolvedValueOnce(mock<Pr>());
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('throws if no required config', async () => {
      config.requireConfig = 'required';
      platform.findPr.mockResolvedValue(mock<Pr>());
      platform.getPrList.mockResolvedValueOnce([
        {
          ...mock<Pr>(),
          sourceBranch: 'renovate/something',
          state: 'open',
        },
      ]);
      await expect(checkOnboardingBranch(config)).rejects.toThrow();
    });

    it('processes onboarding branch', async () => {
      scm.getFileList.mockResolvedValue(['package.json']);
      platform.findPr.mockResolvedValue(null);
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeFalse();
      expect(res.branchList).toEqual(['renovate/configure']);
      expect(scm.mergeToLocal).toHaveBeenCalledOnce();
      expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
    });

    it('skips processing onboarding branch when main/onboarding SHAs have not changed', async () => {
      GlobalConfig.set({ platform: 'github' });
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'onboarding-sha',
          isConflicted: false,
          isModified: false,
          configFileParsed: 'raw',
          configFileName: 'renovate.json',
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      scm.getFileList.mockResolvedValue(['package.json']);
      platform.findPr.mockResolvedValue(null); // finds closed onboarding pr
      platform.getBranchPr.mockResolvedValueOnce(
        mock<Pr>({ bodyStruct: { rebaseRequested: false } }),
      ); // finds open onboarding pr
      git.getBranchCommit
        .mockReturnValueOnce('default-sha')
        .mockReturnValueOnce('default-sha')
        .mockReturnValueOnce('onboarding-sha');
      config.onboardingRebaseCheckbox = true;
      await checkOnboardingBranch(config);
      expect(scm.mergeToLocal).not.toHaveBeenCalled();
    });

    it('processes modified onboarding branch and invalidates extract cache', async () => {
      const dummyCache = {
        scan: {
          master: {
            sha: 'base_sha',
            configHash: 'hash',
            packageFiles: {},
            extractionFingerprints: {},
          },
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      platform.findPr.mockResolvedValue(null);
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      git.getBranchCommit
        .mockReturnValueOnce('default-sha')
        .mockReturnValueOnce('new-onboarding-sha');
      onboardingCache.isOnboardingBranchModified.mockResolvedValueOnce(true);
      onboardingCache.hasOnboardingBranchChanged.mockReturnValueOnce(true);
      onboardingCache.isOnboardingBranchConflicted.mockResolvedValueOnce(false);
      config.baseBranch = 'master';
      await checkOnboardingBranch(config);
      expect(scm.mergeToLocal).toHaveBeenCalledOnce();
      expect(onboardingCache.setOnboardingCache).toHaveBeenCalledWith(
        'default-sha',
        'new-onboarding-sha',
        false,
        true,
      );
      expect(dummyCache).toMatchObject({
        scan: {},
      });
    });

    it('skips processing conflicted onboarding branch', async () => {
      scm.getFileList.mockResolvedValue(['package.json']);
      platform.findPr.mockResolvedValue(null);
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      git.getBranchCommit
        .mockReturnValueOnce('default-sha')
        .mockReturnValueOnce('onboarding-sha');
      onboardingCache.isOnboardingBranchModified.mockResolvedValueOnce(true);
      onboardingCache.hasOnboardingBranchChanged.mockReturnValueOnce(true);
      onboardingCache.isOnboardingBranchConflicted.mockResolvedValueOnce(true);
      await checkOnboardingBranch(config);
      expect(scm.mergeToLocal).not.toHaveBeenCalled();
      expect(onboardingCache.setOnboardingCache).toHaveBeenCalledWith(
        'default-sha',
        'onboarding-sha',
        true,
        true,
      );
    });

    it('sets onboarding cache for existing onboarding branch', async () => {
      scm.getFileList.mockResolvedValue(['package.json']);
      platform.findPr.mockResolvedValue(null);
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      git.getBranchCommit
        .mockReturnValueOnce('default-sha')
        .mockReturnValueOnce('onboarding-sha');
      onboardingCache.isOnboardingBranchModified.mockResolvedValueOnce(false);
      await checkOnboardingBranch(config);
      expect(scm.mergeToLocal).toHaveBeenCalled();
      expect(onboardingCache.setOnboardingCache).toHaveBeenCalledWith(
        'default-sha',
        'onboarding-sha',
        false,
        false,
      );
    });

    describe('tests onboarding rebase/retry checkbox handling', () => {
      beforeEach(() => {
        GlobalConfig.set({ platform: 'github' });
        config.onboardingRebaseCheckbox = true;
        OnboardingState.prUpdateRequested = false;
        scm.getFileList.mockResolvedValueOnce(['package.json']);
        platform.findPr.mockResolvedValueOnce(null);
      });

      it('detects unsupported platfom', async () => {
        const pl = 'bitbucket';
        GlobalConfig.set({ platform: pl });
        platform.getBranchPr.mockResolvedValueOnce(mock<Pr>({}));

        await checkOnboardingBranch(config);

        expect(logger.trace).toHaveBeenCalledWith(
          `Platform '${pl}' does not support extended markdown`,
        );
        expect(OnboardingState.prUpdateRequested).toBeTrue();
        expect(scm.mergeToLocal).toHaveBeenCalledOnce();
        expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
      });

      it('detects missing rebase checkbox', async () => {
        const pr = { bodyStruct: undefined };
        platform.getBranchPr.mockResolvedValueOnce(mock<Pr>(pr));

        await checkOnboardingBranch(config);

        expect(logger.debug).toHaveBeenCalledWith(
          `No rebase checkbox was found in the onboarding PR`,
        );
        expect(OnboardingState.prUpdateRequested).toBeTrue();
        expect(scm.mergeToLocal).toHaveBeenCalledOnce();
        expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
      });

      it('detects manual pr update requested', async () => {
        const pr = { bodyStruct: { rebaseRequested: true } };
        platform.getBranchPr.mockResolvedValueOnce(mock<Pr>(pr));

        await checkOnboardingBranch(config);

        expect(logger.debug).toHaveBeenCalledWith(
          `Manual onboarding PR update requested`,
        );
        expect(OnboardingState.prUpdateRequested).toBeTrue();
        expect(scm.mergeToLocal).toHaveBeenCalledOnce();
        expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
      });

      it('handles unchecked rebase checkbox', async () => {
        const pr = { bodyStruct: { rebaseRequested: false } };
        platform.getBranchPr.mockResolvedValueOnce(mock<Pr>(pr));

        await checkOnboardingBranch(config);

        expect(OnboardingState.prUpdateRequested).toBeFalse();
        expect(scm.mergeToLocal).toHaveBeenCalledOnce();
        expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
      });
    });
  });
});
