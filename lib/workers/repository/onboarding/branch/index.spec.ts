import { mock } from 'jest-mock-extended';
import {
  RenovateConfig,
  fs,
  getConfig,
  getName,
  git,
  platform,
} from '../../../../../test/util';
import {
  REPOSITORY_FORKED,
  REPOSITORY_NO_PACKAGE_FILES,
} from '../../../../constants/error-messages';
import { Pr } from '../../../../platform';
import { PrState } from '../../../../types';
import * as _config from './config';
import * as _rebase from './rebase';
import { checkOnboardingBranch } from '.';

const rebase: any = _rebase;
const config: any = _config;

jest.mock('../../../../workers/repository/onboarding/branch/rebase');
jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');
jest.mock('./config');

describe(getName(), () => {
  describe('checkOnboardingBranch', () => {
    let configuration: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      configuration = getConfig();
      configuration.repository = 'some/repo';
      git.getFileList.mockResolvedValue([]);
    });
    it('throws if no package files', async () => {
      await expect(checkOnboardingBranch(configuration)).rejects.toThrow(
        REPOSITORY_NO_PACKAGE_FILES
      );
    });
    it('throws if fork', async () => {
      configuration.isFork = true;
      await expect(checkOnboardingBranch(configuration)).rejects.toThrow(
        REPOSITORY_FORKED
      );
    });
    it('has default onboarding config', async () => {
      config.getOnboardingConfig.mockResolvedValue(
        configuration.onboardingConfig
      );
      config.getOnboardingConfigContents.mockResolvedValue(
        '{\n' +
          '  "$schema": "https://docs.renovatebot.com/renovate-schema.json"\n' +
          '}\n'
      );
      git.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      await checkOnboardingBranch(configuration);
      expect(
        git.commitFiles.mock.calls[0][0].files[0].contents
      ).toMatchSnapshot();
    });
    it('uses discovered onboarding config', async () => {
      config.getOnboardingConfig.mockResolvedValue({
        onboardingBranch: 'test',
      });
      config.getOnboardingConfigContents.mockResolvedValue(
        '{\n' +
          '  "$schema": "https://docs.renovatebot.com/renovate-schema.json",\n' +
          '  "extends: ["some/renovate-config"]\n' +
          '}\n'
      );
      git.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      await checkOnboardingBranch(configuration);
      expect(config.getOnboardingConfigContents).toHaveBeenCalledWith({
        ...configuration,
        onboardingBranch: 'test',
        renovateJsonPresent: true,
        warnings: [],
      });
      expect(
        git.commitFiles.mock.calls[0][0].files[0].contents
      ).toMatchSnapshot();
    });
    it('handles skipped onboarding combined with requireConfig = false', async () => {
      configuration.requireConfig = false;
      configuration.onboarding = false;
      const res = await checkOnboardingBranch(configuration);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('handles skipped onboarding, requireConfig=true, and a config file', async () => {
      configuration.requireConfig = true;
      configuration.onboarding = false;
      git.getFileList.mockResolvedValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(configuration);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('handles skipped onboarding, requireConfig=true, and no config file', async () => {
      configuration.requireConfig = true;
      configuration.onboarding = false;
      git.getFileList.mockResolvedValueOnce(['package.json']);
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const onboardingResult = checkOnboardingBranch(configuration);
      await expect(onboardingResult).rejects.toThrow('disabled');
    });
    it('detects repo is onboarded via file', async () => {
      git.getFileList.mockResolvedValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(configuration);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('detects repo is onboarded via package.json config', async () => {
      git.getFileList.mockResolvedValueOnce(['package.json']);
      fs.readLocalFile.mockResolvedValueOnce('{"renovate":{}}');
      const res = await checkOnboardingBranch(configuration);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('detects repo is onboarded via PR', async () => {
      configuration.requireConfig = false;
      platform.findPr.mockResolvedValueOnce(mock<Pr>());
      const res = await checkOnboardingBranch(configuration);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('throws if no required config', async () => {
      configuration.requireConfig = true;
      platform.findPr.mockResolvedValue(mock<Pr>());
      platform.getPrList.mockResolvedValueOnce([
        {
          ...mock<Pr>(),
          sourceBranch: 'renovate/something',
          state: PrState.Open,
        },
      ]);
      await expect(checkOnboardingBranch(configuration)).rejects.toThrow();
    });
    it('updates onboarding branch', async () => {
      git.getFileList.mockResolvedValue(['package.json']);
      platform.findPr.mockResolvedValue(null);
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      rebase.rebaseOnboardingBranch.mockResolvedValueOnce('abc123');
      const res = await checkOnboardingBranch(configuration);
      expect(res.repoIsOnboarded).toBe(false);
      expect(res.branchList).toEqual(['renovate/configure']);
      expect(git.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
  });
});
