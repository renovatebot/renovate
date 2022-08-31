import { getConfig } from '../../../../test/util';
import type { RenovateConfig, UpdateType } from '../../../config/types';
import { NpmDatasource } from '../../../modules/datasource/npm';
import type { BranchUpgradeConfig } from '../../types';
import { generateBranchConfig } from './generate';

let defaultConfig: RenovateConfig;

beforeEach(() => {
  jest.resetAllMocks();
  defaultConfig = getConfig();
});

describe('workers/repository/updates/generate', () => {
  describe('generateBranchConfig()', () => {
    it('does not group single upgrade', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
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
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          prTitle: 'some-title',
          isLockFileMaintenance: true,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res).toMatchSnapshot({
        branchName: 'some-branch',
        prTitle: 'some-title',
        isLockFileMaintenance: true,
        upgrades: [
          {
            branchName: 'some-branch',
            prTitle: 'some-title',
            isLockFileMaintenance: true,
          },
        ],
      });
    });

    it('handles lockFileUpdate', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
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
      expect(res).toMatchSnapshot({
        branchName: 'some-branch',
        prTitle: 'some-title',
        isLockfileUpdate: true,
        currentValue: '^1.0.0',
        currentVersion: '1.0.0',
        lockedVersion: '1.0.0',
        newValue: '^1.0.0',
        newVersion: '1.0.1',
        reuseLockFiles: true,
        prettyNewVersion: 'v1.0.1',
        upgrades: [
          {
            branchName: 'some-branch',
            prTitle: 'some-title',
            isLockfileUpdate: true,
            currentValue: '^1.0.0',
            currentVersion: '1.0.0',
            lockedVersion: '1.0.0',
            newValue: '^1.0.0',
            newVersion: '1.0.1',
            prettyNewVersion: 'v1.0.1',
          },
        ],
      });
    });

    it('does not group same upgrades', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
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
          manager: 'some-manager',
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
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
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
          manager: 'some-manager',
          depName: 'some-other-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
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
          manager: 'some-manager',
          depName: 'another-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
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
      expect(res.releaseTimestamp).toBe('2017-02-07T20:01:41+00:00');
      expect(res.automerge).toBeFalse();
      expect(res.constraints).toEqual({
        foo: '1.0.0',
        bar: '2.0.0',
      });
    });

    it('groups major updates with different versions but same newValue, no recreateClosed', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '5.1.2',
          newVersion: '5.1.2',
          isMajor: true,
          newMajor: 5,
        },
        {
          manager: 'some-manager',
          depName: 'some-other-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '5.2.0',
          newVersion: '5.2.0',
          isMajor: true,
          newMajor: 5,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeDefined();
      expect(res.recreateClosed).toBeFalsy();
    });

    it('groups multiple upgrades different version', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'depB',
          groupName: 'some-group',
          branchName: 'some-branch',
          commitMessage:
            '{{{groupName}}} {{{commitMessageExtra}}} {{{commitMessageSuffix}}}',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{prettyNewVersion}}{{/if}}',
          foo: 1,
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
          updateType: 'minor',
          separateMinorPatch: true,
        },
        {
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          commitMessage:
            '{{{groupName}}} {{{commitMessageExtra}}} {{{commitMessageSuffix}}}',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{prettyNewVersion}}{{/if}}',
          foo: 1,
          newValue: '1.1.0',
          newVersion: '1.1.0',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00',
          updateType: 'minor',
          separateMinorPatch: true,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res).toMatchObject({
        foo: 2,
        isGroup: true,
        recreateClosed: true,
        prTitle: 'some-group (minor)',
        commitMessage: 'some-group',
        groupName: 'some-group',
        releaseTimestamp: '2017-02-08T20:01:41+00:00',
      });
    });

    it('groups multiple upgrades different version but same value', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'depB',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '^6.0',
          newVersion: '6.0.3',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
        },
        {
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '^6.0',
          newVersion: '6.0.1',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.singleVersion).toBeUndefined();
      expect(res.recreateClosed).toBeUndefined();
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toBe('2017-02-08T20:01:41+00:00');
    });

    it('groups multiple upgrades different value but same version', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'depB',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '^6.0.1',
          newVersion: '6.0.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
        },
        {
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '^6.0.0',
          newVersion: '6.0.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.singleVersion).toBeUndefined();
      expect(res.recreateClosed).toBeUndefined();
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toBe('2017-02-08T20:01:41+00:00');
    });

    it('groups multiple digest updates', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'foo/bar',
          groupName: 'foo docker images',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          isDigest: true,
          currentDigest: 'abcdefghijklmnopqrstuvwxyz',
          newDigest: '123abcdefghijklmnopqrstuvwxyz',
          foo: 1,
          group: {
            foo: 2,
          },
        },
        {
          manager: 'some-manager',
          depName: 'foo/baz',
          groupName: 'foo docker images',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
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
      expect(res.recreateClosed).toBeTrue();
      expect(res.groupName).toBeDefined();
    });

    it('pins digest to table', () => {
      // TODO #7154 incompatible types
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          depName: 'foo-image',
          newDigest: 'abcdefg987612345',
          currentDigest: '',
          updateType: 'pinDigest',
          isPinDigest: true,
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.upgrades[0].displayFrom).toBe('');
      expect(res.upgrades[0].displayTo).toBe('abcdefg');
    });

    it('fixes different messages', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '>= 5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
        },
        {
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
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
      // TODO #7154 incompatible types
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          manager: 'some-manager',
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
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(package): update dependency some-dep to v1.2.0'
      );
      expect(res.commitMessage).toBe(
        'chore(package): update dependency some-dep to v1.2.0'
      );
    });

    it('scopes monorepo commits', () => {
      // TODO #7154 incompatible types
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          manager: 'some-manager',
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
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('chore(): update dependency some-dep to v1.2.0');
      expect(res.commitMessage).toBe(
        'chore(): update dependency some-dep to v1.2.0'
      );
    });

    it('scopes monorepo commits with nested package files using parent directory', () => {
      // TODO #7154 incompatible types
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          commitBodyTable: false,
          manager: 'some-manager',
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
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(bar): update dependency some-dep to v1.2.0'
      );
      expect(res.commitMessage).toBe(
        'chore(bar): update dependency some-dep to v1.2.0'
      );
    });

    it('scopes monorepo commits with nested package files using base directory', () => {
      // TODO #7154 incompatible types
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          manager: 'some-manager',
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
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0'
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0'
      );
    });

    it('use prettyVersion in pr title when there is a v', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          packageFile: 'foo/bar/package.json',
          packageFileDir: 'foo/bar',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: '{{packageFileDir}}',
          commitMessageExtra: '{{prettyNewVersion}}',
          newValue: 'v1.2.0',
          isSingleVersion: true,
          newVersion: 'v1.2.0',
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep v1.2.0'
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep v1.2.0'
      );
    });

    it('use prettyVersion in pr title there is no v', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          packageFile: 'foo/bar/package.json',
          packageFileDir: 'foo/bar',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: '{{packageFileDir}}',
          commitMessageExtra: '{{prettyNewVersion}}',
          newValue: '3.2.0',
          newVersion: '3.2.0',
          newMajor: 3,
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep v3.2.0'
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep v3.2.0'
      );
    });

    it('use newMajor in pr title with v', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          packageFile: 'foo/bar/package.json',
          packageFileDir: 'foo/bar',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: '{{packageFileDir}}',
          commitMessageExtra: '{{prettyNewMajor}}',
          newValue: '3.2.0',
          newVersion: '3.2.0',
          newMajor: 3,
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('chore(foo/bar): update dependency some-dep v3');
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep v3'
      );
    });

    it('Default commitMessageExtra pr title', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          packageFile: 'foo/bar/package.json',
          packageFileDir: 'foo/bar',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: '{{packageFileDir}}',
          newValue: 'v1.2.0',
          isSingleVersion: true,
          newVersion: 'v1.2.0',
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0'
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0'
      );
    });

    it('adds commit message body', () => {
      // TODO #7154 incompatible types
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          commitBody: '[skip-ci]',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('Update dependency some-dep to v1.2.0');
      expect(res.commitMessage).toBe('Update dependency some-dep to v1.2.0');
    });

    it('supports manual prTitle', () => {
      // TODO #7154 incompatible types
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          prTitle: 'Upgrade {{depName}}',
          toLowerCase: true,
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('upgrade some-dep');
      expect(res.commitMessage).toBe('update dependency some-dep to');
    });

    it('handles @types specially', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          commitBodyTable: true,
          datasource: NpmDatasource.id,
          depName: '@types/some-dep',
          groupName: null as never,
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
          datasource: NpmDatasource.id,
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: null as never,
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          group: {},
        },
        {
          commitBodyTable: true,
          datasource: NpmDatasource.id,
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: null as never,
          branchName: 'some-branch',
          prTitle: 'some-other-title',
          newValue: '1.0.0',
          group: {},
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeFalse();
      expect(res.groupName).toBeUndefined();
      expect(generateBranchConfig(branch)).toMatchSnapshot({
        upgrades: [
          {
            manager: 'some-manager',
            depName: 'some-dep',
            branchName: 'some-branch',
            newValue: '0.6.0',
          },
          {
            manager: 'some-manager',
            depName: 'some-dep',
            branchName: 'some-branch',
            newValue: '1.0.0',
          },
          {
            depName: '@types/some-dep',
            branchName: 'some-branch',
            newValue: '0.5.8',
          },
        ],
      });
    });

    it('handles @types specially (reversed)', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: null as never,
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          labels: ['a', 'c'],
          group: {},
        },
        {
          commitBodyTable: true,
          datasource: NpmDatasource.id,
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: null as never,
          branchName: 'some-branch',
          prTitle: 'some-other-title',
          newValue: '1.0.0',
          labels: ['a', 'b'],
          group: {},
        },
        {
          manager: 'some-manager',
          depName: '@types/some-dep',
          groupName: null as never,
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.5.7',
          labels: ['a'],
          group: {},
        },
      ];
      expect(generateBranchConfig(branch)).toMatchSnapshot({
        upgrades: [
          {
            manager: 'some-manager',
            depName: 'some-dep',
            branchName: 'some-branch',
            newValue: '0.6.0',
            labels: ['a', 'c'],
          },
          {
            manager: 'some-manager',
            depName: 'some-dep',
            branchName: 'some-branch',
            newValue: '1.0.0',
            labels: ['a', 'b'],
          },
          {
            depName: '@types/some-dep',
            branchName: 'some-branch',
            newValue: '0.5.7',
            labels: ['a'],
          },
        ],
      });
    });

    it('handles upgrades', () => {
      // TODO #7154 incompatible types
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          hasBaseBranches: true,
          fileReplacePosition: 5,
        },
        {
          ...defaultConfig,
          manager: 'some-manager',
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
          manager: 'some-manager',
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
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          isGroup: true,
          separateMajorMinor: true,
          separateMinorPatch: true,
          updateType: 'patch' as UpdateType,
          fileReplacePosition: 0,
        },
      ] as BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toMatchSnapshot('some-title (patch)');
    });

    it('combines prBodyColumns', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          prBodyColumns: ['column-a', 'column-b'],
        },
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          prBodyColumns: ['column-c', 'column-b', 'column-a'],
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.prBodyColumns).toEqual(['column-a', 'column-b', 'column-c']);
    });

    it('sorts upgrades, without position first', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep1',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: 1,
        },
        {
          manager: 'some-manager',
          depName: 'some-dep2',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: undefined,
        },
        {
          manager: 'some-manager',
          depName: 'some-dep3',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: 4,
        },
        {
          manager: 'some-manager',
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

    it('passes through pendingChecks', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          pendingChecks: true,
        },
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          pendingChecks: true,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.pendingChecks).toBeTrue();
      expect(res.upgrades).toHaveLength(2);
    });

    it('filters pendingChecks', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          pendingChecks: true,
        },
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.pendingChecks).toBeUndefined();
      expect(res.upgrades).toHaveLength(1);
    });

    it('displays pending versions', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'No pending version',
        },
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'One pending version',
          pendingVersions: ['1.1.0'],
        },
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'Two pending versions',
          pendingVersions: ['1.1.0', '1.1.1'],
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.upgrades.map((u) => u.displayPending)).toStrictEqual([
        '',
        '`1.1.0`',
        '`1.1.1` (+1)',
      ]);
    });

    it('merge excludeCommitPaths if appears in upgrade', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep1',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
        },
        {
          manager: 'some-other-manager',
          depName: 'some-dep2',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.8.0',
          excludeCommitPaths: ['some/path', 'some/other/path'],
        },
        {
          manager: 'some-manager-3',
          depName: 'some-dep3',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.9.0',
          excludeCommitPaths: ['some/path', 'some/other-manager/path'],
        },
      ];
      const res = generateBranchConfig(branch);
      const excludeCommitPaths = res.excludeCommitPaths ?? [];
      expect(excludeCommitPaths.sort()).toStrictEqual(
        ['some/path', 'some/other/path', 'some/other-manager/path'].sort()
      );
    });

    it('prevents issue with duplicating "v" character', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          commitMessage: 'update to vv1.2.0',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('update to v1.2.0');
      expect(res.commitMessage).toBe('update to v1.2.0');
    });

    it('apply semanticCommits and commitMessagePrefix together', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          ...defaultConfig,
          branchName: 'some-branch',
          commitMessagePrefix: 'PATCH:',
          depName: 'some-dep',
          manager: 'some-manager',
          newValue: '1.2.0',
          semanticCommits: 'enabled',
          semanticCommitScope: null,
        } as BranchUpgradeConfig,
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('PATCH: Update dependency some-dep to 1.2.0');
      expect(res.commitMessage).toBe(
        'PATCH: Update dependency some-dep to 1.2.0'
      );
    });
  });
});
