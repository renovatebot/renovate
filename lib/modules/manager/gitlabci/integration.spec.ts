import { codeBlock } from 'common-tags';
import { fakeSha, partial } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { Result } from '../../../util/result.ts';
import * as lookup from '../../../workers/repository/process/lookup/index.ts';
import type { LookupUpdateConfig } from '../../../workers/repository/process/lookup/types.ts';
import { doAutoReplace } from '../../../workers/repository/update/branch/auto-replace.ts';
import type { BranchUpgradeConfig } from '../../../workers/types.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import type { LookupUpdate, PackageDependency } from '../types.ts';
import { extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const sha100 = fakeSha('component-1.0.0');
const sha110 = fakeSha('component-1.1.0');
const sha123 = fakeSha('component-1.2.3');
const shaMainOld = fakeSha('component-main-old');
const shaMainNew = fakeSha('component-main-new');

describe('modules/manager/gitlabci/integration', () => {
  const getGitlabTags = vi.spyOn(GitlabTagsDatasource.prototype, 'getReleases');
  const getGitlabDigest = vi.spyOn(GitlabTagsDatasource.prototype, 'getDigest');

  const registryAliases = {
    $CI_SERVER_FQDN: 'gitlab.example.com',
  };

  let baseConfig: LookupUpdateConfig;

  beforeEach(() => {
    // TODO: fix types #22198
    baseConfig = partial<LookupUpdateConfig>(getConfig() as never);
    baseConfig.manager = 'gitlabci';
    baseConfig.registryAliases = registryAliases;
  });

  function makeConfig(
    dep: PackageDependency,
    overrides: Partial<LookupUpdateConfig> = {},
  ): LookupUpdateConfig {
    return {
      ...baseConfig,
      ...dep,
      ...overrides,
      currentValue: dep.currentValue ?? undefined,
      packageName: dep.packageName ?? dep.depName!,
    };
  }

  function makeUpgrade(
    dep: PackageDependency,
    depIndex: number,
    update: LookupUpdate,
  ): BranchUpgradeConfig {
    return partial<BranchUpgradeConfig>({
      manager: 'gitlabci',
      packageFile: '.gitlab-ci.yml',
      registryAliases,
      depIndex,
      depName: dep.depName,
      currentValue: dep.currentValue ?? undefined,
      currentDigest: dep.currentDigest,
      replaceString: dep.replaceString,
      autoReplaceStringTemplate: dep.autoReplaceStringTemplate,
      newValue: update.newValue,
      newDigest: update.newDigest ?? undefined,
      isPinDigest: update.isPinDigest,
    });
  }

  it('pins a CI/CD component using registryAliases to a commit SHA', async () => {
    const content = codeBlock`
      include:
        - component: "$CI_SERVER_FQDN/my-org/my-project/my-component@1.0.0"
          inputs:
            stage: test
    `;
    const extracted = extractPackageFile(content, '.gitlab-ci.yml', {
      registryAliases,
    });
    const dep = extracted!.deps[0];
    getGitlabTags.mockResolvedValueOnce({
      releases: [{ version: '1.0.0', newDigest: sha100 }],
    });

    const { updates } = await Result.wrap(
      lookup.lookupUpdates(makeConfig(dep, { pinDigests: true })),
    ).unwrapOrThrow();

    expect(updates).toEqual([
      {
        isPinDigest: true,
        newDigest: sha100,
        newValue: '1.0.0',
        updateType: 'pinDigest',
      },
    ]);

    const updated = await doAutoReplace(
      makeUpgrade(dep, 0, updates[0]),
      content,
      false,
    );

    expect(updated).toBe(codeBlock`
      include:
        - component: "$CI_SERVER_FQDN/my-org/my-project/my-component@${sha100}" # 1.0.0
          inputs:
            stage: test
    `);
  });

  it('updates both commit SHA and version comment for a pinned component', async () => {
    const content = codeBlock`
      include:
        - component: $CI_SERVER_FQDN/my-org/my-project/my-component@${sha100} # 1.0.0
    `;
    const extracted = extractPackageFile(content, '.gitlab-ci.yml', {
      registryAliases,
    });
    const dep = extracted!.deps[0];
    getGitlabTags.mockResolvedValueOnce({
      releases: [
        { version: '1.0.0', newDigest: sha100 },
        { version: '1.1.0', newDigest: sha110 },
      ],
    });

    const { updates } = await Result.wrap(
      lookup.lookupUpdates(makeConfig(dep)),
    ).unwrapOrThrow();

    expect(updates).toEqual([
      expect.objectContaining({
        newDigest: sha110,
        newValue: '1.1.0',
        updateType: 'minor',
      }),
    ]);

    const updated = await doAutoReplace(
      makeUpgrade(dep, 0, updates[0]),
      content,
      false,
    );

    expect(updated).toBe(codeBlock`
      include:
        - component: $CI_SERVER_FQDN/my-org/my-project/my-component@${sha110} # 1.1.0
    `);
  });

  it('updates commit SHA for a branch-pinned component', async () => {
    const content = codeBlock`
      include:
        - component: gitlab.example.com/my-org/my-project/my-component@${shaMainOld} # main
    `;
    const extracted = extractPackageFile(content, '.gitlab-ci.yml', {});
    const dep = extracted!.deps[0];
    getGitlabDigest.mockResolvedValueOnce(shaMainNew);

    const { updates } = await Result.wrap(
      lookup.lookupUpdates(makeConfig(dep)),
    ).unwrapOrThrow();

    expect(updates).toEqual([
      {
        newDigest: shaMainNew,
        newValue: 'main',
        updateType: 'digest',
      },
    ]);

    const updated = await doAutoReplace(
      makeUpgrade(dep, 0, updates[0]),
      content,
      false,
    );

    expect(updated).toBe(codeBlock`
      include:
        - component: gitlab.example.com/my-org/my-project/my-component@${shaMainNew} # main
    `);
  });

  it('pins ~latest component to a concrete semver version and commit SHA with rangeStrategy=pin', async () => {
    const content = codeBlock`
      include:
        - component: $CI_SERVER_FQDN/my-org/my-project/my-component@~latest
    `;
    const extracted = extractPackageFile(content, '.gitlab-ci.yml', {
      registryAliases,
    });
    const dep = extracted!.deps[0];
    getGitlabTags.mockResolvedValueOnce({
      releases: [
        { version: '1.0.0', newDigest: sha100 },
        { version: '1.2.3', newDigest: sha123 },
      ],
    });

    const { updates } = await Result.wrap(
      lookup.lookupUpdates(
        makeConfig(dep, { pinDigests: true, rangeStrategy: 'pin' }),
      ),
    ).unwrapOrThrow();

    expect(updates).toEqual([
      expect.objectContaining({
        isPin: true,
        newDigest: sha123,
        newValue: '1.2.3',
        updateType: 'pin',
      }),
    ]);

    const updated = await doAutoReplace(
      makeUpgrade(dep, 0, updates[0]),
      content,
      false,
    );

    expect(updated).toBe(codeBlock`
      include:
        - component: $CI_SERVER_FQDN/my-org/my-project/my-component@${sha123} # 1.2.3
    `);
  });
});
