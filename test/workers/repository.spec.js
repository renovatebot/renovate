const repositoryWorker = require('../../lib/workers/repository');

jest.mock('../../lib/workers/branch');
jest.mock('../../lib/workers/pr');
jest.mock('../../lib/api/npm');
jest.mock('../../lib/helpers/versions');

describe('repositoryWorker', () => {
  describe('processUpgrades(upgrades)', () => {
    beforeEach(() => {
      repositoryWorker.updateBranch = jest.fn();
    });
    it('handles zero upgrades', async () => {
      await repositoryWorker.processUpgrades([]);
      expect(repositoryWorker.updateBranch.mock.calls.length).toBe(0);
    });
    it('handles non-zero upgrades', async () => {
      await repositoryWorker.processUpgrades([
        { branchName: 'a' },
        { branchName: 'b' },
      ]);
      expect(repositoryWorker.updateBranch.mock.calls.length).toBe(2);
    });
  });
});
