import { defaultConfig, getName, partial } from '../../../../test/util';
import type { UpdateType } from '../../../config/types';
import * as datasourceNpm from '../../../datasource/npm';
import type { BranchUpgradeConfig } from '../../types';
import { generateBranchConfig } from './generate';

beforeEach(() => {
  jest.resetAllMocks();
});

describe(getName(__filename), () => {
  describe('generateBranchConfig()', () => {
    it('does not group single upgrade', () => {
      const branch = [
        {
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
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
    it('handles lockFileMaintenance', () => {
      const branch = [
        {
          branchName: 'some-branch',
          prTitle: 'some-title',
          isLockFileMaintenance: true,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res).toMatchSnapshot();
    });
    it('handles lockFileUpdate', () => {
      const branch = [
        {
          branchName: 'some-branch',
          prTitle: 'some-title',
          isLockfileUpdate: true,
          currentValue: '^1.0.0',
          currentVersion: '1.0.0',
          lockedVersion: '1.0.0',
          newValue: '^1.0.0',
          newVersion: '1.0.1',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res).toMatchSnapshot();
    });
    it('does not group same upgrades', () => {
      const branch = [
        {
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
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
          foo: 1,
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
          automerge: true,
          constraints: {
            foo: '1.0.0',
          },
        },
        {
          depName: 'some-other-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-06T20:01:41+00:00',
          automerge: false,
          constraints: {
            foo: '1.0.0',
            bar: '2.0.0',
          },
        },
        {
          depName: 'another-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-06T20:01:41+00:00',
          automerge: false,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toEqual('2017-02-07T20:01:41+00:00');
      expect(res.automerge).toBe(false);
      expect(res.constraints).toEqual({
        foo: '1.0.0',
        bar: '2.0.0',
      });
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
          foo: 1,
          newValue: '5.1.2',
          newVersion: '5.1.2',
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
          foo: 1,
          newValue: '1.1.0',
          newVersion: '1.1.0',
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
          isDigest: true,
          currentDigest: 'abcdefghijklmnopqrstuvwxyz',
          newDigest: '123abcdefghijklmnopqrstuvwxyz',
          foo: 1,
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
          foo: 1,
          newValue: '>= 5.1.2',
          newVersion: '5.1.2',
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
          foo: 1,
          newValue: '^5,1,2',
          newVersion: '5.1.2',
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
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          depName: 'some-dep',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: 'package',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          foo: 1,
          group: {
            foo: 2,
          },
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toEqual(
        'chore(package): update dependency some-dep to v1.2.0'
      );
    });
    it('scopes monorepo commits', () => {
      const branch = [
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          depName: 'some-dep',
          packageFile: 'package.json',
          baseDir: '',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: '{{baseDir}}',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          foo: 1,
          group: {
            foo: 2,
          },
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toEqual(
        'chore(): update dependency some-dep to v1.2.0'
      );
    });
    it('scopes monorepo commits with nested package files using parent directory', () => {
      const branch = [
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          commitBodyTable: false,
          depName: 'some-dep',
          packageFile: 'foo/bar/package.json',
          parentDir: 'bar',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: '{{parentDir}}',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          foo: 1,
          group: {
            foo: 2,
          },
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toEqual(
        'chore(bar): update dependency some-dep to v1.2.0'
      );
    });
    it('scopes monorepo commits with nested package files using base directory', () => {
      const branch = [
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          depName: 'some-dep',
          packageFile: 'foo/bar/package.json',
          packageFileDir: 'foo/bar',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: '{{packageFileDir}}',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          foo: 1,
          group: {
            foo: 2,
          },
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toEqual(
        'chore(foo/bar): update dependency some-dep to v1.2.0'
      );
    });
    it('adds commit message body', () => {
      const branch = [
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          depName: 'some-dep',
          commitBody: '[skip-ci]',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.commitMessage).toMatchSnapshot();
      expect(res.commitMessage).toContain('\n');
    });
    it('supports manual prTitle', () => {
      const branch = [
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          depName: 'some-dep',
          prTitle: 'Upgrade {{depName}}',
          toLowerCase: true,
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toMatchSnapshot();
    });
    it('handles @types specially', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          commitBodyTable: true,
          datasource: datasourceNpm.id,
          depName: '@types/some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-title',
          currentValue: '0.5.7',
          currentVersion: '0.5.7',
          newValue: '0.5.8',
          newVersion: '0.5.8',
          group: {},
        },
        {
          commitBodyTable: true,
          datasource: datasourceNpm.id,
          depName: 'some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          group: {},
        },
        {
          commitBodyTable: true,
          datasource: datasourceNpm.id,
          depName: 'some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-other-title',
          newValue: '1.0.0',
          group: {},
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBe(false);
      expect(res.groupName).toBeUndefined();
      expect(generateBranchConfig(branch)).toMatchSnapshot();
    });
    it('handles @types specially (reversed)', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          depName: 'some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          labels: ['a', 'c'],
          group: {},
        },
        {
          commitBodyTable: true,
          datasource: datasourceNpm.id,
          depName: 'some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-other-title',
          newValue: '1.0.0',
          labels: ['a', 'b'],
          group: {},
        },
        {
          depName: '@types/some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.5.7',
          labels: ['a'],
          group: {},
        },
      ];
      expect(generateBranchConfig(branch)).toMatchSnapshot();
    });
    it('handles upgrades', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          hasBaseBranches: true,
          fileReplacePosition: 5,
        },
        {
          ...defaultConfig,
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          isGroup: true,
          separateMinorPatch: true,
          updateType: 'minor' as UpdateType,
          fileReplacePosition: 1,
        },
        {
          ...defaultConfig,
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          isGroup: true,
          separateMajorMinor: true,
          updateType: 'major' as UpdateType,
          fileReplacePosition: 2,
        },
        {
          ...defaultConfig,
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          isGroup: true,
          separateMajorMinor: true,
          updateType: 'patch' as UpdateType,
          fileReplacePosition: 0,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toMatchSnapshot();
    });
    it('sorts upgrades, without position first', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          depName: 'some-dep1',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: 1,
        },
        {
          depName: 'some-dep2',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: undefined,
        },
        {
          depName: 'some-dep3',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: 4,
        },
        {
          depName: 'some-dep4',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: undefined,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(
        res.upgrades.map((upgrade) => upgrade.fileReplacePosition)
      ).toStrictEqual([undefined, undefined, 4, 1]);
    });
  });
});
