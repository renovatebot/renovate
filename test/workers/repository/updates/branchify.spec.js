let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('../../../_fixtures/config') };
  config.errors = [];
  config.warnings = [];
});

const {
  branchifyUpgrades,
} = require('../../../../lib/workers/repository/updates/branchify');

describe('workers/repository/updates/branchify', () => {
  describe('branchifyUpgrades()', () => {
    it('returns empty', async () => {
      config.upgrades = [];
      const res = await branchifyUpgrades(config);
      expect(res.branches).toEqual([]);
    });
    it('returns one branch if one input', async () => {
      config.upgrades = [
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          version: '1.1.0',
          prTitle: 'some-title',
        },
      ];
      config.repoIsOnboarded = true;
      const res = await branchifyUpgrades(config);
      expect(Object.keys(res.branches).length).toBe(1);
    });
    it('does not group if different compiled branch names', async () => {
      config.upgrades = [
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          version: '1.1.0',
          prTitle: 'some-title',
        },
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          version: '2.0.0',
          prTitle: 'some-title',
        },
        {
          depName: 'bar',
          branchName: 'bar-{{version}}',
          version: '1.1.0',
          prTitle: 'some-title',
        },
      ];
      const res = await branchifyUpgrades(config);
      expect(Object.keys(res.branches).length).toBe(3);
    });
    it('groups if same compiled branch names', async () => {
      config.upgrades = [
        {
          depName: 'foo',
          branchName: 'foo',
          version: '1.1.0',
          prTitle: 'some-title',
        },
        {
          depName: 'foo',
          branchName: 'foo',
          version: '2.0.0',
          prTitle: 'some-title',
        },
        {
          depName: 'bar',
          branchName: 'bar-{{version}}',
          version: '1.1.0',
          prTitle: 'some-title',
        },
      ];
      const res = await branchifyUpgrades(config);
      expect(Object.keys(res.branches).length).toBe(2);
    });
    it('groups if same compiled group name', async () => {
      config.upgrades = [
        {
          depName: 'foo',
          branchName: 'foo',
          prTitle: 'some-title',
          version: '1.1.0',
          groupName: 'My Group',
          group: { branchName: 'renovate/{{groupSlug}}' },
        },
        {
          depName: 'foo',
          branchName: 'foo',
          prTitle: 'some-title',
          version: '2.0.0',
        },
        {
          depName: 'bar',
          branchName: 'bar-{{version}}',
          prTitle: 'some-title',
          version: '1.1.0',
          groupName: 'My Group',
          group: { branchName: 'renovate/my-group' },
        },
      ];
      const res = await branchifyUpgrades(config);
      expect(Object.keys(res.branches).length).toBe(2);
    });
    it('mixes errors and warnings', async () => {
      config.upgrades = [
        {
          type: 'error',
        },
        {
          branchName: 'foo-{{version}}',
          prTitle: 'some-title',
          version: '1.1.0',
        },
        {
          type: 'warning',
          branchName: 'foo-{{version}}',
          prTitle: 'some-title',
          version: '2.0.0',
        },
        {
          branchName: 'bar-{{version}}',
          prTitle: 'some-title',
          version: '1.1.0',
        },
      ];
      const res = await branchifyUpgrades(config);
      expect(Object.keys(res.branches).length).toBe(2);
      expect(res.errors).toHaveLength(1);
      expect(res.warnings).toHaveLength(1);
    });
  });
});
