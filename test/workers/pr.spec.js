const logger = require('winston');
const prWorker = require('../../lib/workers/pr');
const defaultConfig = require('../../lib/config/defaults').getConfig();

logger.remove(logger.transports.Console);

const getChangeLog = jest.fn();
getChangeLog.mockReturnValue('Mocked changelog');

describe('workers/pr', () => {
  describe('ensurePr(config)', () => {
    let config;
    let existingPr;
    beforeEach(() => {
      config = Object.assign({}, defaultConfig);
      config.api = {
        createPr: jest.fn(() => ({ displayNumber: 'New Pull Request' })),
      };
      existingPr = {
        title: 'Update dependency dummy to version 1.1.0',
        body: 'This Pull Request updates dependency dummy from version `1.0.0` to `1.1.0`\n\n',
        displayNumber: 'Existing PR',
      };
    });
    it('should return null if check fails', async () => {
      config.api.getBranchPr = jest.fn(() => {
        throw new Error('oops');
      });
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBe(null);
    });
    it('should return null if waiting for success', async () => {
      config.api.getBranchStatus = jest.fn(() => 'failed');
      config.prCreation = 'status-success';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBe(null);
    });
    it('should create PR if success', async () => {
      config.api.getBranchStatus = jest.fn(() => 'success');
      config.api.getBranchPr = jest.fn();
      config.prCreation = 'status-success';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should return null if waiting for not pending', async () => {
      config.api.getBranchStatus = jest.fn(() => 'pending');
      config.prCreation = 'not-pending';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBe(null);
    });
    it('should create PR if no longer pending', async () => {
      config.api.getBranchStatus = jest.fn(() => 'failed');
      config.api.getBranchPr = jest.fn();
      config.prCreation = 'not-pending';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create new branch if none exists', async () => {
      config.api.getBranchPr = jest.fn();
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should add labels to new PR', async () => {
      config.api.getBranchPr = jest.fn();
      config.api.addLabels = jest.fn();
      config.labels = ['foo'];
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(config.api.addLabels.mock.calls.length).toBe(1);
    });
    it('should add not labels to new PR if empty', async () => {
      config.api.getBranchPr = jest.fn();
      config.api.addLabels = jest.fn();
      config.labels = [];
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(config.api.addLabels.mock.calls.length).toBe(0);
    });
    it('should add assignees and reviewers to new PR', async () => {
      config.api.getBranchPr = jest.fn();
      config.api.addAssignees = jest.fn();
      config.api.addReviewers = jest.fn();
      config.assignees = ['bar'];
      config.reviewers = ['baz'];
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(config.api.addAssignees.mock.calls.length).toBe(1);
      expect(config.api.addReviewers.mock.calls.length).toBe(1);
    });
    it('should return unmodified existing PR', async () => {
      config.depName = 'dummy';
      config.currentVersion = '1.0.0';
      config.newVersion = '1.1.0';
      config.api.getBranchPr = jest.fn(() => existingPr);
      config.api.updatePr = jest.fn();
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject(existingPr);
    });
    it('should return modified existing PR', async () => {
      config.depName = 'dummy';
      config.currentVersion = '1.0.0';
      config.newVersion = '1.2.0';
      config.api.getBranchPr = jest.fn(() => existingPr);
      config.api.updatePr = jest.fn();
      const pr = await prWorker.ensurePr(config);
      const updatedPr = Object.assign(existingPr, {
        body: 'This Pull Request updates dependency dummy from version `1.0.0` to `1.2.0`\n\n',
      });
      expect(pr).toMatchObject(updatedPr);
    });
  });
});
