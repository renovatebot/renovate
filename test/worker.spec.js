const logger = require('winston');
const worker = require('../lib/worker');
const branchWorker = require('../lib/workers/branch');
const prWorker = require('../lib/workers/pr');
const defaultConfig = require('../lib/config/defaults').getConfig();

logger.remove(logger.transports.Console);

jest.mock('../lib/workers/branch');
jest.mock('../lib/workers/pr');

describe('worker', () => {
  describe('updateDependency(upgrade)', () => {
    let config;
    beforeEach(() => {
      config = Object.assign({}, defaultConfig);
      config.api = {
        checkForClosedPr: jest.fn(),
      };
      branchWorker.ensureBranch = jest.fn();
      prWorker.ensurePr = jest.fn();
    });
    it('returns immediately if closed PR found', async () => {
      config.api.checkForClosedPr.mockReturnValue(true);
      await worker.updateDependency(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(0);
    });
    it('does not return immediately if recreateClosed true', async () => {
      config.api.checkForClosedPr.mockReturnValue(true);
      config.recreateClosed = true;
      await worker.updateDependency(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('pins', async () => {
      config.upgradeType = 'pin';
      await worker.updateDependency(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('majors', async () => {
      config.upgradeType = 'major';
      await worker.updateDependency(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('minors', async () => {
      config.upgradeType = 'minor';
      await worker.updateDependency(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('handles errors', async () => {
      config.api.checkForClosedPr = jest.fn(() => {
        throw new Error('oops');
      });
      await worker.updateDependency(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(0);
    });
  });
});
