import { mock } from 'jest-mock-extended';
import {
  RenovateConfig,
  fs,
  getConfig,
  git,
  mocked,
  platform,
} from '../../../../../test/util';
import { configFileNames } from '../../../../config/app-strings';
import {
  REPOSITORY_FORKED,
  REPOSITORY_NO_PACKAGE_FILES,
} from '../../../../constants/error-messages';
import { Pr } from '../../../../platform';
import { PrState } from '../../../../types';
import * as _cache from '../../../../util/cache/repository';
import type { FileAddition } from '../../../../util/git/types';
import * as _config from './config';
import * as _rebase from './rebase';
import { checkOnboardingBranch } from '.';

const rebase: any = _rebase;
const configModule: any = _config;

jest.mock('../../../../workers/repository/onboarding/branch/rebase');
jest.mock('../../../../util/cache/repository');
jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');
jest.mock('./config');

const cache = mocked(_cache);

describe('workers/repository/onboarding/branch/index', () => {
  describe('checkOnboardingBranch', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
      config.repository = 'some/repo';
      git.getFileList.mockResolvedValue([]);
      cache.getCache.mockReturnValue({});
    });
    it('throws if no package files', async () => {
      await expect(checkOnboardingBranch(config)).rejects.toThrow(
        REPOSITORY_NO_PACKAGE_FILES
      );
    });

    it("doesn't throw if there are no package files and onboardingNoDeps config option is set", async () => {
      config.onboardingNoDeps = true;
      await expect(checkOnboardingBranch(config)).resolves.not.toThrow(
        REPOSITORY_NO_PACKAGE_FILES
      );
    });

    it('throws if fork', async () => {
      config.isFork = true;
      await expect(checkOnboardingBranch(config)).rejects.toThrow(
        REPOSITORY_FORKED
      );
    });
    it('has default onboarding config', async () => {
      configModule.getOnboardingConfig.mockResolvedValue(
        config.onboardingConfig
      );
      configModule.getOnboardingConfigContents.mockResolvedValue(
        '{\n' +
          '  "$schema": "https://docs.renovatebot.com/renovate-schema.json"\n' +
          '}\n'
      );
      git.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      await checkOnboardingBranch(config);
      const file = git.commitFiles.mock.calls[0][0].files[0] as FileAddition;
      const contents = file.contents.toString();
      expect(contents).toBeJsonString();
      expect(JSON.parse(contents)).toEqual({
        $schema: 'https://docs.renovatebot.com/renovate-schema.json',
      });
    });
    it('uses discovered onboarding config', async () => {
      configModule.getOnboardingConfig.mockResolvedValue({
        onboardingBranch: 'test',
      });
      configModule.getOnboardingConfigContents.mockResolvedValue(
        '{\n' +
          '  "$schema": "https://docs.renovatebot.com/renovate-schema.json",\n' +
          '  "extends": ["some/renovate-config"]\n' +
          '}\n'
      );
      git.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      await checkOnboardingBranch(config);
      expect(configModule.getOnboardingConfigContents).toHaveBeenCalledWith(
        {
          ...config,
          onboardingBranch: 'test',
          renovateJsonPresent: true,
          warnings: [],
        },
        configFileNames[0]
      );
      const file = git.commitFiles.mock.calls[0][0].files[0] as FileAddition;
      const contents = file.contents.toString();
      expect(contents).toBeJsonString();
      expect(JSON.parse(contents)).toEqual({
        $schema: 'https://docs.renovatebot.com/renovate-schema.json',
        extends: ['some/renovate-config'],
      });
    });
    it('handles skipped onboarding combined with requireConfig = false', async () => {
      config.requireConfig = false;
      config.onboarding = false;
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });
    it('handles skipped onboarding, requireConfig=true, and a config file', async () => {
      config.requireConfig = true;
      config.onboarding = false;
      git.getFileList.mockResolvedValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });
    it('handles skipped onboarding, requireConfig=true, and no config file', async () => {
      config.requireConfig = true;
      config.onboarding = false;
      git.getFileList.mockResolvedValueOnce(['package.json']);
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const onboardingResult = checkOnboardingBranch(config);
      await expect(onboardingResult).rejects.toThrow('disabled');
    });
    it('detects repo is onboarded via file', async () => {
      git.getFileList.mockResolvedValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('handles removed cached file name', async () => {
      cache.getCache.mockReturnValue({ configFileName: '.renovaterc' });
      git.getFileList.mockResolvedValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('handles cached file name', async () => {
      cache.getCache.mockReturnValue({ configFileName: '.renovaterc' });
      platform.getJsonFile.mockResolvedValueOnce({});
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('handles cached package.json', async () => {
      cache.getCache.mockReturnValue({ configFileName: 'package.json' });
      platform.getJsonFile.mockResolvedValueOnce({ renovate: {} });
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });

    it('detects repo is onboarded via package.json config', async () => {
      git.getFileList.mockResolvedValueOnce(['package.json']);
      fs.readLocalFile.mockResolvedValueOnce('{"renovate":{}}');
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });
    it('detects repo is onboarded via PR', async () => {
      config.requireConfig = false;
      platform.findPr.mockResolvedValueOnce(mock<Pr>());
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeTrue();
    });
    it('throws if no required config', async () => {
      config.requireConfig = true;
      platform.findPr.mockResolvedValue(mock<Pr>());
      platform.getPrList.mockResolvedValueOnce([
        {
          ...mock<Pr>(),
          sourceBranch: 'renovate/something',
          state: PrState.Open,
        },
      ]);
      await expect(checkOnboardingBranch(config)).rejects.toThrow();
    });
    it('updates onboarding branch', async () => {
      git.getFileList.mockResolvedValue(['package.json']);
      platform.findPr.mockResolvedValue(null);
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      rebase.rebaseOnboardingBranch.mockResolvedValueOnce('123test');
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBeFalse();
      expect(res.branchList).toEqual(['renovate/configure']);
      expect(git.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
  });
});
