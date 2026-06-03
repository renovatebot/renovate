import type { RenovateConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { emojify } from '../../../../util/emoji.ts';
import type { BranchConfig } from '../../../types.ts';

const TYPE_ORDER = ['major', 'minor', 'patch', 'pin', 'digest', 'lockFileMaintenance'];

interface UpgradeCounts {
  byType: Map<string, number>;
  security: number;
}

function buildCounts<K>(
  branches: BranchConfig[],
  keyFn: (upgrade: BranchConfig['upgrades'][number]) => K,
): Map<K, UpgradeCounts> {
  const counts = new Map<K, UpgradeCounts>();
  for (const branch of branches) {
    for (const upgrade of branch.upgrades) {
      const key = keyFn(upgrade);
      if (!counts.has(key)) {
        counts.set(key, { byType: new Map(), security: 0 });
      }
      const entry = counts.get(key)!;
      const type = upgrade.updateType ?? 'other';
      entry.byType.set(type, (entry.byType.get(type) ?? 0) + 1);
      if (upgrade.isVulnerabilityAlert) {
        entry.security += 1;
      }
    }
  }
  return counts;
}

function buildTable<K>(
  counts: Map<K, UpgradeCounts>,
  labelHeader: string,
  labelFn: (key: K) => string,
): string {
  const allTypes = new Set(
    [...counts.values()].flatMap(({ byType }) => [...byType.keys()]),
  );
  const hasSecurityColumn = [...counts.values()].some((e) => e.security > 0);
  const columns = [
    ...TYPE_ORDER.filter((t) => allTypes.has(t)),
    ...[...allTypes].filter((t) => !TYPE_ORDER.includes(t)).sort(),
    ...(hasSecurityColumn ? ['security'] : []),
  ];

  const header = `| ${labelHeader} | ${columns.join(' | ')} |`;
  const separator = `|---------|${columns.map(() => '------:').join('|')}|`;
  const rows = [...counts.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([key, { byType, security }]) => {
      const cells = columns.map((t) =>
        t === 'security' ? String(security) : String(byType.get(t) ?? 0),
      );
      return `| ${labelFn(key)} | ${cells.join(' | ')} |`;
    });

  return [header, separator, ...rows].join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getExpectedPrTable(branches: BranchConfig[]): string {
  const counts = buildCounts(branches, (u) => u.manager ?? 'unknown');
  return buildTable(counts, 'Manager', (k) => k);
}

function getPrSummary(branches: BranchConfig[]): string {
  const typeTotals = new Map<string, number>();
  let securityTotal = 0;
  for (const branch of branches) {
    for (const upgrade of branch.upgrades) {
      const type = upgrade.updateType ?? 'other';
      typeTotals.set(type, (typeTotals.get(type) ?? 0) + 1);
      if (upgrade.isVulnerabilityAlert) {
        securityTotal += 1;
      }
    }
  }
  const parts: string[] = [];
  if (securityTotal > 0) {
    parts.push(`${securityTotal} security`);
  }
  for (const type of TYPE_ORDER) {
    const n = typeTotals.get(type);
    if (n) {
      parts.push(`${n} ${type}`);
    }
  }
  return parts.length ? ` (${parts.join(', ')})` : '';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getExpectedPrTableByPackageFile(branches: BranchConfig[]): string {
  const counts = buildCounts(
    branches,
    (u) => `${u.packageFile ?? '?'} (${u.manager ?? 'unknown'})`,
  );
  return buildTable(counts, 'Package file', (k) => `\`${k}\``);
}

function getExpectedPrBreakdownByDirectory(branches: BranchConfig[]): string {
  const byFileManager = new Map<string, Map<string, UpgradeCounts>>();
  for (const branch of branches) {
    for (const upgrade of branch.upgrades) {
      const pf = upgrade.packageFile ?? '?';
      const manager = upgrade.manager ?? 'unknown';
      if (!byFileManager.has(pf)) {
        byFileManager.set(pf, new Map());
      }
      const fileMap = byFileManager.get(pf)!;
      if (!fileMap.has(manager)) {
        fileMap.set(manager, { byType: new Map(), security: 0 });
      }
      const entry = fileMap.get(manager)!;
      const type = upgrade.updateType ?? 'other';
      entry.byType.set(type, (entry.byType.get(type) ?? 0) + 1);
      if (upgrade.isVulnerabilityAlert) {
        entry.security += 1;
      }
    }
  }

  const allTypes = new Set(
    [...byFileManager.values()].flatMap((m) =>
      [...m.values()].flatMap(({ byType }) => [...byType.keys()]),
    ),
  );
  const hasSecurityColumn = [...byFileManager.values()].some((m) =>
    [...m.values()].some((e) => e.security > 0),
  );
  const columns = [
    ...TYPE_ORDER.filter((t) => allTypes.has(t)),
    ...[...allTypes].filter((t) => !TYPE_ORDER.includes(t)).sort(),
    ...(hasSecurityColumn ? ['security'] : []),
  ];

  const header = `| Package file | Manager | ${columns.join(' | ')} |`;
  const separator = `|--------------|---------|${columns.map(() => '------:').join('|')}|`;
  const rows: string[] = [];
  for (const [pf, fileMap] of [...byFileManager.entries()].sort()) {
    const showFile = fileMap.size > 1;
    let firstRow = true;
    for (const [manager, { byType, security }] of [...fileMap.entries()].sort()) {
      const fileLabel = firstRow || !showFile ? `\`${pf}\`` : '';
      const cells = columns.map((t) =>
        t === 'security' ? String(security) : String(byType.get(t) ?? 0),
      );
      rows.push(`| ${fileLabel} | ${manager} | ${cells.join(' | ')} |`);
      firstRow = false;
    }
  }

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
  const prWord = branches.length > 1 ? 'Pull Requests' : 'Pull Request';
  prDesc += `With your current configuration, Renovate will create ${branches.length} ${prWord}${getPrSummary(branches)}:\n\n`;
  // prDesc += getExpectedPrTable(branches);
  // prDesc += getExpectedPrTableByPackageFile(branches);
  prDesc += getExpectedPrBreakdownByDirectory(branches);
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
