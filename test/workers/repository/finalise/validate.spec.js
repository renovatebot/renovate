const validate = require('../../../../lib/workers/repository/finalise/validate');

/** @type any */
const { platform } = require('../../../../lib/platform');

beforeEach(() => {
  jest.resetAllMocks();
});

describe('workers/repository/validate', () => {
  describe('validatePrs()', () => {
    it('returns if disabled', async () => {
      await validate.validatePrs({ suppressNotifications: ['prValidation'] });
    });
    it('catches error', async () => {
      platform.getPrList.mockReturnValueOnce([
        {
          state: 'open',
          branchName: 'some/branch',
          title: 'Update Renovate',
        },
      ]);
      await validate.validatePrs({});
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(0);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
    });
    it('returns if no matching files', async () => {
      platform.getPrList.mockReturnValueOnce([
        {
          state: 'open',
          branchName: 'some/branch',
          title: 'Update Renovate',
        },
      ]);
      platform.getPrFiles.mockReturnValueOnce(['readme.md']);
      await validate.validatePrs({});
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(0);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
    });
    it('validates failures if cannot parse', async () => {
      platform.getPrList.mockReturnValueOnce([
        {
          state: 'open',
          branchName: 'some/branch',
          title: 'Update Renovate',
        },
      ]);
      platform.getPrFiles.mockReturnValueOnce(['renovate.json']);
      platform.getFile.mockReturnValue('not JSON');
      await validate.validatePrs({});
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus.mock.calls[0][3]).toEqual('failure');
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
    });
    it('validates failures if config validation fails', async () => {
      platform.getPrList.mockReturnValueOnce([
        {
          state: 'open',
          branchName: 'some/branch',
          title: 'Update Renovate',
        },
      ]);
      platform.getPrFiles.mockReturnValueOnce(['renovate.json']);
      platform.getFile.mockReturnValue('{"foo":1}');
      await validate.validatePrs({});
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus.mock.calls[0][3]).toEqual('failure');
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
    });
    it('validates successfully', async () => {
      platform.getPrList.mockReturnValueOnce([
        {
          state: 'open',
          branchName: 'some/branch',
          title: 'Update Renovate',
        },
      ]);
      platform.getPrFiles.mockReturnValueOnce(['renovate.json']);
      platform.getFile.mockReturnValue('{}');
      await validate.validatePrs({});
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus.mock.calls[0][3]).toEqual('success');
      expect(platform.ensureComment).toHaveBeenCalledTimes(0);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(1);
    });
  });
});
