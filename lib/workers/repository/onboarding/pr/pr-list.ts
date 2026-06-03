import type { RenovateConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { emojify } from '../../../../util/emoji.ts';
import type { BranchConfig } from '../../../types.ts';

const TYPE_ORDER = ['major', 'minor', 'patch', 'pin', 'digest', 'lockFileMaintenance'];

function getExpectedPrTable(branches: BranchConfig[]): string {
  const counts = new Map<string, Map<string, number>>();
  for (const branch of branches) {
    for (const upgrade of branch.upgrades) {
      const manager = upgrade.manager ?? 'unknown';
      const type = upgrade.updateType ?? 'other';
      if (!counts.has(manager)) {
        counts.set(manager, new Map());
      }
      const m = counts.get(manager)!;
      m.set(type, (m.get(type) ?? 0) + 1);
    }
  }

  const allTypes = new Set(
    [...counts.values()].flatMap((m) => [...m.keys()]),
  );
  const columns = [
    ...TYPE_ORDER.filter((t) => allTypes.has(t)),
    ...[...allTypes].filter((t) => !TYPE_ORDER.includes(t)).sort(),
  ];

  const header = `| Manager | ${columns.join(' | ')} |`;
  const separator = `|---------|${columns.map(() => '------:').join('|')}|`;
  const rows = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([manager, m]) => {
      const cells = columns.map((t) => String(m.get(t) ?? 0));
      return `| ${manager} | ${cells.join(' | ')} |`;
    });

  return [header, separator, ...rows].join('\n');
}

export function getExpectedPrList(
  config: RenovateConfig,
  branches: BranchConfig[],
): string {
  logger.debug('getExpectedPrList()');
  logger.trace({ config });
  let prDesc = `\n### What to Expect\n\n`;
  if (!branches.length) {
    return `${prDesc}It looks like your repository dependencies are already up-to-date and no Pull Requests will be necessary right away.\n`;
  }
  prDesc += `With your current configuration, Renovate will create ${branches.length} Pull Request`;
  prDesc += branches.length > 1 ? `s:\n\n` : `:\n\n`;
  prDesc += getExpectedPrTable(branches);
  prDesc += '\n\n';
  // TODO: type (#22198)
  const prHourlyLimit = config.prHourlyLimit!;
  const commitHourlyLimit = config.commitHourlyLimit!;
  if (
    commitHourlyLimit > 0 &&
    commitHourlyLimit < 5 &&
    commitHourlyLimit < branches.length
  ) {
    prDesc += emojify(
      `\n\n:children_crossing: Branch creation and rebasing will be limited to maximum ${commitHourlyLimit} per hour, so it doesn't swamp any CI resources or overwhelm the project. See docs for \`commitHourlyLimit\` for details.\n\n`,
    );
  } else if (
    prHourlyLimit > 0 &&
    prHourlyLimit < 5 &&
    prHourlyLimit < branches.length
  ) {
    prDesc += emojify(
      `\n\n:children_crossing: PR creation will be limited to maximum ${prHourlyLimit} per hour, so it doesn't swamp any CI resources or overwhelm the project. See [docs for \`prHourlyLimit\`](https://docs.renovatebot.com/configuration-options/#prhourlylimit) for details.\n\n`,
    );
  }
  return prDesc;
}
