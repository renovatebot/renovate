import type { FetchChangeLogsOptions } from '../../../config/types.ts';
import * as p from '../../../util/promises.ts';
import type { BranchUpgradeConfig } from '../../types.ts';
import { getChangeLogJSON } from '../update/pr/changelog/index.ts';
import type { EmbedChangelogsOptions } from './types.ts';

export async function embedChangelog(
  upgrade: BranchUpgradeConfig,
): Promise<void> {
  // getChangeLogJSON returns null on error, so don't try again
  if (upgrade.logJSON !== undefined) {
    return;
  }

  if (upgrade.changelogContent === undefined) {
    upgrade.logJSON = await getChangeLogJSON(upgrade);
  } else {
    upgrade.logJSON = {
      hasReleaseNotes: true,
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

// Merges the top-level fetchChangeLogs value with the upgrade's fetchChangeLogs value (prioritizing the latter, if defined).
function resolveFetchChangeLogs(
  fetchChangeLogs?: FetchChangeLogsOptions,
  upgradeFetchChangeLogs?: FetchChangeLogsOptions,
): FetchChangeLogsOptions {
  // Default to 'pr' if top-level fetchChangeLogs is undefined.
  let fetchChangeLogsResolved: FetchChangeLogsOptions = fetchChangeLogs ?? 'pr';
  if (upgradeFetchChangeLogs) {
    // Override using the upgrade's fetchChangeLogs value.
    fetchChangeLogsResolved = upgradeFetchChangeLogs;
  }
  return fetchChangeLogsResolved;
}

export async function embedChangelogs({
  upgrades,
  stage,
  fetchChangeLogs,
}: EmbedChangelogsOptions): Promise<void> {
  // Filter down to branch upgrades that match the stage and fetchChangeLogs configuration.
  const filteredUpgrades = upgrades.filter(
    (upgrade) =>
      resolveFetchChangeLogs(fetchChangeLogs, upgrade.fetchChangeLogs) ===
      stage,
  );
  await p.map(filteredUpgrades, embedChangelog, { concurrency: 10 });
}
