import * as p from '../../../util/promises';
import type { BranchUpgradeConfig } from '../../types';
import { getChangeLogJSON } from '../update/pr/changelog';

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

export async function embedChangelogs(
  branches: BranchUpgradeConfig[],
): Promise<void> {
  await p.map(branches, embedChangelog, { concurrency: 10 });
}
