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

const shaV200 = fakeSha('v2.0.0');
const shaV200Moved = fakeSha('v2.0.0-moved');
const shaV210 = fakeSha('v2.1.0');
const shaMainOld = fakeSha('main-old');
const shaMainNew = fakeSha('main-new');

describe('modules/manager/gitlabci-include/integration', () => {
  const getGitlabTags = vi.spyOn(GitlabTagsDatasource.prototype, 'getReleases');
  const getGitlabDigest = vi.spyOn(GitlabTagsDatasource.prototype, 'getDigest');

  let baseConfig: LookupUpdateConfig;

  beforeEach(() => {
    // TODO: fix types #22198
    baseConfig = partial<LookupUpdateConfig>(getConfig() as never);
    baseConfig.manager = 'gitlabci-include';
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
      manager: 'gitlabci-include',
      packageFile: '.gitlab-ci.yml',
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

  it('pins an unpinned tag to a commit SHA and preserves an existing comment', async () => {
    const content = codeBlock`
      include:
        - project: "my-org/dependency-ci-templates"
          ref: "v2.0.0" # Unpinned tag
          file: "scan.yml"
    `;
    const extracted = extractPackageFile(content, '.gitlab-ci.yml');
    const dep = extracted!.deps[0];
    getGitlabTags.mockResolvedValueOnce({
      releases: [{ version: 'v2.0.0', newDigest: shaV200 }],
    });

    const { updates } = await Result.wrap(
      lookup.lookupUpdates(makeConfig(dep, { pinDigests: true })),
    ).unwrapOrThrow();

    expect(updates).toEqual([
      {
        isPinDigest: true,
        newDigest: shaV200,
        newValue: 'v2.0.0',
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
        - project: "my-org/dependency-ci-templates"
          ref: "${shaV200}" # v2.0.0 # Unpinned tag
          file: "scan.yml"
    `);
  });

  it('pins an unpinned branch ref to a commit SHA', async () => {
    const content = codeBlock`
      include:
        - project: my-org/ci-templates
          ref: main
          file: scan.yml
    `;
    const extracted = extractPackageFile(content, '.gitlab-ci.yml');
    const dep = extracted!.deps[0];
    getGitlabDigest.mockResolvedValueOnce(shaMainNew);

    const { updates } = await Result.wrap(
      lookup.lookupUpdates(makeConfig(dep, { pinDigests: true })),
    ).unwrapOrThrow();

    expect(updates).toEqual([
      {
        isPinDigest: true,
        newDigest: shaMainNew,
        newValue: 'main',
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
        - project: my-org/ci-templates
          ref: ${shaMainNew} # main
          file: scan.yml
    `);
  });

  it('updates both digest and version comment for a pinned tag', async () => {
    const content = codeBlock`
      include:
        - project: "my-org/dependency-ci-templates"
          ref: "${shaV200}"  # v2.0.0
          file: "scan.yml"
    `;
    const extracted = extractPackageFile(content, '.gitlab-ci.yml');
    const dep = extracted!.deps[0];
    getGitlabTags.mockResolvedValueOnce({
      releases: [
        { version: 'v2.0.0', newDigest: shaV200Moved },
        { version: 'v2.1.0', newDigest: shaV210 },
      ],
    });

    const { updates } = await Result.wrap(
      lookup.lookupUpdates(makeConfig(dep)),
    ).unwrapOrThrow();

    expect(updates).toEqual([
      expect.objectContaining({
        newDigest: shaV210,
        newValue: 'v2.1.0',
        updateType: 'minor',
      }),
      {
        newDigest: shaV200Moved,
        newValue: 'v2.0.0',
        updateType: 'digest',
      },
    ]);

    const minorUpdated = await doAutoReplace(
      makeUpgrade(dep, 0, updates[0]),
      content,
      false,
    );
    const digestUpdated = await doAutoReplace(
      makeUpgrade(dep, 0, updates[1]),
      content,
      false,
    );

    expect(minorUpdated).toBe(codeBlock`
      include:
        - project: "my-org/dependency-ci-templates"
          ref: "${shaV210}"  # v2.1.0
          file: "scan.yml"
    `);
    expect(digestUpdated).toBe(codeBlock`
      include:
        - project: "my-org/dependency-ci-templates"
          ref: "${shaV200Moved}"  # v2.0.0
          file: "scan.yml"
    `);
  });

  it('updates the digest for a pinned branch ref when the branch moves', async () => {
    const content = codeBlock`
      include:
        - project: my-org/ci-templates
          ref: "${shaMainOld}" # main # keep note
          file: scan.yml
    `;
    const extracted = extractPackageFile(content, '.gitlab-ci.yml');
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
        - project: my-org/ci-templates
          ref: "${shaMainNew}" # main # keep note
          file: scan.yml
    `);
  });

  it('updates only the targeted include when multiple includes share the same ref', async () => {
    const content = codeBlock`
      include:
        - project: my-org/first-templates
          ref: "v2.0.0"
          file: a.yml
        - project: my-org/second-templates
          ref: "v2.0.0"
          file: b.yml
    `;
    const extracted = extractPackageFile(content, '.gitlab-ci.yml');
    const secondDep = extracted!.deps[1];

    const updated = await doAutoReplace(
      makeUpgrade(secondDep, 1, {
        isPinDigest: true,
        newDigest: shaV200,
        newValue: 'v2.0.0',
        updateType: 'pinDigest',
      }),
      content,
      false,
    );

    expect(updated).toBe(codeBlock`
      include:
        - project: my-org/first-templates
          ref: "v2.0.0"
          file: a.yml
        - project: my-org/second-templates
          ref: "${shaV200}" # v2.0.0
          file: b.yml
    `);
  });
});
