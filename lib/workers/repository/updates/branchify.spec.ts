import { type RenovateConfig, git, partial } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { extractPackageJson } from '../../../modules/manager/npm/extract/common/package-file.ts';
import type { PackageFile } from '../../../modules/manager/types.ts';
import type { BranchUpgradeConfig } from '../../types.ts';
import * as _changelog from '../changelog/index.ts';
import { applyRepoConfigDefaults } from '../init/defaults.ts';
import { getUpdatedPackageFiles } from '../update/branch/get-updated.ts';
import { branchifyUpgrades } from './branchify.ts';
import * as _flatten from './flatten.ts';

const flattenUpdates = vi.mocked(_flatten).flattenUpdates;
const embedChangelogs = vi.mocked(_changelog).embedChangelogs;

vi.mock('./flatten.ts');
vi.mock('../changelog/index.ts');

let config: RenovateConfig;

beforeEach(() => {
  config = applyRepoConfigDefaults(getConfig());
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/updates/branchify', () => {
  describe('branchifyUpgrades()', () => {
    it('groups and updates both Yarn package manager declarations', async () => {
      config.semanticCommits = 'disabled';
      const original = {
        packageManager: 'yarn@4.5.0',
        devEngines: { packageManager: { name: 'yarn', version: '4.5.0' } },
      };
      const extracted = extractPackageJson(original, 'package.json')!;
      for (const dep of extracted.deps) {
        dep.updates = [
          {
            newValue: '4.6.0',
            newVersion: '4.6.0',
            newMajor: 4,
            updateType: 'minor',
          },
        ];
      }
      const actualFlatten =
        await vi.importActual<typeof _flatten>('./flatten.ts');
      flattenUpdates.mockImplementationOnce(actualFlatten.flattenUpdates);
      git.getFile.mockResolvedValue(JSON.stringify(original));

      const { branches } = await branchifyUpgrades(config, {
        npm: [{ ...extracted, packageFile: 'package.json' }],
      });

      expect(branches).toHaveLength(1);
      expect(
        branches[0].upgrades.map(({ depType }) => depType),
      ).toIncludeSameMembers(['devEngines.packageManager', 'packageManager']);
      const result = await getUpdatedPackageFiles(branches[0]);
      expect(result.updatedPackageFiles).toHaveLength(1);
      const manifest = result.updatedPackageFiles[0];
      expect(manifest.type).toBe('addition');
      if (manifest.type !== 'addition') {
        throw new Error('Expected package.json update');
      }
      expect(JSON.parse(manifest.contents!.toString())).toEqual({
        packageManager: 'yarn@4.6.0',
        devEngines: { packageManager: { name: 'yarn', version: '4.6.0' } },
      });
    });

    it('returns empty', async () => {
      flattenUpdates.mockResolvedValueOnce([]);
      const res = await branchifyUpgrades(config, {});
      expect(res.branches).toBeEmptyArray();
    });

    it('applies the constraints which package files share to the upgrades in their directory', async () => {
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            excludeCommitPaths: [],
            manager: 'npm',
            depName: 'foo',
            branchName: 'foo',
            prTitle: 'some-title',
            packageFile: 'apps/web/package.json',
          },
        ]),
      );

      const res = await branchifyUpgrades(config, {
        mise: [
          {
            packageFile: 'apps/web/mise.toml',
            deps: [],
            sharedConstraintsScope: {
              directory: 'apps/web',
              precedence: 7,
              constraints: { pnpm: { depName: 'pnpm', value: '10.16.1' } },
            },
          },
        ],
      });

      expect(res.branches[0].sharedConstraints).toEqual({ pnpm: '10.16.1' });
    });

    it('returns one branch if one input', async () => {
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            excludeCommitPaths: [],
            depName: 'foo',
            branchName: 'foo-{{version}}',
            version: '1.1.0',
            prTitle: 'some-title',
            updateType: 'minor',
            packageFile: 'foo/package.json',
          },
        ]),
      );
      config.repoIsOnboarded = true;
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(1);
    });

    it('deduplicates', async () => {
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            excludeCommitPaths: [],
            depName: 'foo',
            branchName: 'foo-{{version}}',
            currentValue: '1.1.0',
            newValue: '1.3.0',
            prTitle: 'some-title',
            updateType: 'minor',
            packageFile: 'foo/package.json',
          },
          {
            excludeCommitPaths: [],
            depName: 'foo',
            branchName: 'foo-{{version}}',
            currentValue: '1.1.0',
            newValue: '1.2.0',
            prTitle: 'some-title',
            updateType: 'minor',
            packageFile: 'foo/package.json',
          },
        ]),
      );
      config.repoIsOnboarded = true;
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(1);
    });

    it('groups if same compiled branch names', async () => {
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            excludeCommitPaths: [],
            depName: 'foo',
            branchName: 'foo',
            version: '1.1.0',
            prTitle: 'some-title',
          },
          {
            excludeCommitPaths: [],
            depName: 'foo',
            branchName: 'foo',
            version: '2.0.0',
            prTitle: 'some-title',
          },
          {
            excludeCommitPaths: [],
            depName: 'bar',
            branchName: 'bar-{{version}}',
            version: '1.1.0',
            prTitle: 'some-title',
          },
        ]),
      );
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(2);
    });

    it('groups if same compiled group name', async () => {
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            excludeCommitPaths: [],
            depName: 'foo',
            branchName: 'foo',
            prTitle: 'some-title',
            version: '1.1.0',
            groupName: 'My Group',
            group: { branchName: 'renovate/{{groupSlug}}' },
          },
          {
            excludeCommitPaths: [],
            depName: 'foo',
            branchName: 'foo',
            prTitle: 'some-title',
            version: '2.0.0',
          },
          {
            excludeCommitPaths: [],
            depName: 'bar',
            branchName: 'bar-{{version}}',
            prTitle: 'some-title',
            version: '1.1.0',
            groupName: 'My Group',
            group: { branchName: 'renovate/my-group' },
          },
        ]),
      );
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(2);
    });

    describe('with lookup failures', () => {
      const groupUpdates = partial<BranchUpgradeConfig>([
        {
          excludeCommitPaths: [],
          depName: 'foo',
          branchName: 'renovate/my-group',
          prTitle: 'some-title',
          version: '1.1.0',
          groupName: 'My Group',
          group: { branchName: 'renovate/my-group' },
        },
        {
          excludeCommitPaths: [],
          depName: 'bar',
          branchName: 'renovate/bar',
          prTitle: 'some-title',
          version: '1.1.0',
        },
      ]);

      function getPackageFiles(lookupFailed: boolean): {
        maven: PackageFile[];
      } {
        return {
          maven: [
            partial<PackageFile>({
              packageFile: 'pom.xml',
              deps: [{ depName: 'failed', lookupFailed }, { depName: 'fine' }],
            }),
          ],
        };
      }

      it('flags only the group branches', async () => {
        flattenUpdates.mockResolvedValueOnce(groupUpdates);

        const res = await branchifyUpgrades(config, getPackageFiles(true));

        expect(
          res.branches.map((b) => [b.branchName, b.skippedForLookupFailure]),
        ).toEqual([
          ['renovate/my-group', true],
          ['renovate/bar', undefined],
        ]);
      });

      it('flags nothing without a failed lookup', async () => {
        flattenUpdates.mockResolvedValueOnce(groupUpdates);

        const res = await branchifyUpgrades(config, getPackageFiles(false));

        expect(res.branches.map((b) => b.skippedForLookupFailure)).toEqual([
          undefined,
          undefined,
        ]);
      });
    });

    it('no fetch changelogs', async () => {
      config.fetchChangeLogs = 'off';
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            excludeCommitPaths: [],
            depName: 'foo',
            branchName: 'foo',
            prTitle: 'some-title',
            version: '1.1.0',
            groupName: 'My Group',
            group: { branchName: 'renovate/{{groupSlug}}' },
          },
          {
            excludeCommitPaths: [],
            depName: 'foo',
            branchName: 'foo',
            prTitle: 'some-title',
            version: '2.0.0',
          },
          {
            excludeCommitPaths: [],
            depName: 'bar',
            branchName: 'bar-{{version}}',
            prTitle: 'some-title',
            version: '1.1.0',
            groupName: 'My Group',
            group: { branchName: 'renovate/my-group' },
          },
        ]),
      );
      const res = await branchifyUpgrades(config, {});
      expect(embedChangelogs).not.toHaveBeenCalled();
      expect(Object.keys(res.branches)).toHaveLength(2);
    });
  });
});
