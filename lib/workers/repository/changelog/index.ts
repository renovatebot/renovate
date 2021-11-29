import pMap from 'p-map';
import { getChangeLogJSON } from '../../pr/changelog';
import type { BranchUpgradeConfig } from '../../types';

// istanbul ignore next
async function embedChangelog(upgrade: BranchUpgradeConfig): Promise<void> {
  upgrade.logJSON = await getChangeLogJSON(upgrade);
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
