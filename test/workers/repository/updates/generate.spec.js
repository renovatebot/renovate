beforeEach(() => {
  jest.resetAllMocks();
});

const {
  generateBranchConfig,
} = require('../../../../lib/workers/repository/updates/generate');

describe('workers/repository/updates/generate', () => {
  describe('generateBranchConfig()', () => {
    it('does not group single upgrade', () => {
      const branch = [
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
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
      expect(res).toMatchSnapshot();
    });
    it('groups single upgrade if not lazyGrouping', () => {
      const branch = [
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
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.groupName).toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('does not group same upgrades', () => {
      const branch = [
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
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
    });
    it('groups multiple upgrades', () => {
      const branch = [
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
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.groupName).toBeDefined();
      expect(res).toMatchSnapshot();
    });
  });
});
