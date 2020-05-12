import { mock } from 'jest-mock-extended';
import {
  RenovateConfig,
  fs,
  getConfig,
  platform,
} from '../../../../../test/util';
import { PR_STATE_OPEN } from '../../../../constants/pull-requests';
import { Pr } from '../../../../platform';
import * as _rebase from './rebase';
import { checkOnboardingBranch } from '.';

const rebase: any = _rebase;

jest.mock('../../../../workers/repository/onboarding/branch/rebase');
jest.mock('../../../../util/fs');

describe('workers/repository/onboarding/branch', () => {
  describe('checkOnboardingBranch', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
      platform.getFileList.mockResolvedValue([]);
    });
    it('throws if no package files', async () => {
      await expect(checkOnboardingBranch(config)).rejects.toThrow();
    });
    it('throws if fork', async () => {
      config.isFork = true;
      await expect(checkOnboardingBranch(config)).rejects.toThrow();
    });
    it('has default onboarding config', async () => {
      platform.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      await checkOnboardingBranch(config);
      expect(
        platform.commitFilesToBranch.mock.calls[0][0].files[0].contents
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
      platform.getFileList.mockResolvedValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('handles skipped onboarding, requireConfig=true, and no config file', async () => {
      config.requireConfig = true;
      config.onboarding = false;
      platform.getFileList.mockResolvedValueOnce(['package.json']);
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const onboardingResult = checkOnboardingBranch(config);
      await expect(onboardingResult).rejects.toThrow('disabled');
    });
    it('detects repo is onboarded via file', async () => {
      platform.getFileList.mockResolvedValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('detects repo is onboarded via package.json config', async () => {
      platform.getFileList.mockResolvedValueOnce(['package.json']);
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
          branchName: 'renovate/something',
          state: PR_STATE_OPEN,
        },
      ]);
      await expect(checkOnboardingBranch(config)).rejects.toThrow();
    });
    it('creates onboarding branch with greenkeeper migration', async () => {
      platform.getFileList.mockResolvedValue(['package.json']);
      const pJsonContent = JSON.stringify({
        name: 'some-name',
        version: '0.0.1',
        greenkeeper: {
          label: 'greenkeeper',
          branchName: 'greenkeeper--',
          ignore: ['foo', 'bar'],
        },
      });
      fs.readLocalFile.mockResolvedValue(pJsonContent);
      platform.commitFilesToBranch.mockResolvedValueOnce('abc123');
      await checkOnboardingBranch(config);
      expect(
        platform.commitFilesToBranch.mock.calls[0][0].files[0].contents
      ).toMatchSnapshot();
    });
    it('updates onboarding branch', async () => {
      platform.getFileList.mockResolvedValue(['package.json']);
      platform.findPr.mockResolvedValue(null);
      platform.getBranchPr.mockResolvedValueOnce(mock<Pr>());
      rebase.rebaseOnboardingBranch.mockResolvedValueOnce('abc123');
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(false);
      expect(res.branchList).toEqual(['renovate/configure']);
      expect(platform.setBaseBranch).toHaveBeenCalledTimes(1);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(0);
    });
  });
});
