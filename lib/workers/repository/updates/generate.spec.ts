import { codeBlock } from 'common-tags';
import { logger, partial } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { NpmDatasource } from '../../../modules/datasource/npm/index.ts';
import type {
  SharedConstraint,
  SharedConstraints,
} from '../../../modules/manager/types.ts';
import { coerceArray } from '../../../util/array.ts';
import { type ConstraintName, isToolName } from '../../../util/exec/types.ts';
import { getParentDir } from '../../../util/fs/index.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import type { BranchUpgradeConfig } from '../../types.ts';
import { generateBranchConfig } from './generate.ts';

const {
  commitMessage,
  commitMessagePrefix,
  commitMessageAction,
  commitMessageTopic,
  commitMessageExtra,
  excludeCommitPaths,
} = getConfig();
let requiredDefaultOptions = {};

beforeEach(() => {
  requiredDefaultOptions = {
    commitMessage,
    commitMessagePrefix,
    commitMessageAction,
    commitMessageTopic,
    commitMessageExtra,
    excludeCommitPaths,
  };
});

function sharedConstraint(
  packageFile: string,
  values: Record<string, string | null>,
  manager = 'tools',
  depName?: string,
): SharedConstraints {
  const constraints: Partial<Record<ConstraintName, SharedConstraint>> = {};
  for (const [name, value] of Object.entries(values)) {
    if (isToolName(name)) {
      constraints[name] = { depName: depName ?? name, value };
    }
  }
  return {
    manager,
    packageFile,
    directory: getParentDir(packageFile),
    precedence: 0,
    constraints,
  };
}

describe('workers/repository/updates/generate', () => {
  describe('generateBranchConfig()', () => {
    it('does not group single upgrade by default', () => {
      const { groupSingleUpdates } = getConfig();
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          depName: 'some-dep',
          newVersion: '1.2.3',
          commitMessageExtra: 'to 1.2.3',
          groupName: 'some-group',
          prTitle: 'some-title',
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
          groupSingleUpdates,
          group: {
            foo: 2,
          },
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeUndefined();
      expect(res.isGroup).toBeUndefined();
      expect(res.recreateClosed).toBeFalse();
      expect(res.commitMessageExtra).toEqual('to 1.2.3');
    });

    it('groups single upgrade across multiple files', () => {
      const groupSingleUpdates = true;
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          depName: 'some-dep',
          newVersion: '2.0.0',
          commitMessageExtra: 'to v2',
          groupName: 'some-group',
          prTitle: 'some-title',
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
          groupSingleUpdates,
          group: {
            foo: 2,
          },
          packageFile: 'package.json',
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          depName: 'some-dep',
          newVersion: '2.0.0',
          commitMessageExtra: 'to v2',
          groupName: 'some-group',
          prTitle: 'some-title',
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
          groupSingleUpdates,
          group: {
            foo: 2,
          },
          packageFile: 'packages/core/package.json',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBe('some-group');
      expect(res.isGroup).toBeTrue();
      expect(res.recreateClosed).toBeTrue();
      expect(res.commitMessageExtra).toBeUndefined();
    });

    it('does not group single upgrade when groupSingleUpdates is false', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          depName: 'some-dep',
          groupName: 'some-group',
          prTitle: 'some-title',
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
          groupSingleUpdates: false,
          group: {
            foo: 2,
          },
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeUndefined();
      expect(res.recreateClosed).toBeFalse();
    });

    it('does not group single upgrade without groupName even with groupSingleUpdates', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          depName: 'some-dep',
          prTitle: 'some-title',
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
          groupSingleUpdates: true,
          group: {
            foo: 2,
          },
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeUndefined();
    });

    it('does not group single upgrade with sharedVariableName', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          depName: 'some-dep',
          newVersion: '3.2.1',
          commitMessageExtra: 'to v3.2.1',
          groupName: 'spring-boot.version',
          sharedVariableName: 'spring-boot.version',
          prTitle: 'some-title',
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
          groupSingleUpdates: true,
          group: {
            foo: 2,
          },
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeUndefined();
      expect(res.isGroup).toBeUndefined();
      expect(res.commitMessageExtra).toBe('to v3.2.1');
      expect(res.recreateClosed).toBeFalse();
    });

    it('handles lockFileMaintenance', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          prTitle: 'some-title',
          isLockFileMaintenance: true,
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res).toMatchObject({
        branchName: 'some-branch',
        prTitle: 'some-title',
        isLockFileMaintenance: true,
        upgrades: partial<BranchUpgradeConfig>([
          {
            branchName: 'some-branch',
            prTitle: 'some-title',
            isLockFileMaintenance: true,
            recreateClosed: true,
          },
        ]),
      });
    });

    it('sets minimumGroupSize based on upgrades', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          prTitle: 'some-title',
          minimumGroupSize: 1,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          prTitle: 'some-title',
          minimumGroupSize: 2,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          prTitle: 'some-title',
          minimumGroupSize: 3,
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.minimumGroupSize).toBe(3);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Multiple minimumGroupSize values found for this branch, using highest.',
      );
    });

    it('handles lockFileUpdate', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res).toMatchObject({
        branchName: 'some-branch',
        prTitle: 'some-title',
        isLockfileUpdate: true,
        currentValue: '^1.0.0',
        currentVersion: '1.0.0',
        lockedVersion: '1.0.0',
        newValue: '^1.0.0',
        newVersion: '1.0.1',
        prettyNewVersion: 'v1.0.1',
        upgrades: partial<BranchUpgradeConfig>([
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
        ]),
      });
    });

    it('does not group same upgrades', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          group: {
            foo: 2,
          },
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          group: {
            foo: 2,
          },
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeUndefined();
      expect(res.recreateClosed).toBeFalse();
    });

    it('groups multiple upgrades same version', () => {
      const branch: BranchUpgradeConfig[] = [
        partial<BranchUpgradeConfig>({
          // @ts-expect-error -- intentionally using invalid constraint names
          manager: 'some-manager',
          depName: 'some-dep',
          excludeCommitPaths: [],
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
          automerge: true,
          constraints: {
            foo: '1.0.0',
          },
        }),
        partial<BranchUpgradeConfig>({
          // @ts-expect-error -- intentionally using invalid constraint names
          manager: 'some-manager',
          depName: 'some-other-dep',
          excludeCommitPaths: [],
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-06T20:01:41+00:00' as Timestamp,
          automerge: false,
          constraints: {
            foo: '1.0.0',
            bar: '2.0.0',
          },
        }),
        partial<BranchUpgradeConfig>({
          manager: 'some-manager',
          depName: 'another-dep',
          excludeCommitPaths: [],
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-06T20:01:41+00:00' as Timestamp,
          automerge: false,
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toBe('2017-02-07T20:01:41+00:00');
      expect(res.automerge).toBeFalse();
      expect(res.constraints).toEqual({
        foo: '1.0.0',
        bar: '2.0.0',
      });
      expect(res.recreateClosed).toBe(false);
    });

    it('merges extractedConstraints of all upgrades', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          extractedConstraints: { python: '==3.11' },
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-other-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          extractedConstraints: { poetry: '1.8.0' },
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'another-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.extractedConstraints).toEqual({
        python: '==3.11',
        poetry: '1.8.0',
      });
    });

    it('sets the shared constraints for the package files next to their own extractedConstraints', () => {
      const sharedConstraints = [
        sharedConstraint('tools.toml', {
          node: '20',
          pnpm: '9',
          rust: '1.80.0',
        }),
        sharedConstraint('apps/web/tools.toml', { pnpm: '10', rust: null }),
      ];
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'npm',
          packageFile: 'apps/web/package.json',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          extractedConstraints: { node: '22', rust: '1.79.0' },
        },
        {
          excludeCommitPaths: [],
          manager: 'tools',
          packageFile: 'tools.toml',
          depName: 'some-tool',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
        },
      ]);

      const res = generateBranchConfig(branch, sharedConstraints);

      expect(res.extractedConstraints).toEqual({ node: '22', rust: '1.79.0' });
      expect(res.sharedConstraints).toEqual({ node: '20', pnpm: '10' });
      expect(res.upgrades[0].extractedConstraints).toEqual({
        node: '22',
        rust: '1.79.0',
      });
      expect(res.upgrades[0].sharedConstraints).toEqual({
        node: '20',
        pnpm: '10',
      });
      expect(res.upgrades[1]).not.toHaveProperty('sharedConstraints');
    });

    it.each`
      manager             | packageFile              | depName   | currentValue | newValue    | consumer   | constraint
      ${'rust-toolchain'} | ${'rust-toolchain.toml'} | ${'rust'} | ${'1.84.0'}  | ${'1.91.1'} | ${'cargo'} | ${'rust'}
      ${'mise'}           | ${'mise.toml'}           | ${'node'} | ${'20.11.0'} | ${'22.1.0'} | ${'npm'}   | ${'node'}
    `(
      'uses the new $constraint version of a $manager update in the same branch',
      ({
        manager,
        packageFile,
        depName,
        currentValue,
        newValue,
        consumer,
        constraint,
      }) => {
        const sharedConstraints = [
          sharedConstraint(
            packageFile,
            { [constraint]: currentValue },
            manager,
            depName,
          ),
        ];
        const toolUpgrade = partial<BranchUpgradeConfig>({
          manager,
          packageFile,
          depName,
          branchName: 'some-branch',
          excludeCommitPaths: [],
          currentValue,
          newValue,
          newVersion: newValue,
        });
        const consumerUpgrade = partial<BranchUpgradeConfig>({
          manager: consumer,
          packageFile: 'crates/foo/package-file',
          depName: 'some-dep',
          branchName: 'some-branch',
          excludeCommitPaths: [],
        });

        const grouped = generateBranchConfig(
          [toolUpgrade, consumerUpgrade],
          sharedConstraints,
        );
        const other = generateBranchConfig(
          [{ ...consumerUpgrade, branchName: 'other-branch' }],
          sharedConstraints,
        );

        expect(grouped.sharedConstraints).toEqual({
          [constraint]: newValue,
        });
        expect(grouped.upgrades[1].sharedConstraints).toEqual({
          [constraint]: newValue,
        });
        expect(other.sharedConstraints).toEqual({
          [constraint]: currentValue,
        });
      },
    );

    it('uses the new value of a tool constraint which the branch updates', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'renovate-config',
          depName: 'golang',
          depType: 'tool-constraint',
          branchName: 'some-branch',
          currentValue: '1.25',
          newValue: '1.27',
          constraints: { golang: '1.25', node: '22' },
        },
        {
          excludeCommitPaths: [],
          manager: 'mise',
          depName: 'go',
          branchName: 'some-branch',
          currentValue: '1.24.4',
          newValue: '1.27.0',
          constraints: { golang: '1.25' },
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.upgrades.map((upgrade) => upgrade.constraints)).toEqual([
        { golang: '1.27' },
        { golang: '1.27', node: '22' },
      ]);
    });

    it('keeps a different constraint value configured via `packageRules`', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'renovate-config',
          depName: 'golang',
          depType: 'tool-constraint',
          branchName: 'some-branch',
          currentValue: '1.25',
          newValue: '1.27',
          constraints: { golang: '1.25' },
        },
        {
          excludeCommitPaths: [],
          manager: 'gomod',
          depName: 'github.com/some/module',
          branchName: 'some-branch',
          currentValue: 'v1.0.0',
          newValue: 'v1.1.0',
          constraints: { golang: '1.24' },
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(
        res.upgrades.map((upgrade) => upgrade.constraints),
      ).toIncludeSameMembers([{ golang: '1.27' }, { golang: '1.24' }]);
    });

    it('groups major updates with different versions but same newValue, no recreateWhen', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: '5.1.2',
          newVersion: '5.1.2',
          isMajor: true,
          newMajor: 5,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-other-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: '5.2.0',
          newVersion: '5.2.0',
          isMajor: true,
          newMajor: 5,
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeDefined();
      expect(res.recreateClosed).toBeFalsy();
    });

    it('groups multiple digest updates immortally', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
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
          excludeCommitPaths: [],
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeDefined();
      expect(res.recreateClosed).toBeTrue();
    });

    it('recreates grouped pin & pinDigest', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeTrue();
    });

    it('does not recreate grouped pin & pinDigest when closed if recreateWhen=never', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeFalse();
    });

    it('recreates grouped pin', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeTrue();
    });

    it('recreates grouped pinDigest', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeTrue();
    });

    it('skips appending baseBranch and updateType to prTitle when prTitleStrict is true', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'depB',
          groupName: 'some-group',
          branchName: 'some-branch',
          commitMessage:
            '{{{groupName}}} {{{commitMessageExtra}}} {{{commitMessageSuffix}}}',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{prettyNewVersion}}{{/if}}',
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
          updateType: 'minor',
          separateMinorPatch: true,
          prTitleStrict: true,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          commitMessage:
            '{{{groupName}}} {{{commitMessageExtra}}} {{{commitMessageSuffix}}}',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{prettyNewVersion}}{{/if}}',
          newValue: '1.1.0',
          newVersion: '1.1.0',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00' as Timestamp,
          updateType: 'minor',
          separateMinorPatch: true,
          prTitleStrict: true,
        },
      ]);
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
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'depB',
          groupName: 'some-group',
          branchName: 'some-branch',
          commitMessage:
            '{{{groupName}}} {{{commitMessageExtra}}} {{{commitMessageSuffix}}}',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{prettyNewVersion}}{{/if}}',
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
          updateType: 'minor',
          separateMinorPatch: true,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          commitMessage:
            '{{{groupName}}} {{{commitMessageExtra}}} {{{commitMessageSuffix}}}',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{prettyNewVersion}}{{/if}}',
          newValue: '1.1.0',
          newVersion: '1.1.0',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00' as Timestamp,
          updateType: 'minor',
          separateMinorPatch: true,
        },
      ]);
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
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'depB',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: '^6.0',
          newVersion: '6.0.3',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: '^6.0',
          newVersion: '6.0.1',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00' as Timestamp,
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.isSingleVersion).toBeUndefined();
      expect(res.recreateClosed).toBeFalse();
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toBe('2017-02-08T20:01:41+00:00');
    });

    it('groups multiple upgrades different value but same version', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'depB',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: '^6.0.1',
          newVersion: '6.0.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: '^6.0.0',
          newVersion: '6.0.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00' as Timestamp,
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.isSingleVersion).toBeUndefined();
      expect(res.recreateClosed).toBeFalse();
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toBe('2017-02-08T20:01:41+00:00');
    });

    it('groups multiple digest updates', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
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
          group: {
            foo: 2,
          },
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'foo/baz',
          groupName: 'foo docker images',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: 'zzzzzzzzzz',
          group: {
            foo: 2,
          },
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeTrue();
      expect(res.groupName).toBeDefined();
    });

    it('pins digest to table', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.upgrades[0].displayFrom).toBe('');
      expect(res.upgrades[0].displayTo).toBe('abcdefg');
    });

    it('fixes different messages', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: '>= 5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00' as Timestamp,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}{{prettyNewMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          newValue: '^5,1,2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00' as Timestamp,
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeUndefined();
    });

    it('uses semantic commits', () => {
      const branch = partial<BranchUpgradeConfig>([
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
          group: {
            foo: 2,
          },
          branchName: 'some-branch',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(package): update dependency some-dep to v1.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(package): update dependency some-dep to v1.2.0',
      );
    });

    it('uses semantic commits without a scope', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          ...requiredDefaultOptions,
          manager: 'some-manager',
          depName: 'some-dep',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          branchName: 'some-branch',
        },
      ]);

      const res = generateBranchConfig(branch);

      expect(res.commitMessage).toBe(
        'chore: update dependency some-dep to v1.2.0',
      );
    });

    it('calculates the highest priority semanticCommitType', () => {
      const branch = partial<BranchUpgradeConfig>([
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
          branchName: 'some-branch',
        },
        {
          ...requiredDefaultOptions,
          manager: 'some-manager',
          depName: 'some-dep',
          semanticCommits: 'enabled',
          semanticCommitType: 'feat',
          semanticCommitScope: 'package',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          branchName: 'some-branch',
        },
        {
          ...requiredDefaultOptions,
          manager: 'some-manager',
          depName: 'some-dep',
          semanticCommits: 'enabled',
          semanticCommitType: 'fix',
          semanticCommitScope: 'package',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          branchName: 'some-branch',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'feat(package): update dependency some-dep to v1.2.0',
      );
      expect(res.commitMessage).toBe(
        'feat(package): update dependency some-dep to v1.2.0',
      );
    });

    it('scopes monorepo commits', () => {
      const branch = partial<BranchUpgradeConfig>([
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
          group: {
            foo: 2,
          },
          branchName: 'some-branch',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('chore(): update dependency some-dep to v1.2.0');
      expect(res.commitMessage).toBe(
        'chore(): update dependency some-dep to v1.2.0',
      );
    });

    it('scopes monorepo commits with nested package files using parent directory', () => {
      const branch = partial<BranchUpgradeConfig>([
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
          group: {
            foo: 2,
          },
          branchName: 'some-branch',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(bar): update dependency some-dep to v1.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(bar): update dependency some-dep to v1.2.0',
      );
    });

    it('scopes monorepo commits with nested package files using base directory', () => {
      const branch = partial<BranchUpgradeConfig>([
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
          group: {
            foo: 2,
          },
          branchName: 'some-branch',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0',
      );
    });

    it('use prettyVersion in pr title when there is a v', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep v1.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep v1.2.0',
      );
    });

    it('use prettyVersion in pr title there is no v', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep v3.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep v3.2.0',
      );
    });

    it('use newMajor in pr title with v', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('chore(foo/bar): update dependency some-dep v3');
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep v3',
      );
    });

    it('Default commitMessageExtra pr title', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0',
      );
      expect(res.commitMessage).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0',
      );
    });

    it('adds commit message body', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('Update dependency some-dep to v1.2.0');
      expect(res.commitMessage).toBe('Update dependency some-dep to v1.2.0');
    });

    it('supports manual prTitle', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          ...requiredDefaultOptions,
          manager: 'some-manager',
          depName: 'some-dep',
          prTitle: 'Upgrade {{depName}}',
          toLowerCase: true,
          branchName: 'some-branch',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('upgrade some-dep');
      expect(res.commitMessage).toBe('update dependency some-dep to');
    });

    describe('url userinfo in dependency names', () => {
      it.each`
        depName                                          | expected
        ${'https://user:token@git.example.com/org/repo'} | ${'https://git.example.com/org/repo'}
        ${'https://${USER}@git.example.com/org/repo'}    | ${'https://${USER}@git.example.com/org/repo'}
        ${'ssh://git@git.example.com/org/repo'}          | ${'ssh://git@git.example.com/org/repo'}
      `(
        'uses $expected in commit message and PR title',
        ({ depName, expected }: { depName: string; expected: string }) => {
          const branch = partial<BranchUpgradeConfig>([
            {
              ...requiredDefaultOptions,
              manager: 'some-manager',
              depName,
              newValue: '1.2.0',
              isSingleVersion: true,
              newVersion: '1.2.0',
              branchName: 'some-branch',
            },
          ]);

          const res = generateBranchConfig(branch);

          expect(res.commitMessage).toBe(
            `Update dependency ${expected} to v1.2.0`,
          );
          expect(res.prTitle).toBe(`Update dependency ${expected} to v1.2.0`);
        },
      );

      it('removes credentials from a lowercased commit message and manual PR title', () => {
        const branch = partial<BranchUpgradeConfig>([
          {
            ...requiredDefaultOptions,
            manager: 'some-manager',
            depName: 'https://User:Token@git.example.com/org/repo',
            semanticCommits: 'enabled',
            semanticCommitType: 'chore',
            prTitle: 'Upgrade {{depName}}',
            newValue: '1.2.0',
            isSingleVersion: true,
            newVersion: '1.2.0',
            branchName: 'some-branch',
          },
        ]);

        const res = generateBranchConfig(branch);

        expect(res.commitMessage).toBe(
          'chore: update dependency https://git.example.com/org/repo to v1.2.0',
        );
        expect(res.prTitle).toBe('upgrade https://git.example.com/org/repo');
      });

      it('removes credentials from a group PR title and commit message', () => {
        const group = {
          commitMessageTopic: '{{{groupName}}}',
          prTitle: 'Update {{{groupName}}} to {{{newValue}}}',
        };
        const branch = partial<BranchUpgradeConfig>([
          {
            ...requiredDefaultOptions,
            manager: 'some-manager',
            depName: 'https://user:token@git.example.com/org/repo',
            groupName: 'https://user:token@git.example.com/org/repo',
            groupSingleUpdates: true,
            newValue: '1.2.0',
            newVersion: '1.2.0',
            branchName: 'some-branch',
            group,
          },
          {
            ...requiredDefaultOptions,
            manager: 'some-manager',
            depName: 'https://user:token@git.example.com/org/other',
            groupName: 'https://user:token@git.example.com/org/repo',
            groupSingleUpdates: true,
            newValue: '1.2.0',
            newVersion: '1.2.0',
            branchName: 'some-branch',
            group,
          },
        ]);

        const res = generateBranchConfig(branch);

        expect(res.isGroup).toBeTrue();
        expect(res.prTitle).toBe(
          'Update https://git.example.com/org/repo to 1.2.0',
        );
        expect(res.commitMessage).not.toContain('token');
        expect(res.commitMessage).toContain('https://git.example.com/org/repo');
      });

      it('removes credentials from the commit body table', () => {
        const branch = partial<BranchUpgradeConfig>([
          {
            ...requiredDefaultOptions,
            manager: 'some-manager',
            commitBodyTable: true,
            datasource: 'git-tags',
            depName: 'repo',
            packageName: 'https://user:token@git.example.com/org/repo',
            currentValue: '1.0.0',
            currentVersion: '1.0.0',
            newValue: '1.2.0',
            newVersion: '1.2.0',
            branchName: 'some-branch',
          },
        ]);

        const res = generateBranchConfig(branch);

        expect(res.commitMessage).toContain(
          '| https://git.example.com/org/repo |',
        );
        expect(res.commitMessage).not.toContain('token');
      });
    });

    it('handles @types specially', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
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
          excludeCommitPaths: [],
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
          excludeCommitPaths: [],
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeFalse();
      expect(res.groupName).toBeUndefined();
      expect(res).toMatchObject({
        hasTypes: true,
        upgrades: partial<BranchUpgradeConfig>([
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
            manager: 'some-manager',
            depName: '@types/some-dep',
            branchName: 'some-branch',
            newValue: '0.5.8',
          },
        ]),
      });
    });

    it('handles @types specially (reversed)', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
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
          excludeCommitPaths: [],
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
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: '@types/some-dep',
          groupName: null as never,
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.5.7',
          labels: ['a'],
          group: {},
        },
      ]);
      expect(generateBranchConfig(branch)).toMatchObject({
        labels: ['a', 'c', 'b'],
        upgrades: partial<BranchUpgradeConfig>([
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
            manager: 'some-manager',
            depName: '@types/some-dep',
            branchName: 'some-branch',
            newValue: '0.5.7',
            labels: ['a'],
          },
        ]),
      });
    });

    it('handles upgrades', () => {
      const baseBranchesUpdates = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          hasBaseBranches: true,
          baseBranch: 'base-branch',
          fileReplacePosition: 5,
        },
      ]);
      expect(generateBranchConfig(baseBranchesUpdates)).toMatchObject({
        prTitle: 'some-title (base-branch)',
      });
      const separateMinorUpdates = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          ...requiredDefaultOptions,
          commitMessageExtra: '',
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          isGroup: true,
          separateMinorPatch: true,
          updateType: 'minor',
          fileReplacePosition: 1,
        },
      ]);
      expect(generateBranchConfig(separateMinorUpdates)).toMatchObject({
        prTitle: 'some-title (minor)',
      });
      const separateMajorUpdates = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          ...requiredDefaultOptions,
          commitMessageExtra: '',
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          isGroup: true,
          separateMajorMinor: true,
          updateType: 'major',
          fileReplacePosition: 2,
        },
      ]);
      expect(generateBranchConfig(separateMajorUpdates)).toMatchObject({
        prTitle: 'some-title (major)',
      });
      const separatePatchUpdates = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          ...requiredDefaultOptions,
          commitMessageExtra: '',
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          isGroup: true,
          separateMajorMinor: true,
          separateMinorPatch: true,
          updateType: 'patch',
          fileReplacePosition: 0,
        },
      ]);
      expect(generateBranchConfig(separatePatchUpdates)).toMatchObject({
        prTitle: 'some-title (patch)',
      });
      const branch = partial<BranchUpgradeConfig>([
        ...baseBranchesUpdates,
        ...separateMinorUpdates,
        ...separateMajorUpdates,
        ...separatePatchUpdates,
      ]);
      expect(generateBranchConfig(branch)).toMatchObject({
        prTitle: 'some-title (patch)',
      });

      // Does not append suffix when commitMessageExtra provides a version
      const majorWithVersionInTitle = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          ...requiredDefaultOptions,
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '2.0.0',
          newVersion: '2.0.0',
          newMajor: 2,
          prettyNewMajor: 'v2',
          commitMessageExtra: 'to v2',
          isGroup: true,
          separateMajorMinor: true,
          updateType: 'major',
          fileReplacePosition: 0,
        },
      ]);
      expect(generateBranchConfig(majorWithVersionInTitle)).toMatchObject({
        prTitle: 'some-title',
      });
      const minorWithVersionInTitle = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          ...requiredDefaultOptions,
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '1.2.0',
          newVersion: '1.2.0',
          commitMessageExtra: 'to 1.2.0',
          isGroup: true,
          separateMinorPatch: true,
          updateType: 'minor',
          fileReplacePosition: 0,
        },
      ]);
      expect(generateBranchConfig(minorWithVersionInTitle)).toMatchObject({
        prTitle: 'some-title',
      });

      // Appends suffix when commitMessageExtra is non-version text
      const majorWithNonVersionExtra = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          ...requiredDefaultOptions,
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '2.0.0',
          newVersion: '2.0.0',
          newMajor: 2,
          prettyNewMajor: 'v2',
          commitMessageExtra: 'from upstream',
          isGroup: true,
          separateMajorMinor: true,
          updateType: 'major',
          fileReplacePosition: 0,
        },
      ]);
      expect(generateBranchConfig(majorWithNonVersionExtra)).toMatchObject({
        prTitle: 'some-title (major)',
      });
    });

    it('combines prBodyColumns', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          prBodyColumns: ['column-a', 'column-b'],
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          prBodyColumns: ['column-c', 'column-b', 'column-a'],
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prBodyColumns).toEqual(['column-a', 'column-b', 'column-c']);
    });

    it('sorts upgrades, without position first', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep1',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: 1,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep2',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: undefined,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep3',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: 4,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep4',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: undefined,
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(
        res.upgrades.map((upgrade) => upgrade.fileReplacePosition),
      ).toStrictEqual([undefined, undefined, 4, 1]);
    });

    it('passes through pendingChecks', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          pendingChecks: true,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          pendingChecks: true,
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.pendingChecks).toBeTrue();
      expect(res.upgrades).toHaveLength(2);
    });

    it('filters pendingChecks', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          pendingChecks: true,
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.pendingChecks).toBeUndefined();
      expect(res.upgrades).toHaveLength(1);
    });

    it('displays pending versions', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'No pending version',
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'One pending version',
          pendingVersions: ['1.1.0'],
        },
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'Two pending versions',
          pendingVersions: ['1.1.0', '1.1.1'],
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.upgrades.map((u) => u.displayPending)).toStrictEqual([
        '',
        '`1.1.0`',
        '`1.1.1` (+1)',
      ]);
    });

    it('merge excludeCommitPaths if appears in upgrade', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
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
      ]);
      const res = generateBranchConfig(branch);
      const excludeCommitPaths = coerceArray(res.excludeCommitPaths);
      expect(excludeCommitPaths.sort()).toStrictEqual(
        ['some/path', 'some/other/path', 'some/other-manager/path'].sort(),
      );
    });

    it('generates pretty version name properly', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(package): update dependency some-dep to foo-pkg-v3.2.1',
      );
      expect(res.commitMessage).toBe(
        'chore(package): update dependency some-dep to foo-pkg-v3.2.1',
      );
    });

    it('prevents issue with duplicating "v" character', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          manager: 'some-manager',
          branchName: 'some-branch',
          commitMessage: 'update to vv1.2.0',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('update to v1.2.0');
      expect(res.commitMessage).toBe('update to v1.2.0');
    });

    it('apply semanticCommits and commitMessagePrefix together', () => {
      const branch = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('PATCH: Update dependency some-dep to 1.2.0');
      expect(res.commitMessage).toBe(
        'PATCH: Update dependency some-dep to 1.2.0',
      );
    });

    it('dedupes duplicate table rows', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          commitBodyTable: true,
          manager: 'some-manager',
          datasource: NpmDatasource.id,
          depName: 'some-dep',
          packageName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          currentVersion: '5.1.0',
          newVersion: '5.1.2',
        },
        {
          excludeCommitPaths: [],
          commitBodyTable: true,
          manager: 'some-manager',
          datasource: 'docker',
          depName: 'some-dep',
          packageName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          currentVersion: '5.1.0',
          newVersion: '5.1.2',
        },
        {
          excludeCommitPaths: [],
          commitBodyTable: true,
          manager: 'some-manager',
          datasource: NpmDatasource.id,
          depName: 'another-dep',
          packageName: 'another-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          currentVersion: '5.1.1',
          newVersion: '5.1.2',
        },
        {
          excludeCommitPaths: [],
          commitBodyTable: true,
          manager: 'some-manager',
          datasource: NpmDatasource.id,
          depName: 'another-dep',
          packageName: 'another-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          currentVersion: '5.1.1',
          newVersion: '5.1.2',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.commitMessage?.trim()).toBe(codeBlock`
        | datasource | package     | from  | to    |
        | ---------- | ----------- | ----- | ----- |
        | npm        | another-dep | 5.1.1 | 5.1.2 |
        | npm        | some-dep    | 5.1.0 | 5.1.2 |
        | docker     | some-dep    | 5.1.0 | 5.1.2 |
      `);
      expect([
        // oxlint-disable-next-line renovate/prefer-coerce-array -- matchAll() yields an iterator, which coerceArray() does not accept
        ...(res.commitMessage?.matchAll(/another-dep/g) ?? []),
      ]).toBeArrayOfSize(1);
      expect([
        // oxlint-disable-next-line renovate/prefer-coerce-array -- matchAll() yields an iterator, which coerceArray() does not accept
        ...(res.commitMessage?.matchAll(/some-dep/g) ?? []),
      ]).toBeArrayOfSize(2);
    });

    it('using commitMessagePrefix without separator', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          ...requiredDefaultOptions,
          branchName: 'some-branch',
          commitMessagePrefix: '🆙',
          depName: 'some-dep',
          manager: 'some-manager',
          newValue: '1.2.0',
          commitMessageAction: 'Update',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('🆙 Update dependency some-dep to 1.2.0');
      expect(res.commitMessage).toBe('🆙 Update dependency some-dep to 1.2.0');
    });

    it('merges additionalReviewers', () => {
      const upgrades = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(upgrades);
      expect(res.additionalReviewers).toEqual(['foo', 'bar']);
    });

    it('merges depTypes', () => {
      const upgrades = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(upgrades);
      expect(res.depTypes).toEqual(['dependencies', 'devDependencies']);
    });

    it('depTypes is available on each branch upgrade object', () => {
      const upgrades = partial<BranchUpgradeConfig>([
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
      ]);
      const res = generateBranchConfig(upgrades);

      expect(res.depTypes).toEqual(['dependencies', 'devDependencies']);

      for (const upgrade of res.upgrades) {
        expect(upgrade.depTypes).toEqual(res.depTypes);
      }
    });

    it('allows upgrades in commitMessage', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          ...requiredDefaultOptions,
          manager: 'some-manager',
          branchName: 'dep1',
          depName: 'dep1',
          commitMessagePrefix:
            '{{#each upgrades}}{{{prBodyDefinitions.Issue}}} {{/each}}',
          newVersion: '1.2.0',
          newValue: '1.2.0',
          updateType: 'minor',
          fileReplacePosition: 1,
          prBodyDefinitions: {
            Issue: 'I1',
          },
        },
      ]);

      expect(generateBranchConfig(branch)).toMatchObject({
        commitMessage: 'I1 Update dependency dep1 to 1.2.0',
        prTitle: 'I1 Update dependency dep1 to 1.2.0',
      });
    });

    it('allows upgrades in commitMessage (group)', () => {
      const commonOptions = {
        ...requiredDefaultOptions,
        manager: 'some-manager',
        branchName: 'deps',
        groupName: 'deps',
        group: {
          commitMessageTopic: '{{{groupName}}}',
          commitMessagePrefix:
            '{{#each upgrades}}{{{prBodyDefinitions.Issue}}} {{/each}}',
        },
      };

      const branch = partial<BranchUpgradeConfig>([
        {
          ...commonOptions,
          depName: 'dep1',
          newVersion: '1.2.0',
          newValue: '1.2.0',
          updateType: 'minor',
          fileReplacePosition: 1,
          prBodyDefinitions: {
            Issue: 'I1',
          },
        },
        {
          ...commonOptions,
          depName: 'dep2',
          newVersion: '1.0.0',
          newValue: '1.0.0',
          updateType: 'major',
          fileReplacePosition: 2,
          prBodyDefinitions: {
            Issue: 'I2',
          },
        },
        {
          ...commonOptions,
          depName: 'dep3',
          newVersion: '1.2.3',
          newValue: '1.2.3',
          updateType: 'patch',
          fileReplacePosition: 0,
          prBodyDefinitions: {
            Issue: 'I3',
          },
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res).toMatchObject({
        commitMessage: 'I3 I2 I1 Update deps',
        prTitle: 'I3 I2 I1 Update deps',
      });
    });

    it('sets skipArtifactsUpdate to false when no upgrades specify a value', () => {
      const commonOptions = {
        ...requiredDefaultOptions,
        manager: 'some-manager',
        branchName: 'deps',
      };

      const branch = partial<BranchUpgradeConfig>([
        {
          ...commonOptions,
          depName: 'dep1',
          newVersion: '1.2.0',
          newValue: '1.2.0',
          updateType: 'minor',
          fileReplacePosition: 1,
          prBodyDefinitions: {
            Issue: 'I1',
          },
        },
        {
          ...commonOptions,
          depName: 'dep2',
          newVersion: '1.0.0',
          newValue: '1.0.0',
          updateType: 'major',
          fileReplacePosition: 2,
          prBodyDefinitions: {
            Issue: 'I2',
          },
        },
        {
          ...commonOptions,
          depName: 'dep3',
          newVersion: '1.2.3',
          newValue: '1.2.3',
          updateType: 'patch',
          fileReplacePosition: 0,
          prBodyDefinitions: {
            Issue: 'I3',
          },
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res).toMatchObject({
        skipArtifactsUpdate: false,
      });
    });

    it('sets skipArtifactsUpdate to true when all upgrades specify true', () => {
      const commonOptions = {
        ...requiredDefaultOptions,
        manager: 'some-manager',
        branchName: 'deps',
      };

      const branch = partial<BranchUpgradeConfig>([
        {
          ...commonOptions,
          depName: 'dep1',
          newVersion: '1.2.0',
          newValue: '1.2.0',
          updateType: 'minor',
          skipArtifactsUpdate: true,
          fileReplacePosition: 1,
          prBodyDefinitions: {
            Issue: 'I1',
          },
        },
        {
          ...commonOptions,
          depName: 'dep2',
          newVersion: '1.0.0',
          newValue: '1.0.0',
          updateType: 'major',
          skipArtifactsUpdate: true,
          fileReplacePosition: 2,
          prBodyDefinitions: {
            Issue: 'I2',
          },
        },
        {
          ...commonOptions,
          depName: 'dep3',
          newVersion: '1.2.3',
          newValue: '1.2.3',
          updateType: 'patch',
          skipArtifactsUpdate: true,
          fileReplacePosition: 0,
          prBodyDefinitions: {
            Issue: 'I3',
          },
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res).toMatchObject({
        skipArtifactsUpdate: true,
      });
    });

    it.each([true, false])(
      'sets skipArtifactsUpdate to false when not all upgrades specify true and first is $0',
      (first) => {
        const commonOptions = {
          ...requiredDefaultOptions,
          manager: 'some-manager',
          branchName: 'deps',
        };

        const branch = partial<BranchUpgradeConfig>([
          {
            ...commonOptions,
            depName: 'dep1',
            newVersion: '1.2.0',
            newValue: '1.2.0',
            updateType: 'minor',
            skipArtifactsUpdate: first,
            fileReplacePosition: 1,
            prBodyDefinitions: {
              Issue: 'I1',
            },
          },
          {
            ...commonOptions,
            depName: 'dep2',
            newVersion: '1.0.0',
            newValue: '1.0.0',
            updateType: 'major',
            fileReplacePosition: 2,
            prBodyDefinitions: {
              Issue: 'I2',
            },
          },
          {
            ...commonOptions,
            depName: 'dep3',
            newVersion: '1.2.3',
            newValue: '1.2.3',
            updateType: 'patch',
            skipArtifactsUpdate: true,
            fileReplacePosition: 0,
            prBodyDefinitions: {
              Issue: 'I3',
            },
          },
        ]);
        const res = generateBranchConfig(branch);
        expect(res).toMatchObject({
          skipArtifactsUpdate: false,
        });

        expect(logger.logger.debug).toHaveBeenCalledWith(
          {
            upgrades: partial<BranchUpgradeConfig>([
              { depName: 'dep3', skipArtifactsUpdate: true },
              { depName: 'dep2', skipArtifactsUpdate: undefined },
              { depName: 'dep1', skipArtifactsUpdate: first },
            ]),
          },
          'Mixed `skipArtifactsUpdate` values in upgrades. Artifacts will be updated.',
        );
      },
    );

    it('uses prettyDepType when already set', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          ...requiredDefaultOptions,
          manager: 'some-manager',
          branchName: 'deps',
          prettyDepType: 'devDependency',
          depType: 'dev',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.upgrades[0].prettyDepType).toBe('devDependency');
    });

    it('falls back to depType when prettyDepType is not set', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          ...requiredDefaultOptions,
          manager: 'some-manager',
          branchName: 'deps',
          depType: 'dev',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.upgrades[0].prettyDepType).toBe('dev');
    });

    it('defaults prettyDepType to dependency when neither prettyDepType nor depType is set', () => {
      const branch = partial<BranchUpgradeConfig>([
        {
          ...requiredDefaultOptions,
          manager: 'some-manager',
          branchName: 'deps',
        },
      ]);
      const res = generateBranchConfig(branch);
      expect(res.upgrades[0].prettyDepType).toBe('dependency');
    });
  });
});
