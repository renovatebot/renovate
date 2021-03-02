import pMap from 'p-map';
import { getChangeLogJSON } from '../../pr/changelog';
import type { BranchUpgradeConfig } from '../../types';

/* c8 ignore start */

/* c8 ignore next */
async function embedChangelog(upgrade): Promise<void> {
  upgrade.logJSON = await getChangeLogJSON(upgrade); // eslint-disable-line
}

/* c8 ignore next */
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
