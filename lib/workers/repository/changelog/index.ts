import pMap from 'p-map';
import type { BranchUpgradeConfig } from '../../types';
import { getChangeLogJSON } from '../update/pr/changelog';

// istanbul ignore next
async function embedChangelog(upgrade: BranchUpgradeConfig): Promise<void> {
  const logJSON = await getChangeLogJSON(upgrade);
  if (logJSON) {
    upgrade.logJSON = logJSON;
  }
}

// istanbul ignore next
export async function embedChangelogs(
  branchUpgrades: Record<string, BranchUpgradeConfig[]>
): Promise<void> {
  const upgrades = [];
  for (const branchName of Object.keys(branchUpgrades)) {
    for (const upgrade of branchUpgrades[branchName]) {
      upgrades.push(upgrade);
    }
  }
  await pMap(upgrades, embedChangelog, { concurrency: 10 });
}
