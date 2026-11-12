// Verifies group:nodeJs end-to-end through the real flatten pipeline (no
// mocking). The branch merging itself is emergent: same depName + major
// resolves to the same default branchTopic; the preset only unifies
// commitMessageTopic.
import type { RenovateConfig } from '~test/util.ts';
import type {
  PackageDependency,
  PackageFile,
} from '../../../modules/manager/types.ts';
import { branchifyUpgrades } from '../../../workers/repository/updates/branchify.ts';
import { getConfig } from '../../defaults.ts';
import { resolveConfigPresets } from '../index.ts';

async function getConfigWithPresets(
  extendsPresets: string[] = [],
): Promise<RenovateConfig> {
  const config = getConfig();
  config.errors = [];
  config.warnings = [];
  config.repoIsOnboarded = true;
  config.semanticCommits = 'disabled';
  config.extends = extendsPresets;
  const { config: resolved } = await resolveConfigPresets(config);
  return resolved;
}

function dep({
  datasource,
  packageName = 'node',
  currentValue,
  newValue,
  major,
  newVersion = newValue,
  updateType = 'patch',
  commitMessageTopic,
}: {
  datasource: string;
  packageName?: string;
  currentValue: string;
  newValue: string;
  major: number;
  newVersion?: string;
  updateType?: 'patch' | 'minor';
  commitMessageTopic?: string;
}): PackageDependency {
  const result: PackageDependency = {
    depName: 'node',
    packageName,
    datasource,
    currentValue,
    updates: [{ newValue, newVersion, newMajor: major, updateType }],
  };
  if (commitMessageTopic) {
    // only set when provided: an explicit undefined would override the
    // inherited default when configs are merged
    result.commitMessageTopic = commitMessageTopic;
  }
  return result;
}

describe('config/presets/internal/group.node', () => {
  it('groups .nvmrc + Dockerfile FROM node + actions/setup-node into one PR', async () => {
    const config = await getConfigWithPresets(['group:nodeJs']);

    // managers in real extraction order (api.ts); lookup extracts
    // newVersion '20.18.2' from the tag '20.18.2-alpine'
    const packageFiles: Record<string, PackageFile[]> = {
      dockerfile: [
        {
          packageFile: 'Dockerfile',
          deps: [
            dep({
              datasource: 'docker',
              currentValue: '20.18.1-alpine',
              newValue: '20.18.2-alpine',
              major: 20,
              newVersion: '20.18.2',
            }),
          ],
        },
      ],
      'github-actions': [
        {
          packageFile: '.github/workflows/ci.yml',
          deps: [
            // actions/setup-node known action
            dep({
              datasource: 'github-releases',
              packageName: 'actions/node-versions',
              currentValue: '20.18.1',
              newValue: '20.18.2',
              major: 20,
              commitMessageTopic: '{{{depName}}} action',
            }),
          ],
        },
      ],
      nvm: [
        {
          packageFile: '.nvmrc',
          deps: [
            dep({
              datasource: 'node-version',
              currentValue: '20.18.1',
              newValue: '20.18.2',
              major: 20,
            }),
          ],
        },
      ],
    };

    const { branches } = await branchifyUpgrades(config, packageFiles);

    expect(branches).toHaveLength(1);
    expect(branches[0].branchName).toBe('renovate/node-20.x');
    // branchify prepends, so the order is reversed extraction order
    expect(branches[0].upgrades.map((u) => u.manager)).toEqual([
      'nvm',
      'github-actions',
      'dockerfile',
    ]);
    // the preset matches docker + node-version, not github-releases
    expect(
      branches[0].upgrades.map((u) => [u.manager, u.commitMessageTopic]),
    ).toEqual([
      ['nvm', 'Node.js'],
      ['github-actions', '{{{depName}}} action'],
      ['dockerfile', 'Node.js'],
    ]);
    // the PR title comes from the first upgrade after the stable sort
    expect(branches[0].prTitle).toBe('Update Node.js to v20.18.2');
  });

  it('keeps different major versions in separate PRs', async () => {
    const config = await getConfigWithPresets(['group:nodeJs']);

    const packageFiles: Record<string, PackageFile[]> = {
      dockerfile: [
        {
          packageFile: 'Dockerfile',
          deps: [
            dep({
              datasource: 'docker',
              currentValue: '22.11.0',
              newValue: '22.12.0',
              major: 22,
              updateType: 'minor',
            }),
          ],
        },
      ],
      nvm: [
        {
          packageFile: '.nvmrc',
          deps: [
            dep({
              datasource: 'node-version',
              currentValue: '20.18.1',
              newValue: '20.18.2',
              major: 20,
            }),
          ],
        },
      ],
    };

    const { branches } = await branchifyUpgrades(config, packageFiles);

    expect(branches).toHaveLength(2);
    // branches are ordered by first appearance in the flattened updates
    expect(branches.map((b) => b.branchName)).toEqual([
      'renovate/node-22.x',
      'renovate/node-20.x',
    ]);
  });

  it('groups updates into one PR even without the preset, which only unifies the commit message topic', async () => {
    // the branch merge does not depend on group:nodeJs: same depName and
    // major produce the same default branchTopic. The preset deliberately
    // has no groupName (added in #34244, reverted in #34379).
    const config = await getConfigWithPresets();

    const packageFiles: Record<string, PackageFile[]> = {
      dockerfile: [
        {
          packageFile: 'Dockerfile',
          deps: [
            dep({
              datasource: 'docker',
              currentValue: '20.18.1-alpine',
              newValue: '20.18.2-alpine',
              major: 20,
              newVersion: '20.18.2',
            }),
          ],
        },
      ],
      nvm: [
        {
          packageFile: '.nvmrc',
          deps: [
            dep({
              datasource: 'node-version',
              currentValue: '20.18.1',
              newValue: '20.18.2',
              major: 20,
            }),
          ],
        },
      ],
    };

    const { branches } = await branchifyUpgrades(config, packageFiles);

    expect(branches).toHaveLength(1);
    expect(branches[0].branchName).toBe('renovate/node-20.x');
    // datasource defaults, not the preset's 'Node.js' topic
    expect(
      branches[0].upgrades.map((u) => [u.manager, u.commitMessageTopic]),
    ).toEqual([
      ['nvm', 'dependency {{depName}}'],
      ['dockerfile', '{{{depName}}} Docker tag'],
    ]);
  });
});
