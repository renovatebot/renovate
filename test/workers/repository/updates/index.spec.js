jest.mock('../../../../lib/workers/repository/updates/determine');
jest.mock('../../../../lib/workers/repository/updates/branchify');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../_fixtures/config');
});

const {
  determineUpdates,
} = require('../../../../lib/workers/repository/updates');

describe('workers/repository/updates', () => {
  describe('determineUpdates()', () => {
    it('runs', async () => {
      await determineUpdates(config, 'some-token');
    });
  });
});

/*
  describe('generateConfig(branchUpgrades)', () => {
    it('does not group single upgrade', () => {
      const branchUpgrades = [
        {
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          semanticCommits: true,
          semanticPrefix: 'some-prefix:',
          lazyGrouping: true,
          foo: 1,
          group: {
            foo: 2,
          },
        },
      ];
      const res = upgrades.generateConfig(branchUpgrades);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
      expect(res).toMatchSnapshot();
    });
    it('groups single upgrade if not lazyGrouping', () => {
      const branchUpgrades = [
        {
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          lazyGrouping: false,
          foo: 1,
          group: {
            foo: 2,
          },
        },
      ];
      const res = upgrades.generateConfig(branchUpgrades);
      expect(res.foo).toBe(2);
      expect(res.groupName).toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('does not group same upgrades', () => {
      const branchUpgrades = [
        {
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          lazyGrouping: true,
          foo: 1,
          group: {
            foo: 2,
          },
        },
        {
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          lazyGrouping: true,
          foo: 1,
          group: {
            foo: 2,
          },
        },
      ];
      const res = upgrades.generateConfig(branchUpgrades);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
    });
    it('groups multiple upgrades', () => {
      const branchUpgrades = [
        {
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          lazyGrouping: true,
          foo: 1,
          group: {
            foo: 2,
          },
        },
        {
          depName: 'some-other-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          lazyGrouping: true,
          foo: 1,
          group: {
            foo: 2,
          },
        },
      ];
      const res = upgrades.generateConfig(branchUpgrades);
      expect(res.foo).toBe(2);
      expect(res.groupName).toBeDefined();
      expect(res).toMatchSnapshot();
    });
  });
  describe('groupByBranch(upgrades)', () => {
    it('returns empty object if no input array', async () => {
      const res = await upgrades.groupByBranch([]);
      expect(res).toMatchSnapshot();
    });
    it('returns one branch if one input', async () => {
      const input = [
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          version: '1.1.0',
          prTitle: 'some-title',
        },
      ];
      const res = await upgrades.groupByBranch(input);
      expect(Object.keys(res.branchUpgrades).length).toBe(1);
      expect(res).toMatchSnapshot();
    });
    it('does not group if different compiled branch names', async () => {
      const input = [
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
      const res = await upgrades.groupByBranch(input);
      expect(Object.keys(res.branchUpgrades).length).toBe(3);
      expect(res).toMatchSnapshot();
    });
    it('groups if same compiled branch names', async () => {
      const input = [
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
      const res = await upgrades.groupByBranch(input);
      expect(Object.keys(res.branchUpgrades).length).toBe(2);
      expect(res).toMatchSnapshot();
    });
    it('groups if same compiled group name', async () => {
      const input = [
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
      const res = await upgrades.groupByBranch(input);
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
      const res = await upgrades.groupByBranch(input);
      expect(Object.keys(res.branchUpgrades).length).toBe(2);
      expect(res.errors).toHaveLength(1);
      expect(res.warnings).toHaveLength(1);
      expect(res).toMatchSnapshot();
    });
  });
  describe('branchifyUpgrades(upgrades, parentLogger)', () => {
    it('returns empty', async () => {
      upgrades.groupByBranch = jest.fn(() => ({
        branchUpgrades: {},
        errors: [],
        warnings: [],
      }));
      const res = await upgrades.branchifyUpgrades({});
      expect(res.upgrades).toEqual([]);
    });
    it('processes multiple branches', async () => {
      upgrades.groupByBranch = jest.fn(() => ({
        branchUpgrades: {
          a: [],
          b: [],
        },
        errors: [],
        warnings: [],
      }));
      upgrades.generateConfig = jest.fn(() => ({}));
      const res = await upgrades.branchifyUpgrades({});
      expect(res.upgrades).toHaveLength(2);
    });
  });
});
*/
