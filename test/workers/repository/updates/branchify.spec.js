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
    it('enforces valid git branch name', async () => {
      const fixtures = [
        {
          upgrade: {
            groupName: '/My Group/',
            group: { branchName: 'renovate/{{groupSlug}}' },
          },
          expectedBranchName: 'renovate/my-group'
        },
        {
          upgrade: {
            groupName: 'invalid branch name.lock',
            group: { branchName: 'renovate/{{groupSlug}}' },
          },
          expectedBranchName: 'renovate/invalid-branch-name'
        },
        {
          upgrade: {
            groupName: '.a-bad-  name:@.lock',
            group: { branchName: 'renovate/{{groupSlug}}' },
          },
          expectedBranchName: 'renovate/a-bad-name-@'
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-name1..' },
          expectedBranchName: 'renovate/bad-branch-name1'
        },
        {
          upgrade: { branchName: 'renovate/~bad-branch-name2' },
          expectedBranchName: 'renovate/-bad-branch-name2'
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-^-name3' },
          expectedBranchName: 'renovate/bad-branch---name3'
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-name : 4' },
          expectedBranchName: 'renovate/bad-branch-name--4'
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-name5/' },
          expectedBranchName: 'renovate/bad-branch-name5'
        },
        {
          upgrade: { branchName: '.bad-branch-name6' },
          expectedBranchName: 'bad-branch-name6'
        },
        {
          upgrade: { branchName: 'renovate/.bad-branch-name7' },
          expectedBranchName: 'renovate/bad-branch-name7'
        },
        {
          upgrade: { branchName: 'renovate/.bad-branch-name8' },
          expectedBranchName: 'renovate/bad-branch-name8'
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-name9.' },
          expectedBranchName: 'renovate/bad-branch-name9'
        },
      ];
      config.upgrades = fixtures.map(({ upgrade }) => upgrade);

      (await branchifyUpgrades(config)).branches
        .forEach(({ branchName }, index) => {
          expect(branchName).toBe(fixtures[index].expectedBranchName)
        });
    });
  });
});
