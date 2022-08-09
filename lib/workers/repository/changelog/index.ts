import pMap from 'p-map';
import {
  containsTemplates,
  exposedConfigOptions,
} from '../../../util/template';
import type { BranchUpgradeConfig } from '../../types';
import { getChangeLogJSON } from '../update/pr/changelog';

async function embedChangelog(upgrade: BranchUpgradeConfig): Promise<void> {
  // getChangeLogJSON returns null on error, so don't try again
  if (upgrade.logJSON !== undefined) {
    return;
  }
  upgrade.logJSON = await getChangeLogJSON(upgrade);
}

export async function embedChangelogs(
  branches: BranchUpgradeConfig[]
): Promise<void> {
  await pMap(branches, embedChangelog, { concurrency: 10 });
}

export function needsChangelogs(upgrade: BranchUpgradeConfig): boolean {
  for (const field of exposedConfigOptions) {
    // fields set by `getChangeLogJSON`
    if (containsTemplates(upgrade[field], ['logJSON', 'releases'])) {
      return true;
    }
  }
  return false;
}
