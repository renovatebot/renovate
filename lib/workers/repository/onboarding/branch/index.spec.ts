import { mock } from 'jest-mock-extended';
import {
  RenovateConfig,
  fs,
  getConfig,
  getName,
  git,
  platform,
} from '../../../../../test/util';
import { Pr } from '../../../../platform';
import { PrState } from '../../../../types';
import * as _rebase from './rebase';
import { checkOnboardingBranch } from '.';

const rebase: any = _rebase;

jest.mock('../../../../workers/repository/onboarding/branch/rebase');
jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');

describe(getName(__filename), () => {
  describe('checkOnboardingBranch', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
      config.repository = 'some/repo';
      git.getFileList.mockResolvedValue([]);
    });
    it('throws if no package files', async () => {
      await expect(checkOnboardingBranch(config)).rejects.toThrow();
    });
    it('throws if fork', async () => {
      config.isFork = true;
      await expect(checkOnboardingBranch(config)).rejects.toThrow();
    });
    it('has default onboarding config', async () => {
      git.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      await checkOnboardingBranch(config);
      expect(
        git.commitFiles.mock.calls[0][0].files[0].contents
      ).toMatchSnapshot();
    });
    it('handles skipped onboarding combined with requireConfig = false', async () => {
      config.requireConfig = false;
      config.onboarding = false;
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('handles skipped onboarding, requireConfig=true, and a config file', async () => {
      config.requireConfig = true;
      config.onboarding = false;
      git.getFileList.mockResolvedValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
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
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('detects repo is onboarded via package.json config', async () => {
      git.getFileList.mockResolvedValueOnce(['package.json']);
      fs.readLocalFile.mockResolvedValueOnce('{"renovate":{}}');
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('detects repo is onboarded via PR', async () => {
      config.requireConfig = false;
      platform.findPr.mockResolvedValueOnce(mock<Pr>());
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
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
      rebase.rebaseOnboardingBranch.mockResolvedValueOnce('abc123');
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(false);
      expect(res.branchList).toEqual(['renovate/configure']);
      expect(git.checkoutBranch).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
  });
});
