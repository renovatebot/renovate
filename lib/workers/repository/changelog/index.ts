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
  upgrade.logJSON = await getChangeLogJSON(upgrade);
}

export async function embedChangelogs(
  branches: BranchUpgradeConfig[],
): Promise<void> {
  await p.map(branches, embedChangelog, { concurrency: 10 });
}
