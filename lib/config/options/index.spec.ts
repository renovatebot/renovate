import { isNullOrUndefined } from '@sindresorhus/is';
import * as manager from '../../modules/manager/index.ts';
import * as platform from '../../modules/platform/index.ts';
import type { PackageRule, RenovateSharedConfig } from '../types.ts';
import { getOptions } from './index.ts';

vi.unmock('../../modules/platform/index.ts');

describe('config/options/index', () => {
  it('test manager should have no defaultConfig', () => {
    vi.doMock('../../modules/manager/index.ts', () => ({
      getManagers: vi.fn(() => new Map().set('testManager', {})),
    }));

    const opts = getOptions();
    expect(opts.filter((o) => o.name === 'testManager')).toEqual([]);
  });

  it('supportedManagers should have valid names', () => {
    const opts = getOptions();
    const managerList = Array.from(manager.getManagers().keys());

    opts
      .filter((option) => option.supportedManagers)
      .forEach((option) => {
        expect(option.supportedManagers).toBeNonEmptyArray();
        for (const item of option.supportedManagers!) {
          expect(managerList).toContain(item);
        }
      });
  });

  it('supportedPlatforms should have valid names', () => {
    const opts = getOptions();
    const platformList = Array.from(platform.getPlatformList());

    opts
      .filter((option) => option.supportedPlatforms)
      .forEach((option) => {
        expect(option.supportedPlatforms).toBeNonEmptyArray();
        for (const item of option.supportedPlatforms!) {
          expect(platformList).toContain(item);
        }
      });
  });

  it('should not contain duplicate option names', () => {
    const optsNames = getOptions().map((option) => option.name);
    const optsNameSet = new Set(optsNames);
    expect(optsNames).toHaveLength(optsNameSet.size);
  });

  describe('every option with allowedValues and a default must have the default in allowedValues', () => {
    const opts = getOptions();
    for (const option of opts.filter(
      (o) => o.allowedValues && !isNullOrUndefined(o.default),
    )) {
      it(`${option.name}: \`${option.default}\` is in ${JSON.stringify(option.allowedValues)}`, () => {
        expect(option.allowedValues).toBeDefined();

        const defaults = Array.isArray(option.default)
          ? option.default
          : [option.default];
        for (const defVal of defaults) {
          expect(option.allowedValues).toContain(defVal);
        }
      });
    }
  });

  describe('every option with a siblingProperties has a `property` that matches a known option', () => {
    const opts = getOptions();
    const optionNames = new Set(opts.map((o) => o.name));

    for (const option of opts.filter((o) => o.requiredIf)) {
      for (const req of option.requiredIf!) {
        for (const prop of req.siblingProperties) {
          it(`${option.name}'s reference to ${prop.property} is valid`, () => {
            expect(optionNames).toContain(prop.property);
          });

          const foundOption = opts.filter((o) => o.name === prop.property);
          // oxlint-disable-next-line vitest/no-conditional-tests -- TODO: fix me
          if (foundOption?.length && foundOption[0].allowedValues) {
            it(`${option.name}'s value for ${prop.property} is valid, according to allowedValues`, () => {
              expect(foundOption[0].allowedValues).toContain(prop.value);
            });
          }
        }
      }
    }
  });

  it('RenovateSharedConfig options should declare both . and packageRules in parents', () => {
    // Compile-time check: all names here must be valid keys of RenovateSharedConfig
    const sharedConfigOptionNames = [
      'abandonmentThreshold',
      'addLabels',
      'assignAutomerge',
      'autoApprove',
      'autoReplaceGlobalMatch',
      'automerge',
      'automergeSchedule',
      'automergeStrategy',
      'automergeType',
      'azureWorkItemId',
      'branchName',
      'branchNameStrict',
      'branchPrefix',
      'branchPrefixOld',
      'bumpVersions',
      'changelogUrl',
      'commitBody',
      'commitBodyTable',
      'commitMessage',
      'commitMessageAction',
      'commitMessageExtra',
      'commitMessageLowerCase',
      'commitMessagePrefix',
      'commitMessageTopic',
      'confidential',
      'configValidationError',
      'dependencyDashboardApproval',
      'draftPR',
      'enabled',
      'enabledManagers',
      'encrypted',
      'extends',
      'extractVersion',
      'followTag',
      'force',
      'gitIgnoredAuthors',
      'group',
      'groupName',
      'groupSlug',
      'hashedBranchLength',
      'ignoreDeps',
      'ignorePaths',
      'ignoreTests',
      'ignoreUnstable',
      'includePaths',
      'internalChecksAsSuccess',
      'internalChecksFilter',
      'keepUpdatedLabel',
      'labels',
      'managerFilePatterns',
      'milestone',
      'minimumReleaseAge',
      'npmrc',
      'npmrcMerge',
      'npmToken',
      'pinDigests',
      'platformAutomerge',
      'platformCommit',
      'postUpgradeTasks',
      'prBodyColumns',
      'prBodyDefinitions',
      'prBodyHeadingDefinitions',
      'prBodyNotes',
      'prCreation',
      'prFooter',
      'prHeader',
      'prPriority',
      'prTitle',
      'prTitleStrict',
      'productLinks',
      'pruneBranchAfterAutomerge',
      'rangeStrategy',
      'rebaseLabel',
      'rebaseWhen',
      'recreateWhen',
      'respectLatest',
      'rollbackPrs',
      'schedule',
      'semanticCommitScope',
      'semanticCommitType',
      'semanticCommits',
      'separateMajorMinor',
      'separateMinorPatch',
      'separateMultipleMajor',
      'separateMultipleMinor',
      'skipArtifactsUpdate',
      'stopUpdatingLabel',
      'suppressNotifications',
      'timezone',
      'unicodeEmoji',
      'updateNotScheduled',
      'versioning',
      'versionCompatibility',
    ] as const satisfies readonly (keyof RenovateSharedConfig)[];

    // Compile-time check: all names here must be valid keys of PackageRule
    const packageRuleOptionNames = [
      'allowedVersions',
      'registryUrls',
      'replacementName',
      'replacementVersion',
      'sourceUrl',
      'sourceDirectory',
      'overrideDatasource',
      'overrideDepName',
      'overridePackageName',
      // UpdateConfig keys (major/minor/etc. are typed as PackageRule in UpdateConfig)
      'major',
      'minor',
      'patch',
      'pin',
      'digest',
      'pinDigest',
      'rollback',
      'replacement',
      'lockFileMaintenance',
    ] as const satisfies readonly (keyof PackageRule)[];

    const opts = getOptions();
    for (const name of [
      ...sharedConfigOptionNames,
      ...packageRuleOptionNames,
    ]) {
      const opt = opts.find((o) => o.name === name);
      if (!opt?.globalOnly) {
        expect(
          opt?.parents,
          `option '${name}' should declare '.' in parents`,
        ).toContain('.');
        expect(
          opt?.parents,
          `option '${name}' should declare 'packageRules' in parents`,
        ).toContain('packageRules');
      }
    }
  });
});
