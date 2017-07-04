const upgrades = require('../../../lib/workers/repository/upgrades');
const packageFileWorker = require('../../../lib/workers/package-file');
const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/package-file');

describe('workers/repository/upgrades', () => {
  describe('determineRepoUpgrades(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        logger,
      };
    });
    it('returns empty array if no packageFiles', async () => {
      config.packageFiles = [];
      const res = await upgrades.determineRepoUpgrades(config);
      expect(res.length).toBe(0);
    });
    it('returns empty array if none found', async () => {
      config.packageFiles = [
        'package.json',
        {
          packageFile: 'backend/package.json',
        },
      ];
      packageFileWorker.findUpgrades.mockReturnValue([]);
      const res = await upgrades.determineRepoUpgrades(config);
      expect(res.length).toBe(0);
    });
    it('returns array if upgrades found', async () => {
      config.packageFiles = [
        'package.json',
        {
          packageFile: 'backend/package.json',
        },
        {
          packageFile: 'frontend/package.json',
        },
      ];
      packageFileWorker.findUpgrades.mockReturnValueOnce(['a']);
      packageFileWorker.findUpgrades.mockReturnValueOnce(['b', 'c']);
      const res = await upgrades.determineRepoUpgrades(config);
      expect(res.length).toBe(3);
    });
  });
  describe('branchifyUpgrades(upgrades, logger)', () => {
    it('returns empty object if no input array', async () => {
      const res = await upgrades.branchifyUpgrades([], logger);
      expect(res).toMatchSnapshot();
    });
    it('returns one branch if one input', async () => {
      const input = [
        {
          branchName: 'foo-{{version}}',
          version: '1.1.0',
        },
      ];
      const res = await upgrades.branchifyUpgrades(input, logger);
      expect(Object.keys(res.branchUpgrades).length).toBe(1);
      expect(res).toMatchSnapshot();
    });
    it('does not group if different compiled branch names', async () => {
      const input = [
        {
          branchName: 'foo-{{version}}',
          version: '1.1.0',
        },
        {
          branchName: 'foo-{{version}}',
          version: '2.0.0',
        },
        {
          branchName: 'bar-{{version}}',
          version: '1.1.0',
        },
      ];
      const res = await upgrades.branchifyUpgrades(input, logger);
      expect(Object.keys(res.branchUpgrades).length).toBe(3);
      expect(res).toMatchSnapshot();
    });
    it('groups if same compiled branch names', async () => {
      const input = [
        {
          branchName: 'foo',
          version: '1.1.0',
        },
        {
          branchName: 'foo',
          version: '2.0.0',
        },
        {
          branchName: 'bar-{{version}}',
          version: '1.1.0',
        },
      ];
      const res = await upgrades.branchifyUpgrades(input, logger);
      expect(Object.keys(res.branchUpgrades).length).toBe(2);
      expect(res).toMatchSnapshot();
    });
    it('groups if same compiled group name', async () => {
      const input = [
        {
          branchName: 'foo',
          version: '1.1.0',
          groupName: 'My Group',
          group: { branchName: 'renovate/{{groupSlug}}' },
        },
        {
          branchName: 'foo',
          version: '2.0.0',
        },
        {
          branchName: 'bar-{{version}}',
          version: '1.1.0',
          groupName: 'My Group',
          group: { branchName: 'renovate/my-group' },
        },
      ];
      const res = await upgrades.branchifyUpgrades(input, logger);
      expect(Object.keys(res.branchUpgrades).length).toBe(2);
      expect(res).toMatchSnapshot();
    });
    it('mixes errors and warnings', async () => {
      const input = [
        {
          type: 'error',
        },
        {
          branchName: 'foo-{{version}}',
          version: '1.1.0',
        },
        {
          type: 'warning',
          branchName: 'foo-{{version}}',
          version: '2.0.0',
        },
        {
          branchName: 'bar-{{version}}',
          version: '1.1.0',
        },
      ];
      const res = await upgrades.branchifyUpgrades(input, logger);
      expect(Object.keys(res.branchUpgrades).length).toBe(2);
      expect(res.errors).toHaveLength(1);
      expect(res.warnings).toHaveLength(1);
      expect(res).toMatchSnapshot();
    });
  });
});
