import { codeBlock } from 'common-tags';
import { getConfig } from '../../../config/defaults';
import type { UpdateType } from '../../../config/types';
import { NpmDatasource } from '../../../modules/datasource/npm';
import type { BranchUpgradeConfig } from '../../types';
import { generateBranchConfig } from './generate';

const {
  commitMessage,
  commitMessagePrefix,
  commitMessageAction,
  commitMessageTopic,
  commitMessageExtra,
} = getConfig();
let requiredDefaultOptions = {};

beforeEach(() => {
  requiredDefaultOptions = {
    commitMessage,
    commitMessagePrefix,
    commitMessageAction,
    commitMessageTopic,
    commitMessageExtra,
  };
});

describe('workers/repository/updates/generate', () => {
  describe('generateBranchConfig()', () => {
    it('does not group single upgrade', () => {
      const branch = [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          depName: 'some-dep',
          groupName: 'some-group',
          prTitle: 'some-title',
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
          foo: 1,
          group: {
            foo: 2,
          },
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
      expect(res.releaseTimestamp).toBeDefined();
      expect(res.recreateClosed).toBe(false);
    });

    it('handles lockFileMaintenance', () => {
      const branch = [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          prTitle: 'some-title',
          isLockFileMaintenance: true,
        },
      ] satisfies BranchUpgradeConfig[];
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
            recreateClosed: true,
          },
        ],
      });
    });

    it('handles lockFileUpdate', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
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
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
      expect(res.recreateClosed).toBe(false);
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
      expect(res.recreateClosed).toBe(false);
    });

    it('groups major updates with different versions but same newValue, no recreateWhen', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeDefined();
      expect(res.recreateClosed).toBeFalsy();
    });

    it('groups multiple digest updates immortally', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra: 'to {{{newDigestShort}}}',
          newValue: '5.1.2',
          newDigest: 'sha256:abcdef123',
          isDigest: true,
        },
        {
          manager: 'some-manager',
          depName: 'some-other-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra: 'to {{{newDigestShort}}}',
          newValue: '5.2.0',
          newDigest: 'sha256:abcdef987654321',
          isDigest: true,
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeDefined();
      expect(res.recreateClosed).toBeTrue();
    });

    it('recreates grouped pin & pinDigest', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
          isPinDigest: true,
          updateType: 'pinDigest',
          newValue: 'v2',
          newDigest: 'dc323e67f16fb5f7663d20ff7941f27f5809e9b6',
        },
        {
          ...requiredDefaultOptions,
          updateType: 'pin',
          isPin: true,
          newValue: "'2.2.0'",
          newVersion: '2.2.0',
          newMajor: 2,
        },
      ] as BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeTrue();
    });

    it('does not recreate grouped pin & pinDigest when closed if recreateWhen=never', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
          isPinDigest: true,
          updateType: 'pinDigest',
          newValue: 'v2',
          newDigest: 'dc323e67f16fb5f7663d20ff7941f27f5809e9b6',
          recreateWhen: 'never',
        },
        {
          ...requiredDefaultOptions,
          updateType: 'pin',
          isPin: true,
          newValue: "'2.2.0'",
          newVersion: '2.2.0',
          newMajor: 2,
          recreateWhen: 'never',
        },
      ] as BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeFalse();
    });

    it('recreates grouped pin', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
          updateType: 'pin',
          isPin: true,
          newValue: "'2.2.0'",
          newVersion: '2.2.0',
          newMajor: 2,
          manager: 'some-manager',
          branchName: 'some-branch',
        },
        {
          ...requiredDefaultOptions,
          updateType: 'pin',
          isPin: true,
          newValue: "'3.2.0'",
          newVersion: '3.2.0',
          newMajor: 3,
          manager: 'some-manager',
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeTrue();
    });

    it('recreates grouped pinDigest', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
          isPinDigest: true,
          newDigest: 'abcd',
          newValue: 'v3',
          updateType: 'pinDigest',
          manager: 'some-manager',
          branchName: 'some-branch',
        },
        {
          ...requiredDefaultOptions,
          isPinDigest: true,
          newDigest: 'dcba',
          newMajor: 2,
          newValue: 'v2',
          updateType: 'pinDigest',
          manager: 'some-manager',
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeTrue();
    });

    it('skips appending baseBranch and updateType to prTitle when prTitleStrict is true', () => {
      const branch = [
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
          prTitleStrict: true,
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
          prTitleStrict: true,
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res).toMatchObject({
        foo: 2,
        isGroup: true,
        recreateClosed: true,
        prTitle: 'some-group',
        commitMessage: 'some-group',
        groupName: 'some-group',
        releaseTimestamp: '2017-02-08T20:01:41+00:00',
      });
    });

    it('groups multiple upgrades different version', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
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
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.singleVersion).toBeUndefined();
      expect(res.recreateClosed).toBeFalse();
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toBe('2017-02-08T20:01:41+00:00');
    });

    it('groups multiple upgrades different value but same version', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.singleVersion).toBeUndefined();
      expect(res.recreateClosed).toBeFalse();
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toBe('2017-02-08T20:01:41+00:00');
    });

    it('groups multiple digest updates', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.singleVersion).toBeUndefined();
      expect(res.recreateClosed).toBeTrue();
      expect(res.groupName).toBeDefined();
    });

    it('pins digest to table', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
          depName: 'foo-image',
          newDigest: 'abcdefg987612345',
          currentDigest: '',
          updateType: 'pinDigest',
          isPinDigest: true,
          manager: 'some-manager',
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.upgrades[0].displayFrom).toBe('');
      expect(res.upgrades[0].displayTo).toBe('abcdefg');
    });

    it('fixes different messages', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
    });

    it('uses semantic commits', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
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
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(package): update dependency some-dep to v1.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(package): update dependency some-dep to v1.2.0',
      );
    });

    it('scopes monorepo commits', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
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
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('chore(): update dependency some-dep to v1.2.0');
      expect(res.commitMessage).toBe(
        'chore(): update dependency some-dep to v1.2.0',
      );
    });

    it('scopes monorepo commits with nested package files using parent directory', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
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
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(bar): update dependency some-dep to v1.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(bar): update dependency some-dep to v1.2.0',
      );
    });

    it('scopes monorepo commits with nested package files using base directory', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
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
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0',
      );
    });

    it('use prettyVersion in pr title when there is a v', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
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
          manager: 'some-manager',
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep v1.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep v1.2.0',
      );
    });

    it('use prettyVersion in pr title there is no v', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
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
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep v3.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep v3.2.0',
      );
    });

    it('use newMajor in pr title with v', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
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
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('chore(foo/bar): update dependency some-dep v3');
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep v3',
      );
    });

    it('Default commitMessageExtra pr title', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
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
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0',
      );
    });

    it('adds commit message body', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
          manager: 'some-manager',
          depName: 'some-dep',
          commitBody: '[skip-ci]',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('Update dependency some-dep to v1.2.0');
      expect(res.commitMessage).toBe('Update dependency some-dep to v1.2.0');
    });

    it('supports manual prTitle', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
          manager: 'some-manager',
          depName: 'some-dep',
          prTitle: 'Upgrade {{depName}}',
          toLowerCase: true,
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('upgrade some-dep');
      expect(res.commitMessage).toBe('update dependency some-dep to');
    });

    it('handles @types specially', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
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
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
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
      const branch = [
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
          ...requiredDefaultOptions,
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
          ...requiredDefaultOptions,
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
          ...requiredDefaultOptions,
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toMatchSnapshot('some-title (patch)');
    });

    it('combines prBodyColumns', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prBodyColumns).toEqual(['column-a', 'column-b', 'column-c']);
    });

    it('sorts upgrades, without position first', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(
        res.upgrades.map((upgrade) => upgrade.fileReplacePosition),
      ).toStrictEqual([undefined, undefined, 4, 1]);
    });

    it('passes through pendingChecks', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.pendingChecks).toBeTrue();
      expect(res.upgrades).toHaveLength(2);
    });

    it('filters pendingChecks', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.pendingChecks).toBeUndefined();
      expect(res.upgrades).toHaveLength(1);
    });

    it('displays pending versions', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.upgrades.map((u) => u.displayPending)).toStrictEqual([
        '',
        '`1.1.0`',
        '`1.1.1` (+1)',
      ]);
    });

    it('merge excludeCommitPaths if appears in upgrade', () => {
      const branch = [
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
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      const excludeCommitPaths = res.excludeCommitPaths ?? [];
      expect(excludeCommitPaths.sort()).toStrictEqual(
        ['some/path', 'some/other/path', 'some/other-manager/path'].sort(),
      );
    });

    it('generates pretty version name properly', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
          depName: 'some-dep',
          isSingleVersion: true,
          manager: 'some-manager',
          newValue: 'foo-pkg-v3.2.1',
          newVersion: 'foo-pkg-v3.2.1',
          semanticCommits: 'enabled',
          semanticCommitScope: 'package',
          semanticCommitType: 'chore',
          branchName: 'some-branch',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(package): update dependency some-dep to foo-pkg-v3.2.1',
      );
      expect(res.commitMessage).toBe(
        'chore(package): update dependency some-dep to foo-pkg-v3.2.1',
      );
    });

    it('prevents issue with duplicating "v" character', () => {
      const branch = [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          commitMessage: 'update to vv1.2.0',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('update to v1.2.0');
      expect(res.commitMessage).toBe('update to v1.2.0');
    });

    it('apply semanticCommits and commitMessagePrefix together', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
          branchName: 'some-branch',
          commitMessagePrefix: 'PATCH:',
          depName: 'some-dep',
          manager: 'some-manager',
          newValue: '1.2.0',
          semanticCommits: 'enabled',
          semanticCommitScope: null,
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('PATCH: Update dependency some-dep to 1.2.0');
      expect(res.commitMessage).toBe(
        'PATCH: Update dependency some-dep to 1.2.0',
      );
    });

    it('dedupes duplicate table rows', () => {
      const branch = [
        {
          commitBodyTable: true,
          manager: 'some-manager',
          datasource: NpmDatasource.id,
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          currentVersion: '5.1.0',
          newVersion: '5.1.2',
        },
        {
          commitBodyTable: true,
          manager: 'some-manager',
          datasource: 'docker',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          currentVersion: '5.1.0',
          newVersion: '5.1.2',
        },
        {
          commitBodyTable: true,
          manager: 'some-manager',
          datasource: NpmDatasource.id,
          depName: 'another-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          currentVersion: '5.1.1',
          newVersion: '5.1.2',
        },
        {
          commitBodyTable: true,
          manager: 'some-manager',
          datasource: NpmDatasource.id,
          depName: 'another-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          currentVersion: '5.1.1',
          newVersion: '5.1.2',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.commitMessage?.trim()).toBe(codeBlock`
        | datasource | package     | from  | to    |
        | ---------- | ----------- | ----- | ----- |
        | npm        | another-dep | 5.1.1 | 5.1.2 |
        | npm        | some-dep    | 5.1.0 | 5.1.2 |
        | docker     | some-dep    | 5.1.0 | 5.1.2 |
      `);
      expect([
        ...(res.commitMessage?.matchAll(/another-dep/g) ?? []),
      ]).toBeArrayOfSize(1);
      expect([
        ...(res.commitMessage?.matchAll(/some-dep/g) ?? []),
      ]).toBeArrayOfSize(2);
    });

    it('using commitMessagePrefix without separator', () => {
      const branch = [
        {
          ...requiredDefaultOptions,
          branchName: 'some-branch',
          commitMessagePrefix: '🆙',
          depName: 'some-dep',
          manager: 'some-manager',
          newValue: '1.2.0',
          commitMessageAction: 'Update',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('🆙 Update dependency some-dep to 1.2.0');
      expect(res.commitMessage).toBe('🆙 Update dependency some-dep to 1.2.0');
    });

    it('merges additionalReviewers', () => {
      const upgrades = [
        {
          ...requiredDefaultOptions,
          branchName: 'some-branch',
          manager: 'some-manager',
          additionalReviewers: ['foo'],
        },
        {
          ...requiredDefaultOptions,
          branchName: 'some-branch',
          manager: 'some-manager',
        },
        {
          ...requiredDefaultOptions,
          branchName: 'some-branch',
          manager: 'some-manager',
          additionalReviewers: ['bar'],
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(upgrades);
      expect(res.additionalReviewers).toEqual(['foo', 'bar']);
    });

    it('merges depTypes', () => {
      const upgrades = [
        {
          ...requiredDefaultOptions,
          branchName: 'some-branch',
          manager: 'some-manager',
          depType: 'devDependencies',
        },
        {
          ...requiredDefaultOptions,
          branchName: 'some-branch',
          manager: 'some-manager',
          depType: 'dependencies',
        },
        {
          ...requiredDefaultOptions,
          branchName: 'some-branch',
          manager: 'some-manager',
          depType: 'devDependencies',
        },
      ] satisfies BranchUpgradeConfig[];
      const res = generateBranchConfig(upgrades);
      expect(res.depTypes).toEqual(['dependencies', 'devDependencies']);
    });
  });
});
