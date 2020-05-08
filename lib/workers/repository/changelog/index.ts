import pMap from 'p-map';
import { getChangeLogJSON } from '../../pr/changelog';

// istanbul ignore next
async function embedChangelog(upgrade): Promise<void> {
  upgrade.logJSON = await getChangeLogJSON(upgrade); // eslint-disable-line
}

// istanbul ignore next
export async function embedChangelogs(branches): Promise<void> {
  const upgrades = [];
  for (const branch of branches) {
    for (const upgrade of branch.upgrades) {
      upgrades.push(upgrade);
    }
  }
  await pMap(upgrades, embedChangelog, { concurrency: 10 });
}
