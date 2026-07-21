import { GlobalConfig } from '../../../../config/global.ts';
import {
  type RenovateConfig,
  type UpdateType,
  UpdateTypesOptions,
} from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { emojify } from '../../../../util/emoji.ts';
import { coerceNumber } from '../../../../util/number.ts';
import { regEx } from '../../../../util/regex.ts';
import type { BranchConfig } from '../../../types.ts';

/**
 * The different categories of dependency updates to output, when providing the summary view.
 *
 * - `security`: if the upgrade is driven by a vulnerability alert
 * - `${updateType}`: if it's set. I.e. `major`
 * - `lockfileUpdate` when `isLockfileUpdate` is true, without an `updateType`
 * - `other`: otherwise
 */
type SummaryCategory = UpdateType | 'security' | 'other';

/** Priority order when rendering the `SummaryCategory`s in the summary view.
 *
 * NOTE that this is not exhaustive - this is only the priority order for rendering, and other categories, such as `other` are placed after.
 */
const SUMMARY_CATEGORY_PRIORITY_ORDER: readonly SummaryCategory[] = [
  'security',
  ...UpdateTypesOptions,
  // ... anything else
];

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

  for (const branch of branches) {
    const prTitleRe = regEx(/@([a-z]+\/[a-z]+)/);
    // TODO #22198
    prDesc += `<details>\n<summary>${branch.prTitle!.replace(
      prTitleRe,
      '@&#8203;$1',
    )}</summary>\n\n`;
    if (branch.schedule?.length) {
      prDesc += `  - Schedule: ${JSON.stringify(branch.schedule)}\n`;
    }
    prDesc += `  - Branch name: \`${branch.branchName}\`\n`;
    prDesc += branch.baseBranch
      ? `  - Merge into: \`${branch.baseBranch}\`\n`
      : '';
    const seen: string[] = [];
    for (const upgrade of branch.upgrades) {
      let text = '';
      if (upgrade.updateType === 'lockFileMaintenance') {
        text += '  - Regenerate lock files to use latest dependency versions';
      } else {
        if (upgrade.updateType === 'pin') {
          text += '  - Pin ';
        } else {
          text += '  - Upgrade ';
        }
        if (upgrade.sourceUrl) {
          // TODO: types (#22198)
          text += `[${upgrade.depName!}](${upgrade.sourceUrl})`;
        } else {
          text += upgrade.depName!.replace(prTitleRe, '@&#8203;$1');
        }
        // TODO: types (#22198)
        text += upgrade.isLockfileUpdate
          ? ` to \`${upgrade.newVersion!}\``
          : ` to \`${upgrade.newDigest ?? upgrade.newValue!}\``;
        text += '\n';
      }
      if (!seen.includes(text)) {
        prDesc += text;
        seen.push(text);
      }
    }
    prDesc += '\n\n';
    prDesc += '</details>\n\n';
  }
  const prHourlyLimit = coerceNumber(config.prHourlyLimit);
  const commitHourlyLimit = coerceNumber(config.commitHourlyLimit);
  if (
    commitHourlyLimit > 0 &&
    commitHourlyLimit < 5 &&
    commitHourlyLimit < branches.length
  ) {
    prDesc += emojify(
      `\n\n:children_crossing: Branch creation and rebasing will be limited to maximum ${commitHourlyLimit} per hour, so it doesn't swamp any CI resources or overwhelm the project. See [docs for \`commitHourlyLimit\`](${GlobalConfig.get('productLinks').documentation}configuration-options/#commithourlylimit) for details.\n\n`,
    );
  } else if (
    prHourlyLimit > 0 &&
    prHourlyLimit < 5 &&
    prHourlyLimit < branches.length
  ) {
    prDesc += emojify(
      `\n\n:children_crossing: PR creation will be limited to maximum ${prHourlyLimit} per hour, so it doesn't swamp any CI resources or overwhelm the project. See [docs for \`prHourlyLimit\`](${GlobalConfig.get('productLinks').documentation}configuration-options/#prhourlylimit) for details.\n\n`,
    );
  }
  return prDesc;
}

function getBranchUpgradeTypes(branch: BranchConfig): Set<SummaryCategory> {
  if (branch.isVulnerabilityAlert) {
    return new Set(['security']);
  }
  const types = new Set<SummaryCategory>();
  for (const upgrade of branch.upgrades) {
    if (upgrade.updateType) {
      types.add(upgrade.updateType);
    } else if (upgrade.isLockfileUpdate) {
      types.add('lockfileUpdate');
    } else {
      types.add('other');
    }
  }
  return types;
}

// Sort: default branch (empty string) first, then named branches alphabetically.
function sortBaseBranches(bases: Iterable<string>): string[] {
  return [...bases].sort((a, b) => {
    if (a === b) {
      /* v8 ignore next -- base branches are unique Record keys; equal comparison cannot occur */
      return 0;
    }
    if (a === '') {
      return -1;
    }
    if (b === '') {
      return 1;
    }
    return a.localeCompare(b);
  });
}

function describeSecurityGroup(groupBranches: BranchConfig[]): string {
  const firstUpgrade = groupBranches[0].upgrades[0];
  const depName = firstUpgrade?.depName ?? groupBranches[0].prTitle ?? '';
  const updateType = firstUpgrade?.updateType ?? 'unknown';
  const packageFiles = groupBranches
    .map((b) => ({ file: b.packageFile ?? '', manager: b.manager }))
    .filter((f) => f.file);
  const uniqueManagers = new Set(packageFiles.map((f) => f.manager));

  // Vulnerability alerts can match on datasource + packageName without a specific file (e.g. GitHub vulnerability alerts),
  // so we need to handle an absent packageFile
  if (packageFiles.length === 0) {
    const branchManagers = new Set(groupBranches.map((b) => b.manager));
    if (branchManagers.size === 1) {
      return `- \`${depName}\`, (${[...branchManagers][0]}, ${updateType})\n`;
    }

    return `- \`${depName}\`, (${updateType}): ${[...branchManagers].sort().join(', ')}\n`;
  }

  if (packageFiles.length === 1) {
    const file = packageFiles[0].file;
    const [manager] = uniqueManagers;
    return `- \`${depName}\`, (${manager}, ${updateType}): \`${file}\`\n`;
  }

  if (uniqueManagers.size === 1) {
    const manager = [...uniqueManagers][0];
    const fileLines = packageFiles
      .map(({ file }) => `  - \`${file}\`\n`)
      .join('');
    return `- \`${depName}\`, (${manager}, ${updateType}):\n${fileLines}`;
  }

  const fileLines = packageFiles
    .map(({ file, manager }) => `  - \`${file}\` (${manager})\n`)
    .join('');
  return `- \`${depName}\`, (${updateType}):\n${fileLines}`;
}

interface BranchStats {
  // PR count per base branch, deduplicated by branchName.
  prCountByBase: Record<string, number>;
  // base -> manager -> type -> count, deduplicated by branchName+manager+type.
  tableStats: Record<
    string,
    Record<string, Partial<Record<SummaryCategory, number>>>
  >;
  // All upgrade types seen anywhere — drives the table columns.
  presentCategories: Set<SummaryCategory>;
  // Security branches grouped by branchName.
  securityGroups: Record<string, BranchConfig[]>;
  prCount: number;
}

function collectBranchStats(branches: BranchConfig[]): BranchStats {
  const prCountByBase: Record<string, number> = {};
  const tableStats: Record<
    string,
    Record<string, Partial<Record<SummaryCategory, number>>>
  > = {};
  const presentTypes = new Set<SummaryCategory>();
  const securityGroups: Record<string, BranchConfig[]> = {};
  const seenPrs = new Set<string>();
  const seenTableKeys = new Set<string>();

  for (const branch of branches) {
    const base = branch.baseBranch ?? '';
    const { manager, branchName } = branch;
    const branchTypes = getBranchUpgradeTypes(branch);

    for (const type of branchTypes) {
      presentTypes.add(type);
    }

    if (!seenPrs.has(branchName)) {
      seenPrs.add(branchName);
      prCountByBase[base] = (prCountByBase[base] ?? 0) + 1;
    }

    tableStats[base] ??= {};
    const baseStats = tableStats[base];
    baseStats[manager] ??= {};
    const managerStats = baseStats[manager];
    for (const type of branchTypes) {
      const key = `${branchName}:${manager}:${type}`;
      if (seenTableKeys.has(key)) {
        continue;
      }
      seenTableKeys.add(key);
      managerStats[type] ??= 0;
      managerStats[type]++;
    }

    if (branch.isVulnerabilityAlert) {
      securityGroups[branchName] ??= [];
      securityGroups[branchName].push(branch);
    }
  }

  return {
    prCountByBase,
    tableStats,
    presentCategories: presentTypes,
    securityGroups,
    prCount: seenPrs.size,
  };
}

function getCategoryColumns(
  presentTypes: Set<SummaryCategory>,
): SummaryCategory[] {
  const cols: SummaryCategory[] = SUMMARY_CATEGORY_PRIORITY_ORDER.filter((t) =>
    presentTypes.has(t),
  );
  // Append any present types not in the standard display order
  // (e.g. lockfileUpdate, bump).
  for (const t of presentTypes) {
    if (t !== 'other' && !cols.includes(t)) {
      cols.push(t);
    }
  }

  if (presentTypes.has('other')) {
    cols.push('other');
  }

  return cols;
}

function categoriesToColumnHeaders(cols: readonly string[]): string {
  /* v8 ignore next -- branches always have at least one upgrade, so cols is never empty in practice */
  if (cols.length === 0) {
    return '';
  }
  return ` | ${cols.join(' | ')}`;
}

function renderRowCounts(
  typeColumns: readonly SummaryCategory[],
  typeCounts: Partial<Record<SummaryCategory, number>>,
): string {
  return categoriesToColumnHeaders(
    typeColumns.map((t) => `${typeCounts[t] ?? 0}`),
  );
}

function sumCategoryCounts(
  rows: Partial<Record<SummaryCategory, number>>[],
  categoryColumns: readonly SummaryCategory[],
): Partial<Record<SummaryCategory, number>> {
  const sum: Partial<Record<SummaryCategory, number>> = {};
  for (const categoryCounts of rows) {
    for (const category of categoryColumns) {
      sum[category] = (sum[category] ?? 0) + (categoryCounts[category] ?? 0);
    }
  }
  return sum;
}

export function getExpectedPrListSummary(
  config: RenovateConfig,
  branches: BranchConfig[],
): string {
  logger.debug('getExpectedPrListSummary()');
  logger.trace({ config });
  let prDesc = `\n### What to Expect\n\n`;
  if (!branches.length) {
    return `${prDesc}It looks like your repository dependencies are already up-to-date and no Pull Requests will be necessary right away.\n`;
  }

  const stats = collectBranchStats(branches);
  const sortedBases = sortBaseBranches(Object.keys(stats.prCountByBase));
  const hasMultipleBaseBranches = sortedBases.length > 1;

  const prHourlyLimit = coerceNumber(config.prHourlyLimit);
  const commitHourlyLimit = coerceNumber(config.commitHourlyLimit);

  if (hasMultipleBaseBranches) {
    let total = 0;
    const parts = sortedBases.map((base) => {
      const count = stats.prCountByBase[base];
      total += count;
      const label = base ? `the \`${base}\` branch` : 'the default branch';
      return `${count} Pull Request${count > 1 ? 's' : ''} to ${label}`;
    });
    const hourlyLimitsNotice = determineHourlyLimitsNotice(
      prHourlyLimit,
      commitHourlyLimit,
      total,
    );
    prDesc += `With your current configuration, Renovate will create ${parts.join(' and ')}${hourlyLimitsNotice}:\n\n`;
  } else {
    const hourlyLimitsNotice = determineHourlyLimitsNotice(
      prHourlyLimit,
      commitHourlyLimit,
      stats.prCount,
    );
    prDesc += `With your current configuration, Renovate will create ${stats.prCount} Pull Request${stats.prCount > 1 ? 's' : ''}${hourlyLimitsNotice}:\n\n`;
  }

  const categoryColumns = getCategoryColumns(stats.presentCategories);
  if (hasMultipleBaseBranches) {
    prDesc += `| Branch | Manager${categoriesToColumnHeaders(categoryColumns)} |\n`;
    prDesc += `| --- | ---${categoryColumns.map(() => ' | ---').join('')} |\n`;
    for (const base of sortedBases) {
      const label = base || '$default';
      for (const [manager, typeCounts] of Object.entries(
        stats.tableStats[base],
      )) {
        prDesc += `| ${label} | ${manager}${renderRowCounts(categoryColumns, typeCounts)} |\n`;
      }
    }
    const sumRow = sumCategoryCounts(
      Object.values(stats.tableStats).flatMap((b) => Object.values(b)),
      categoryColumns,
    );
    prDesc += `| **Total** | ${renderRowCounts(categoryColumns, sumRow)} |\n`;
  } else {
    prDesc += `| Manager${categoriesToColumnHeaders(categoryColumns)} |\n`;
    prDesc += `| ---${categoryColumns.map(() => ' | ---').join('')} |\n`;
    for (const [manager, typeCounts] of Object.entries(
      stats.tableStats[sortedBases[0]],
    )) {
      prDesc += `| ${manager}${renderRowCounts(categoryColumns, typeCounts)} |\n`;
    }
    const sumRow = sumCategoryCounts(
      Object.values(stats.tableStats[sortedBases[0]]),
      categoryColumns,
    );
    prDesc += `| **Total**${renderRowCounts(categoryColumns, sumRow)} |\n`;
  }

  prDesc += `\n<small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>\n`;

  // provide a summary of the given security updates, as they're likely more important to the user
  if (Object.keys(stats.securityGroups).length) {
    prDesc += `\n**Security updates**:\n\n`;
    for (const groupBranches of Object.values(stats.securityGroups)) {
      prDesc += describeSecurityGroup(groupBranches);
    }
  }

  if (
    commitHourlyLimit > 0 &&
    commitHourlyLimit < 5 &&
    commitHourlyLimit < stats.prCount
  ) {
    prDesc += emojify(
      `\n\n:children_crossing: Branch creation and rebasing will be limited to maximum ${commitHourlyLimit} per hour, so it doesn't swamp any CI resources or overwhelm the project. See [docs for \`commitHourlyLimit\`](${GlobalConfig.get('productLinks').documentation}configuration-options/#commithourlylimit) for details.\n\n`,
    );
  } else if (
    prHourlyLimit > 0 &&
    prHourlyLimit < 5 &&
    prHourlyLimit < stats.prCount
  ) {
    prDesc += emojify(
      `\n\n:children_crossing: PR creation will be limited to maximum ${prHourlyLimit} per hour, so it doesn't swamp any CI resources or overwhelm the project. See [docs for \`prHourlyLimit\`](${GlobalConfig.get('productLinks').documentation}configuration-options/#prhourlylimit) for details.\n\n`,
    );
  }
  return prDesc;
}

function determineHourlyLimitsNotice(
  prHourlyLimit: number,
  commitHourlyLimit: number,
  prCount: number,
): string {
  if (commitHourlyLimit === 0 && prHourlyLimit === 0) {
    return ' (with no configured maximum of PRs per hour)';
  } else if (
    commitHourlyLimit > 0 &&
    commitHourlyLimit < 5 &&
    commitHourlyLimit < prCount
  ) {
    return emojify(
      ` (at a maximum of ${commitHourlyLimit} PR${commitHourlyLimit > 1 ? 's' : ''}/rebase${commitHourlyLimit > 1 ? 's' : ''} per hour)`,
    );
  } else if (
    prHourlyLimit > 0 &&
    prHourlyLimit < 5 &&
    prHourlyLimit < prCount
  ) {
    return emojify(
      ` (at a maximum of ${prHourlyLimit} PR${prHourlyLimit > 1 ? 's' : ''} per hour)`,
    );
  } else {
    return '';
  }
}
