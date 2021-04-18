import { DateTime } from 'luxon';
import mdTable from 'markdown-table';
import semver from 'semver';
import { mergeChildConfig } from '../../../config';
import { CONFIG_SECRETS_EXPOSED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { sanitize } from '../../../util/sanitize';
import * as template from '../../../util/template';
import type { BranchConfig, BranchUpgradeConfig } from '../../types';
import { formatCommitMessagePrefix } from '../util/commit-message';

function isTypesGroup(branchUpgrades: BranchUpgradeConfig[]): boolean {
  return (
    branchUpgrades.some(({ depName }) => depName?.startsWith('@types/')) &&
    new Set(
      branchUpgrades.map(({ depName }) => depName?.replace(/^@types\//, ''))
    ).size === 1
  );
}

function sortTypesGroup(upgrades: BranchUpgradeConfig[]): void {
  const isTypesUpgrade = ({ depName }: BranchUpgradeConfig): boolean =>
    depName?.startsWith('@types/');
  const regularUpgrades = upgrades.filter(
    (upgrade) => !isTypesUpgrade(upgrade)
  );
  const typesUpgrades = upgrades.filter(isTypesUpgrade);
  upgrades.splice(0, upgrades.length);
  upgrades.push(...regularUpgrades, ...typesUpgrades);
}

function getTableValues(
  upgrade: BranchUpgradeConfig
): [string, string, string, string] | null {
  if (!upgrade.commitBodyTable) {
    return null;
  }
  const {
    datasource,
    lookupName,
    depName,
    currentVersion,
    newVersion,
  } = upgrade;
  const name = lookupName || depName;
  if (datasource && name && currentVersion && newVersion) {
    return [datasource, name, currentVersion, newVersion];
  }
  logger.debug(
    {
      datasource,
      lookupName,
      depName,
      currentVersion,
      newVersion,
    },
    'Cannot determine table values'
  );
  return null;
}

export function generateBranchConfig(
  branchUpgrades: BranchUpgradeConfig[]
): BranchConfig {
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
  branchUpgrades.forEach((upg) => {
    if (!depNames.includes(upg.depName)) {
      depNames.push(upg.depName);
    }
    if (!toVersions.includes(upg.newVersion)) {
      toVersions.push(upg.newVersion);
    }
    if (upg.commitMessageExtra) {
      const extra = template.compile(upg.commitMessageExtra, upg);
      if (!newValue.includes(extra)) {
        newValue.push(extra);
      }
    }
  });
  const groupEligible =
    depNames.length > 1 ||
    toVersions.length > 1 ||
    (!toVersions[0] && newValue.length > 1);
  if (newValue.length > 1 && !groupEligible) {
    // eslint-disable-next-line no-param-reassign
    branchUpgrades[0].commitMessageExtra = `to v${toVersions[0]}`;
  }
  const typesGroup =
    depNames.length > 1 && !hasGroupName && isTypesGroup(branchUpgrades);
  logger.trace(`groupEligible: ${groupEligible}`);
  const useGroupSettings = hasGroupName && groupEligible;
  logger.trace(`useGroupSettings: ${useGroupSettings}`);
  let releaseTimestamp: string;
  for (const branchUpgrade of branchUpgrades) {
    let upgrade: BranchUpgradeConfig = { ...branchUpgrade };
    if (upgrade.currentDigest) {
      upgrade.currentDigestShort =
        upgrade.currentDigestShort ||
        upgrade.currentDigest.replace('sha256:', '').substring(0, 7);
    }
    if (upgrade.newDigest) {
      upgrade.newDigestShort =
        upgrade.newDigestShort ||
        upgrade.newDigest.replace('sha256:', '').substring(0, 7);
    }
    if (upgrade.isDigest) {
      upgrade.displayFrom = upgrade.currentDigestShort;
      upgrade.displayTo = upgrade.newDigestShort;
    } else if (upgrade.isLockfileUpdate) {
      upgrade.displayFrom = upgrade.currentVersion;
      upgrade.displayTo = upgrade.newVersion;
    } else if (!upgrade.isLockFileMaintenance) {
      upgrade.displayFrom = upgrade.currentValue;
      upgrade.displayTo = upgrade.newValue;
    }
    upgrade.displayFrom ??= '';
    upgrade.displayTo ??= '';
    upgrade.prettyDepType =
      upgrade.prettyDepType || upgrade.depType || 'dependency';
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
    if (toVersions.length > 1 && !typesGroup) {
      logger.trace({ toVersions });
      delete upgrade.commitMessageExtra;
      upgrade.recreateClosed = true;
    } else if (newValue.length > 1 && upgrade.isDigest) {
      logger.trace({ newValue });
      delete upgrade.commitMessageExtra;
      upgrade.recreateClosed = true;
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
          upgrade
        )})`;
      }
      upgrade.commitMessagePrefix = formatCommitMessagePrefix(semanticPrefix);
      upgrade.toLowerCase =
        // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
        upgrade.semanticCommitType.match(/[A-Z]/) === null &&
        !upgrade.semanticCommitType.startsWith(':');
    }
    // Compile a few times in case there are nested templates
    upgrade.commitMessage = template.compile(
      upgrade.commitMessage || '',
      upgrade
    );
    upgrade.commitMessage = template.compile(upgrade.commitMessage, upgrade);
    upgrade.commitMessage = template.compile(upgrade.commitMessage, upgrade);
    // istanbul ignore if
    if (upgrade.commitMessage !== sanitize(upgrade.commitMessage)) {
      throw new Error(CONFIG_SECRETS_EXPOSED);
    }
    upgrade.commitMessage = upgrade.commitMessage.trim(); // Trim exterior whitespace
    upgrade.commitMessage = upgrade.commitMessage.replace(/\s+/g, ' '); // Trim extra whitespace inside string
    upgrade.commitMessage = upgrade.commitMessage.replace(
      /to vv(\d)/,
      'to v$1'
    );
    if (upgrade.toLowerCase) {
      // We only need to lowercase the first line
      const splitMessage = upgrade.commitMessage.split('\n');
      splitMessage[0] = splitMessage[0].toLowerCase();
      upgrade.commitMessage = splitMessage.join('\n');
    }
    if (upgrade.commitBody) {
      upgrade.commitMessage = `${upgrade.commitMessage}\n\n${template.compile(
        upgrade.commitBody,
        upgrade
      )}`;
    }
    logger.trace(`commitMessage: ` + JSON.stringify(upgrade.commitMessage));
    if (upgrade.prTitle) {
      upgrade.prTitle = template.compile(upgrade.prTitle, upgrade);
      upgrade.prTitle = template.compile(upgrade.prTitle, upgrade);
      upgrade.prTitle = template
        .compile(upgrade.prTitle, upgrade)
        .trim()
        .replace(/\s+/g, ' ');
      // istanbul ignore if
      if (upgrade.prTitle !== sanitize(upgrade.prTitle)) {
        throw new Error(CONFIG_SECRETS_EXPOSED);
      }
      if (upgrade.toLowerCase) {
        upgrade.prTitle = upgrade.prTitle.toLowerCase();
      }
    } else {
      [upgrade.prTitle] = upgrade.commitMessage.split('\n');
    }
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
      upgrade.prTitle += upgrade.updateType === 'patch' ? ' (patch)' : '';
    }
    // Compile again to allow for nested templates
    upgrade.prTitle = template.compile(upgrade.prTitle, upgrade);
    logger.trace(`prTitle: ` + JSON.stringify(upgrade.prTitle));
    config.upgrades.push(upgrade);
    if (upgrade.releaseTimestamp) {
      if (releaseTimestamp) {
        const existingStamp = DateTime.fromISO(releaseTimestamp);
        const upgradeStamp = DateTime.fromISO(upgrade.releaseTimestamp);
        if (upgradeStamp > existingStamp) {
          releaseTimestamp = upgrade.releaseTimestamp; // eslint-disable-line
        }
      } else {
        releaseTimestamp = upgrade.releaseTimestamp; // eslint-disable-line
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

      if (a.depName < b.depName) {
        return -1;
      }
      if (a.depName > b.depName) {
        return 1;
      }
      return 0;
    });
  }
  // Now assign first upgrade's config as branch config
  config = { ...config, ...config.upgrades[0], releaseTimestamp }; // TODO: fixme
  config.reuseLockFiles = config.upgrades.every(
    (upgrade) => upgrade.updateType !== 'lockFileMaintenance'
  );
  config.dependencyDashboardApproval = config.upgrades.some(
    (upgrade) => upgrade.dependencyDashboardApproval
  );
  config.dependencyDashboardPrApproval = config.upgrades.some(
    (upgrade) => upgrade.prCreation === 'approval'
  );
  config.automerge = config.upgrades.every((upgrade) => upgrade.automerge);
  // combine all labels
  config.labels = [
    ...new Set(
      config.upgrades
        .map((upgrade) => upgrade.labels || [])
        .reduce((a, b) => a.concat(b), [])
    ),
  ];
  config.addLabels = [
    ...new Set(
      config.upgrades
        .map((upgrade) => upgrade.addLabels || [])
        .reduce((a, b) => a.concat(b), [])
    ),
  ];
  if (config.upgrades.some((upgrade) => upgrade.updateType === 'major')) {
    config.updateType = 'major';
  }
  config.constraints = {};
  for (const upgrade of config.upgrades || []) {
    if (upgrade.constraints) {
      config.constraints = { ...config.constraints, ...upgrade.constraints };
    }
  }
  const tableRows = config.upgrades
    .map((upgrade) => getTableValues(upgrade))
    .filter(Boolean);
  if (tableRows.length) {
    let table = [];
    table.push(['datasource', 'package', 'from', 'to']);
    table = table.concat(tableRows);
    config.commitMessage += '\n\n' + mdTable(table) + '\n';
  }
  return config;
}
