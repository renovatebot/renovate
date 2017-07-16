const prWorker = require('../../../lib/workers/pr');
const changelogHelper = require('../../../lib/workers/pr/changelog');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/pr/changelog');
changelogHelper.getChangeLog = jest.fn();
changelogHelper.getChangeLog.mockReturnValue('Mocked changelog');
changelogHelper.getChangeLogJSON = jest.fn();
changelogHelper.getChangeLogJSON.mockReturnValue({
  project: {
    github: 'renovateapp/dummy',
    repository: 'https://github.com/renovateapp/dummy',
  },
  versions: [
    {
      date: new Date('2017-01-01'),
      version: '1.1.0',
      changes: [
        {
          date: new Date('2017-01-01'),
          sha: 'abcdefghijklmnopqrstuvwxyz',
          message: 'foo #3\nbar',
        },
      ],
    },
  ],
});

describe('workers/pr', () => {
  describe('checkAutoMerge(pr, config, logger)', () => {
    let config;
    let pr;
    beforeEach(() => {
      config = Object.assign({}, defaultConfig);
      pr = {
        head: {
          ref: 'somebranch',
        },
      };
      config.api = {
        mergePr: jest.fn(),
        getBranchStatus: jest.fn(),
      };
    });
    it('should not automerge if not configured', async () => {
      await prWorker.checkAutoMerge(pr, config, logger);
      expect(config.api.mergePr.mock.calls.length).toBe(0);
    });
    it('should automerge if enabled and pr is mergeable', async () => {
      config.automergeEnabled = true;
      pr.mergeable = true;
      config.api.getBranchStatus.mockReturnValueOnce('success');
      await prWorker.checkAutoMerge(pr, config, logger);
      expect(config.api.mergePr.mock.calls.length).toBe(1);
    });
    it('should not automerge if enabled and pr is mergeable but branch status is not success', async () => {
      config.automergeEnabled = true;
      pr.mergeable = true;
      config.api.getBranchStatus.mockReturnValueOnce('pending');
      await prWorker.checkAutoMerge(pr, config, logger);
      expect(config.api.mergePr.mock.calls.length).toBe(0);
    });
    it('should not automerge if enabled and pr is mergeable but unstable', async () => {
      config.automergeEnabled = true;
      pr.mergeable = true;
      pr.mergeable_state = 'unstable';
      await prWorker.checkAutoMerge(pr, config, logger);
      expect(config.api.mergePr.mock.calls.length).toBe(0);
    });
    it('should not automerge if enabled and pr is unmergeable', async () => {
      config.automergeEnabled = true;
      pr.mergeable = false;
      await prWorker.checkAutoMerge(pr, config, logger);
      expect(config.api.mergePr.mock.calls.length).toBe(0);
    });
  });
  describe('ensurePr(upgrades, logger)', () => {
    let config;
    let existingPr;
    beforeEach(() => {
      config = Object.assign({}, defaultConfig);
      config.api = {
        createPr: jest.fn(() => ({ displayNumber: 'New Pull Request' })),
        getBranchStatus: jest.fn(),
      };
      config.upgrades = [config];
      existingPr = {
        title: 'Update dependency dummy to version 1.1.0',
        body: `<p>This Pull Request updates dependency <a href="https://github.com/renovateapp/dummy">dummy</a> from version <code>1.0.0</code> to <code>1.1.0</code></p>
<h3 id="commits">Commits</h3>
<p><details><br />
<summary>renovateapp/dummy</summary></p>
<h4 id="110">1.1.0</h4>
<ul>
<li><a href="https://github.com/renovateapp/dummy/commit/abcdefghijklmnopqrstuvwxyz"><code>abcdefg</code></a> foo <a href="https://github.com/renovateapp/dummy/issues/3">#3</a></li>
</ul>
<p></details></p>
<hr />
<p>This PR has been generated by <a href="https://keylocation.sg/our-tech/renovate">Renovate Bot</a>.</p>`,
        displayNumber: 'Existing PR',
      };
    });
    it('should return null if check fails', async () => {
      config.api.getBranchPr = jest.fn(() => {
        throw new Error('oops');
      });
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toBe(null);
    });
    it('should return null if waiting for success', async () => {
      config.api.getBranchStatus = jest.fn(() => 'failed');
      config.prCreation = 'status-success';
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toBe(null);
    });
    it('should create PR if success', async () => {
      config.api.getBranchStatus = jest.fn(() => 'success');
      config.api.getBranchPr = jest.fn();
      config.prCreation = 'status-success';
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should return null if waiting for not pending', async () => {
      config.api.getBranchStatus = jest.fn(() => 'pending');
      config.prCreation = 'not-pending';
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toBe(null);
    });
    it('should create PR if no longer pending', async () => {
      config.api.getBranchStatus = jest.fn(() => 'failed');
      config.api.getBranchPr = jest.fn();
      config.prCreation = 'not-pending';
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create new branch if none exists', async () => {
      config.api.getBranchPr = jest.fn();
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(
        config.api.createPr.mock.calls[0][2].indexOf('Errors</h3>')
      ).toEqual(-1);
      expect(
        config.api.createPr.mock.calls[0][2].indexOf('Warnings</h3>')
      ).toEqual(-1);
    });
    it('should add labels to new PR', async () => {
      config.api.getBranchPr = jest.fn();
      config.api.addLabels = jest.fn();
      config.labels = ['foo'];
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(config.api.addLabels.mock.calls.length).toBe(1);
    });
    it('should add not labels to new PR if empty', async () => {
      config.api.getBranchPr = jest.fn();
      config.api.addLabels = jest.fn();
      config.labels = [];
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(config.api.addLabels.mock.calls.length).toBe(0);
    });
    it('should add assignees and reviewers to new PR', async () => {
      config.api.getBranchPr = jest.fn();
      config.api.addAssignees = jest.fn();
      config.api.addReviewers = jest.fn();
      config.assignees = ['bar'];
      config.reviewers = ['baz'];
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(config.api.addAssignees.mock.calls.length).toBe(1);
      expect(config.api.addReviewers.mock.calls.length).toBe(1);
    });
    it('should display errors and warnings', async () => {
      config.api.getBranchPr = jest.fn();
      const pr = await prWorker.ensurePr(config, logger, [{}], [{}]);
      expect(
        config.api.createPr.mock.calls[0][2].indexOf('Errors</h3>')
      ).not.toEqual(-1);
      expect(
        config.api.createPr.mock.calls[0][2].indexOf('Warnings</h3>')
      ).not.toEqual(-1);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should not add assignees and reviewers to new PR if automerging enabled', async () => {
      config.api.getBranchPr = jest.fn();
      config.api.addAssignees = jest.fn();
      config.api.addReviewers = jest.fn();
      config.assignees = ['bar'];
      config.reviewers = ['baz'];
      config.automergeEnabled = true;
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(config.api.addAssignees.mock.calls.length).toBe(0);
      expect(config.api.addReviewers.mock.calls.length).toBe(0);
    });
    it('should return unmodified existing PR', async () => {
      config.depName = 'dummy';
      config.isGitHub = true;
      config.privateRepo = true;
      config.currentVersion = '1.0.0';
      config.newVersion = '1.1.0';
      config.repositoryUrl = 'https://github.com/renovateapp/dummy';
      config.api.getBranchPr = jest.fn(() => existingPr);
      config.api.updatePr = jest.fn();
      config.semanticPrefix = '';
      const pr = await prWorker.ensurePr(config, logger);
      expect(config.api.updatePr.mock.calls).toMatchSnapshot();
      expect(config.api.updatePr.mock.calls.length).toBe(0);
      expect(pr).toMatchObject(existingPr);
    });
    it('should return modified existing PR', async () => {
      config.depName = 'dummy';
      config.currentVersion = '1.0.0';
      config.newVersion = '1.2.0';
      config.isGitHub = true;
      config.api.getBranchPr = jest.fn(() => existingPr);
      config.api.updatePr = jest.fn();
      const pr = await prWorker.ensurePr(config, logger);
      const updatedPr = Object.assign(existingPr, {
        body:
          'This Pull Request updates dependency dummy from version `1.0.0` to `1.2.0`\n\nNo changelog available',
      });
      expect(pr).toMatchObject(updatedPr);
    });
    it('should create PR if branch automerging failed', async () => {
      config.automergeEnabled = true;
      config.automergeType = 'branch-push';
      config.api.getBranchStatus.mockReturnValueOnce('failure');
      config.api.getBranchPr = jest.fn();
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should return null if branch automerging not failed', async () => {
      config.automergeEnabled = true;
      config.automergeType = 'branch-push';
      config.api.getBranchStatus.mockReturnValueOnce('pending');
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toBe(null);
    });
    it('handles duplicate upgrades', async () => {
      config.api.getBranchPr = jest.fn();
      config.upgrades.push(config.upgrades[0]);
      const pr = await prWorker.ensurePr(config, logger);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
  });
});
