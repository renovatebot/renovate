import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import mdTable from 'markdown-table';
import semver from 'semver';
import { mergeChildConfig } from '../../../config';
import { CONFIG_SECRETS_EXPOSED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { sanitize } from '../../../util/sanitize';
import { safeStringify } from '../../../util/stringify';
import * as template from '../../../util/template';
import { uniq } from '../../../util/uniq';
import type { BranchConfig, BranchUpgradeConfig } from '../../types';
import { CommitMessage } from '../model/commit-message';

function prettifyVersion(version: string): string {
  if (regEx(/^\d/).test(version)) {
    return `v${version}`;
  }

  return version;
}

function isTypesGroup(branchUpgrades: BranchUpgradeConfig[]): boolean {
  return (
    branchUpgrades.some(({ depName }) => depName?.startsWith('@types/')) &&
    new Set(
      branchUpgrades.map(({ depName }) => depName?.replace(/^@types\//, '')),
    ).size === 1
  );
}

function sortTypesGroup(upgrades: BranchUpgradeConfig[]): void {
  const isTypesUpgrade = ({ depName }: BranchUpgradeConfig): boolean =>
    !!depName?.startsWith('@types/');
  const regularUpgrades = upgrades.filter(
    (upgrade) => !isTypesUpgrade(upgrade),
  );
  const typesUpgrades = upgrades.filter(isTypesUpgrade);
  upgrades.splice(0, upgrades.length);
  upgrades.push(...regularUpgrades, ...typesUpgrades);
}

function getTableValues(upgrade: BranchUpgradeConfig): string[] | null {
  if (!upgrade.commitBodyTable) {
    return null;
  }
  const { datasource, packageName, depName, currentVersion, newVersion } =
    upgrade;
  const name = packageName ?? depName;
  if (datasource && name && currentVersion && newVersion) {
    return [datasource, name, currentVersion, newVersion];
  }
  logger.debug(
    {
      datasource,
      packageName,
      depName,
      currentVersion,
      newVersion,
    },
    'Cannot determine table values',
  );
  return null;
}

export function generateBranchConfig(
  upgrades: BranchUpgradeConfig[],
): BranchConfig {
  let branchUpgrades = upgrades;
  if (!branchUpgrades.every((upgrade) => upgrade.pendingChecks)) {
    // If the branch isn't pending, then remove any upgrades within which *are*
    branchUpgrades = branchUpgrades.filter((upgrade) => !upgrade.pendingChecks);
  }
  logger.trace({ config: branchUpgrades }, 'generateBranchConfig');
  let config: BranchConfig = {
    upgrades: [],
  } as any;
  const hasGroupName = branchUpgrades[0].groupName !== null;
  logger.trace(`hasGroupName: ${hasGroupName}`);
  // Use group settings only if multiple upgrades or lazy grouping is disabled
  const depNames: string[] = [];
  const newValue: string[] = [];
  const toVersions: string[] = [];
  const toValues = new Set<string>();
  for (const upg of branchUpgrades) {
    upg.recreateClosed = upg.recreateWhen === 'always';

    if (upg.currentDigest) {
      upg.currentDigestShort =
        upg.currentDigestShort ??
        upg.currentDigest.replace('sha256:', '').substring(0, 7);
    }
    if (upg.newDigest) {
      upg.newDigestShort =
        upg.newDigestShort ||
        upg.newDigest.replace('sha256:', '').substring(0, 7);
    }
    if (upg.isDigest || upg.isPinDigest) {
      upg.displayFrom = upg.currentDigestShort;
      upg.displayTo = upg.newDigestShort;
    } else if (upg.isLockfileUpdate) {
      upg.displayFrom = upg.currentVersion;
      upg.displayTo = upg.newVersion;
    } else if (!upg.isLockFileMaintenance) {
      upg.displayFrom = upg.currentValue;
      upg.displayTo = upg.newValue;
    }

    if (upg.isLockFileMaintenance) {
      upg.recreateClosed = upg.recreateWhen !== 'never';
    }
    upg.displayFrom ??= '';
    upg.displayTo ??= '';
    if (!depNames.includes(upg.depName!)) {
      depNames.push(upg.depName!);
    }
    if (!toVersions.includes(upg.newVersion!)) {
      toVersions.push(upg.newVersion!);
    }
    toValues.add(upg.newValue!);
    // prettify newVersion and newMajor for printing
    if (upg.newVersion) {
      upg.prettyNewVersion = prettifyVersion(upg.newVersion);
    }
    if (upg.newMajor) {
      upg.prettyNewMajor = `v${upg.newMajor}`;
    }
    if (upg.commitMessageExtra) {
      const extra = template.compile(upg.commitMessageExtra, upg);
      if (!newValue.includes(extra)) {
        newValue.push(extra);
      }
    }
  }
  const groupEligible =
    depNames.length > 1 ||
    toVersions.length > 1 ||
    (!toVersions[0] && newValue.length > 1);

  const typesGroup =
    depNames.length > 1 && !hasGroupName && isTypesGroup(branchUpgrades);
  logger.trace(`groupEligible: ${groupEligible}`);
  const useGroupSettings = hasGroupName && groupEligible;
  logger.trace(`useGroupSettings: ${useGroupSettings}`);
  let releaseTimestamp: string;
  for (const branchUpgrade of branchUpgrades) {
    let upgrade: BranchUpgradeConfig = { ...branchUpgrade };

    // needs to be done for each upgrade, as we reorder them below
    if (newValue.length > 1 && !groupEligible) {
      upgrade.commitMessageExtra = `to v${toVersions[0]}`;
    }

    const pendingVersionsLength = upgrade.pendingVersions?.length;
    if (pendingVersionsLength) {
      upgrade.displayPending = `\`${upgrade
        .pendingVersions!.slice(-1)
        .pop()!}\``;
      if (pendingVersionsLength > 1) {
        upgrade.displayPending += ` (+${pendingVersionsLength - 1})`;
      }
    } else {
      upgrade.displayPending = '';
    }
    upgrade.prettyDepType =
      upgrade.prettyDepType ?? upgrade.depType ?? 'dependency';
    if (useGroupSettings) {
      // Now overwrite original config with group config
      upgrade = mergeChildConfig(upgrade, upgrade.group);
      upgrade.isGroup = true;
    } else {
      delete upgrade.groupName;
    }
    // Delete group config regardless of whether it was applied
    delete upgrade.group;

    // istanbul ignore else
    if (
      toVersions.length > 1 &&
      toValues.size > 1 &&
      newValue.length > 1 &&
      !typesGroup
    ) {
      logger.trace({ toVersions });
      logger.trace({ toValues });
      delete upgrade.commitMessageExtra;
      upgrade.recreateClosed = upgrade.recreateWhen !== 'never';
    } else if (
      newValue.length > 1 &&
      (upgrade.isDigest || upgrade.isPinDigest)
    ) {
      logger.trace({ newValue });
      delete upgrade.commitMessageExtra;
      upgrade.recreateClosed = upgrade.recreateWhen !== 'never';
    } else if (semver.valid(toVersions[0])) {
      upgrade.isRange = false;
    }
    // Use templates to generate strings
    if (upgrade.semanticCommits === 'enabled' && !upgrade.commitMessagePrefix) {
      logger.trace('Upgrade has semantic commits enabled');
      let semanticPrefix = upgrade.semanticCommitType;
      if (upgrade.semanticCommitScope) {
        semanticPrefix += `(${template.compile(
          upgrade.semanticCommitScope,
          upgrade,
        )})`;
      }
      upgrade.commitMessagePrefix = CommitMessage.formatPrefix(semanticPrefix!);
      upgrade.toLowerCase =
        regEx(/[A-Z]/).exec(upgrade.semanticCommitType!) === null &&
        !upgrade.semanticCommitType!.startsWith(':');
    }

    // Compile a few times in case there are nested templates
    upgrade.commitMessage = template.compile(
      upgrade.commitMessage ?? '',
      upgrade,
    );
    upgrade.commitMessage = template.compile(upgrade.commitMessage, upgrade);
    upgrade.commitMessage = template.compile(upgrade.commitMessage, upgrade);
    // istanbul ignore if
    if (upgrade.commitMessage !== sanitize(upgrade.commitMessage)) {
      logger.debug(
        { branchName: config.branchName },
        'Secrets exposed in commit message',
      );
      throw new Error(CONFIG_SECRETS_EXPOSED);
    }
    upgrade.commitMessage = upgrade.commitMessage.trim(); // Trim exterior whitespace
    upgrade.commitMessage = upgrade.commitMessage.replace(regEx(/\s+/g), ' '); // Trim extra whitespace inside string
    upgrade.commitMessage = upgrade.commitMessage.replace(
      regEx(/to vv(\d)/),
      'to v$1',
    );
    if (upgrade.toLowerCase && upgrade.commitMessageLowerCase !== 'never') {
      // We only need to lowercase the first line
      const splitMessage = upgrade.commitMessage.split(newlineRegex);
      splitMessage[0] = splitMessage[0].toLowerCase();
      upgrade.commitMessage = splitMessage.join('\n');
    }

    logger.trace(`commitMessage: ` + JSON.stringify(upgrade.commitMessage));
    if (upgrade.prTitle) {
      upgrade.prTitle = template.compile(upgrade.prTitle, upgrade);
      upgrade.prTitle = template.compile(upgrade.prTitle, upgrade);
      upgrade.prTitle = template
        .compile(upgrade.prTitle, upgrade)
        .trim()
        .replace(regEx(/\s+/g), ' ');
      // istanbul ignore if
      if (upgrade.prTitle !== sanitize(upgrade.prTitle)) {
        logger.debug(
          { branchName: config.branchName },
          'Secrets were exposed in PR title',
        );
        throw new Error(CONFIG_SECRETS_EXPOSED);
      }
      if (upgrade.toLowerCase && upgrade.commitMessageLowerCase !== 'never') {
        upgrade.prTitle = upgrade.prTitle.toLowerCase();
      }
    } else {
      [upgrade.prTitle] = upgrade.commitMessage.split(newlineRegex);
    }
    if (!upgrade.prTitleStrict) {
      upgrade.prTitle += upgrade.hasBaseBranches ? ' ({{baseBranch}})' : '';
      if (upgrade.isGroup) {
        upgrade.prTitle +=
          upgrade.updateType === 'major' && upgrade.separateMajorMinor
            ? ' (major)'
            : '';
        upgrade.prTitle +=
          upgrade.updateType === 'minor' && upgrade.separateMinorPatch
            ? ' (minor)'
            : '';
        upgrade.prTitle +=
          upgrade.updateType === 'patch' && upgrade.separateMinorPatch
            ? ' (patch)'
            : '';
      }
    }
    // Compile again to allow for nested templates
    upgrade.prTitle = template.compile(upgrade.prTitle, upgrade);
    logger.trace(`prTitle: ` + JSON.stringify(upgrade.prTitle));
    config.upgrades.push(upgrade);
    if (upgrade.releaseTimestamp) {
      if (releaseTimestamp!) {
        const existingStamp = DateTime.fromISO(releaseTimestamp);
        const upgradeStamp = DateTime.fromISO(upgrade.releaseTimestamp);
        if (upgradeStamp > existingStamp) {
          releaseTimestamp = upgrade.releaseTimestamp;
        }
      } else {
        releaseTimestamp = upgrade.releaseTimestamp;
      }
    }
  }

  if (typesGroup) {
    if (config.upgrades[0].depName?.startsWith('@types/')) {
      logger.debug('Found @types - reversing upgrades to use depName in PR');
      sortTypesGroup(config.upgrades);
      config.upgrades[0].recreateClosed = false;
      config.hasTypes = true;
    }
  } else {
    config.upgrades.sort((a, b) => {
      if (a.fileReplacePosition && b.fileReplacePosition) {
        // This is because we need to replace from the bottom of the file up
        return a.fileReplacePosition > b.fileReplacePosition ? -1 : 1;
      }

      // make sure that ordering is consistent :
      // items without position will be first in the list.
      if (a.fileReplacePosition) {
        return 1;
      }
      if (b.fileReplacePosition) {
        return -1;
      }

      if (a.depName! < b.depName!) {
        return -1;
      }
      if (a.depName! > b.depName!) {
        return 1;
      }
      return 0;
    });
  }
  // Now assign first upgrade's config as branch config
  config = {
    ...config,
    ...config.upgrades[0],
    releaseTimestamp: releaseTimestamp!,
  }; // TODO: fixme (#9666)
  config.reuseLockFiles = config.upgrades.every(
    (upgrade) => upgrade.updateType !== 'lockFileMaintenance',
  );
  config.dependencyDashboardApproval = config.upgrades.some(
    (upgrade) => upgrade.dependencyDashboardApproval,
  );
  config.dependencyDashboardPrApproval = config.upgrades.some(
    (upgrade) => upgrade.prCreation === 'approval',
  );
  config.prBodyColumns = [
    ...new Set(
      config.upgrades.reduce(
        (existing: string[], upgrade) =>
          existing.concat(upgrade.prBodyColumns!),
        [],
      ),
    ),
  ].filter(is.nonEmptyString);
  // combine excludeCommitPaths for multiple manager experience
  const hasExcludeCommitPaths = config.upgrades.some(
    (u) => u.excludeCommitPaths && u.excludeCommitPaths.length > 0,
  );
  if (hasExcludeCommitPaths) {
    config.excludeCommitPaths = Object.keys(
      config.upgrades.reduce((acc: Record<string, boolean>, upgrade) => {
        if (upgrade.excludeCommitPaths) {
          upgrade.excludeCommitPaths.forEach((p) => {
            acc[p] = true;
          });
        }

        return acc;
      }, {}),
    );
  }

  config.automerge = config.upgrades.every((upgrade) => upgrade.automerge);
  // combine all labels
  config.labels = [
    ...new Set(
      config.upgrades
        .map((upgrade) => upgrade.labels ?? [])
        .reduce((a, b) => a.concat(b), []),
    ),
  ];
  config.addLabels = [
    ...new Set(
      config.upgrades
        .map((upgrade) => upgrade.addLabels ?? [])
        .reduce((a, b) => a.concat(b), []),
    ),
  ];
  if (config.upgrades.some((upgrade) => upgrade.updateType === 'major')) {
    config.updateType = 'major';
  }
  config.constraints = {};
  for (const upgrade of config.upgrades) {
    if (upgrade.constraints) {
      config.constraints = { ...config.constraints, ...upgrade.constraints };
    }
  }

  const tableRows = config.upgrades
    .map(getTableValues)
    .filter((x): x is string[] => is.array(x, is.string));

  if (tableRows.length) {
    const table: string[][] = [];
    table.push(['datasource', 'package', 'from', 'to']);

    const seenRows = new Set<string>();

    for (const row of tableRows) {
      const key = safeStringify(row);
      if (seenRows.has(key)) {
        continue;
      }
      seenRows.add(key);
      table.push(row);
    }
    config.commitMessage += '\n\n' + mdTable(table) + '\n';
  }
  const additionalReviewers = uniq(
    config.upgrades
      .map((upgrade) => upgrade.additionalReviewers)
      .flat()
      .filter(is.nonEmptyString),
  );
  if (additionalReviewers.length > 0) {
    config.additionalReviewers = additionalReviewers;
  }
  return config;
}
