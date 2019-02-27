const defaultConfig = require('../../../../lib/config/defaults').getConfig();

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
          lazyGrouping: true,
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
          foo: 1,
          group: {
            foo: 2,
          },
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
      expect(res.releaseTimestamp).toBeDefined();
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
    it('groups multiple upgrades same version', () => {
      const branch = [
        {
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          lazyGrouping: true,
          foo: 1,
          newValue: '5.1.2',
          toVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
          canBeUnpublished: false,
          automerge: true,
        },
        {
          depName: 'some-other-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          lazyGrouping: true,
          foo: 1,
          newValue: '5.1.2',
          toVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-06T20:01:41+00:00',
          canBeUnpublished: true,
          automerge: false,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toEqual('2017-02-07T20:01:41+00:00');
      expect(res.canBeUnpublished).toBe(true);
      expect(res.automerge).toBe(false);
    });
    it('groups multiple upgrades different version', () => {
      const branch = [
        {
          depName: 'depB',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          lazyGrouping: true,
          foo: 1,
          newValue: '5.1.2',
          toVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
        },
        {
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          lazyGrouping: true,
          foo: 1,
          newValue: '1.1.0',
          toVersion: '1.1.0',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.singleVersion).toBeUndefined();
      expect(res.recreateClosed).toBe(true);
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toEqual('2017-02-08T20:01:41+00:00');
    });
    it('groups multiple digest updates', () => {
      const branch = [
        {
          depName: 'foo/bar',
          groupName: 'foo docker images',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          lazyGrouping: true,
          isDigest: true,
          foo: 1,
          newValue: 'abcdef',
          group: {
            foo: 2,
          },
        },
        {
          depName: 'foo/baz',
          groupName: 'foo docker images',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          lazyGrouping: true,
          foo: 1,
          newValue: 'zzzzzzzzzz',
          group: {
            foo: 2,
          },
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.singleVersion).toBeUndefined();
      expect(res.recreateClosed).toBe(true);
      expect(res.groupName).toBeDefined();
    });
    it('fixes different messages', () => {
      const branch = [
        {
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          lazyGrouping: true,
          foo: 1,
          newValue: '>= 5.1.2',
          toVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
        },
        {
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          lazyGrouping: true,
          foo: 1,
          newValue: '^5,1,2',
          toVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
    });
    it('uses semantic commits', () => {
      const branch = [
        {
          ...defaultConfig,
          depName: 'some-dep',
          semanticCommits: true,
          semanticCommitType: 'chore',
          semanticCommitScope: 'package',
          lazyGrouping: true,
          newValue: '1.2.0',
          isSingleVersion: true,
          toVersion: '1.2.0',
          foo: 1,
          group: {
            foo: 2,
          },
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toEqual(
        'chore(package): update dependency some-dep to v1.2.0'
      );
    });
    it('adds commit message body', () => {
      const branch = [
        {
          ...defaultConfig,
          depName: 'some-dep',
          commitBody: '[skip-ci]',
          newValue: '1.2.0',
          isSingleVersion: true,
          toVersion: '1.2.0',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.commitMessage).toMatchSnapshot();
      expect(res.commitMessage.includes('\n')).toBe(true);
    });
    it('supports manual prTitle', () => {
      const branch = [
        {
          ...defaultConfig,
          depName: 'some-dep',
          prTitle: 'Upgrade {{depName}}',
          toLowerCase: true,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toMatchSnapshot();
    });
    it('handles @types specially', () => {
      const branch = [
        {
          depName: '@types/some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-title',
          lazyGrouping: true,
          newValue: '0.5.7',
          group: {},
        },
        {
          depName: 'some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-title',
          lazyGrouping: true,
          newValue: '0.6.0',
          group: {},
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBe(false);
      expect(res.groupName).toBeUndefined();
    });
    it('overrides schedule for pin PRs', () => {
      const branch = [
        {
          ...defaultConfig,
          depName: 'some-dep',
          schedule: 'before 3am',
          updateType: 'pin',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.schedule).toEqual([]);
    });
  });
});
