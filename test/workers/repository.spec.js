const repositoryWorker = require('../../lib/workers/repository');
const branchWorker = require('../../lib/workers/branch');

jest.mock('../../lib/workers/branch');
jest.mock('../../lib/workers/pr');
jest.mock('../../lib/api/npm');
jest.mock('../../lib/api/github');
jest.mock('../../lib/api/gitlab');
jest.mock('../../lib/helpers/versions');

describe('repositoryWorker', () => {
  describe('processUpgrades(upgrades)', () => {
    beforeEach(() => {
      repositoryWorker.updateBranch = jest.fn();
    });
    it('handles zero upgrades', async () => {
      // await repositoryWorker.processUpgrades([]);
      expect(branchWorker.updateBranch.mock.calls.length).toBe(0);
    });
    it('handles non-zero upgrades', async () => {
      await repositoryWorker.processUpgrades([
        { branchName: 'a' },
        { branchName: 'b' },
      ]);
      expect(branchWorker.updateBranch.mock.calls.length).toBe(2);
    });
  });
});
