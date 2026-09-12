import { isNonEmptyArray, isNonEmptyString } from '@sindresorhus/is';
import * as allVersioning from '../../../modules/versioning/index.ts';
import * as p from '../../../util/promises.ts';
import type { BranchUpgradeConfig } from '../../types.ts';
import { getChangeLogJSON } from '../update/pr/changelog/index.ts';
import { filterInRangeReleases } from '../update/pr/changelog/releases.ts';
import type { ChangeLogResult } from '../update/pr/changelog/types.ts';
import type { EmbedChangelogsOptions } from './types.ts';

function getReleaseChangelog(
  upgrade: BranchUpgradeConfig,
): ChangeLogResult | null {
  if (
    !isNonEmptyArray(upgrade.changelogReleases) ||
    !isNonEmptyString(upgrade.versioning) ||
    !isNonEmptyString(upgrade.currentVersion) ||
    !isNonEmptyString(upgrade.newVersion)
  ) {
    return null;
  }

  const versioning = allVersioning.get(upgrade.versioning);
  const releases = filterInRangeReleases(upgrade, upgrade.changelogReleases)
    .filter((release) =>
      versioning.isGreaterThan(release.version, upgrade.currentVersion!),
    )
    .sort((a, b) => versioning.sortVersions(b.version, a.version))
    .filter(
      (release, index, sorted) =>
        index === 0 ||
        !versioning.equals(release.version, sorted[index - 1].version),
    );

  if (!isNonEmptyArray(releases)) {
    return null;
  }

  return {
    hasReleaseNotes: true,
    perDependencyNotes: true,
    project: {
      packageName: upgrade.packageName,
      depName: upgrade.depName,
      type: undefined!,
      apiBaseUrl: undefined!,
      baseUrl: undefined!,
      repository: upgrade.repository!,
      sourceUrl: upgrade.sourceUrl!,
      sourceDirectory: upgrade.sourceDirectory,
    },
    versions: releases.map((release) => ({
      changes: [],
      compare: {},
      date: release.releaseTimestamp!,
      releaseNotes: {
        body: release.changelogContent,
        notesSourceUrl: undefined!,
        url: release.changelogUrl!,
      },
      gitRef: release.gitRef!,
      version: release.version,
    })),
  };
}

export async function embedChangelog(
  upgrade: BranchUpgradeConfig,
): Promise<void> {
  // getChangeLogJSON returns null on error, so don't try again
  if (upgrade.logJSON !== undefined) {
    return;
  }

  const releaseChangelog = getReleaseChangelog(upgrade);
  if (releaseChangelog) {
    upgrade.logJSON = releaseChangelog;
    return;
  }

  if (upgrade.changelogContent === undefined) {
    upgrade.logJSON = await getChangeLogJSON(upgrade);
  } else {
    upgrade.logJSON = {
      hasReleaseNotes: true,
      perDependencyNotes: true,
      project: {
        packageName: upgrade.packageName,
        depName: upgrade.depName,
        type: undefined!,
        apiBaseUrl: undefined!,
        baseUrl: undefined!,
        repository: upgrade.repository!,
        sourceUrl: upgrade.sourceUrl!,
        sourceDirectory: upgrade.sourceDirectory,
      },
      versions: [
        {
          changes: undefined!,
          compare: undefined!,
          date: undefined!,
          releaseNotes: {
            body: upgrade.changelogContent,
            notesSourceUrl: undefined!,
            url: upgrade.changelogUrl!,
          },
          gitRef: undefined!,
          version: upgrade.newVersion!,
        },
      ],
    };
  }
}

export async function embedChangelogs({
  upgrades,
  stage,
}: EmbedChangelogsOptions): Promise<void> {
  // Only process upgrades whose fetchChangeLogs value match the stage.
  const filteredUpgrades = upgrades.filter(
    (upgrade) => upgrade.fetchChangeLogs === stage,
  );
  await p.map(filteredUpgrades, embedChangelog, { concurrency: 10 });
}
