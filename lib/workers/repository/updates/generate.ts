import * as handlebars from 'handlebars';
import { DateTime } from 'luxon';
import semver from 'semver';
import mdTable from 'markdown-table';
import { logger } from '../../../logger';
import {
  mergeChildConfig,
  ManagerConfig,
  RenovateConfig,
} from '../../../config';
import { PackageDependency } from '../../../manager/common';

function ifTypesGroup(
  depNames: string[],
  hasGroupName: boolean,
  branchUpgrades: any[]
): boolean {
  return (
    depNames.length === 2 &&
    !hasGroupName &&
    ((branchUpgrades[0].depName &&
      branchUpgrades[0].depName.startsWith('@types/') &&
      branchUpgrades[0].depName.endsWith(branchUpgrades[1].depName)) ||
      (branchUpgrades[1].depName &&
        branchUpgrades[1].depName.startsWith('@types/') &&
        branchUpgrades[1].depName.endsWith(branchUpgrades[0].depName)))
  );
}

function getTableValues(
  upgrade: PackageDependency & ManagerConfig
): [string, string, string, string] | null {
  if (!upgrade.commitBodyTable) {
    return null;
  }
  const {
    datasource,
    lookupName,
    depName,
    fromVersion,
    toVersion,
    displayFrom,
    displayTo,
  } = upgrade;
  const name = lookupName || depName;
  const from = fromVersion || displayFrom;
  const to = toVersion || displayTo;
  if (datasource && name && from && to) {
    return [datasource, name, from, to];
  }
  logger.debug(
    {
      datasource,
      lookupName,
      depName,
      fromVersion,
      toVersion,
      displayFrom,
      displayTo,
    },
    'Cannot determine table values'
  );
  return null;
}

export function generateBranchConfig(branchUpgrades): RenovateConfig {
  logger.debug(`generateBranchConfig(${branchUpgrades.length})`);
  logger.trace({ config: branchUpgrades });
  let config: any = {
    upgrades: [],
  };
  const hasGroupName = branchUpgrades[0].groupName !== null;
  logger.debug(`hasGroupName: ${hasGroupName}`);
  // Use group settings only if multiple upgrades or lazy grouping is disabled
  const depNames = [];
  const newValue = [];
  const toVersions = [];
  branchUpgrades.forEach(upg => {
    if (!depNames.includes(upg.depName)) {
      depNames.push(upg.depName);
    }
    if (!toVersions.includes(upg.toVersion)) {
      toVersions.push(upg.toVersion);
    }
    if (upg.commitMessageExtra) {
      const extra = handlebars.compile(upg.commitMessageExtra)(upg);
      if (!newValue.includes(extra)) {
        newValue.push(extra);
      }
    }
  });
  const groupEligible =
    depNames.length > 1 ||
    toVersions.length > 1 ||
    (!toVersions[0] && newValue.length > 1) ||
    branchUpgrades[0].lazyGrouping === false;
  if (newValue.length > 1 && !groupEligible) {
    // eslint-disable-next-line no-param-reassign
    branchUpgrades[0].commitMessageExtra = `to v${toVersions[0]}`;
  }
  logger.debug(`groupEligible: ${groupEligible}`);
  const useGroupSettings = hasGroupName && groupEligible;
  logger.debug(`useGroupSettings: ${useGroupSettings}`);
  let releaseTimestamp;
  for (const branchUpgrade of branchUpgrades) {
    let upgrade = { ...branchUpgrade };
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
    if (!upgrade.displayFrom) {
      if (upgrade.currentValue === upgrade.newValue) {
        upgrade.displayFrom =
          upgrade.currentDigestShort || upgrade.currentVersion || '';
        upgrade.displayTo =
          upgrade.displayTo ||
          upgrade.newDigestShort ||
          upgrade.newVersion ||
          '';
      } else {
        upgrade.displayFrom =
          upgrade.currentValue ||
          upgrade.currentVersion ||
          upgrade.currentDigestShort ||
          '';
        upgrade.displayTo =
          upgrade.displayTo ||
          upgrade.newValue ||
          upgrade.newVersion ||
          upgrade.newDigestShort ||
          '';
      }
    }

    if (
      upgrade.updateType !== 'lockFileMaintenance' &&
      upgrade.displayFrom.length * upgrade.displayTo.length === 0
    ) {
      logger.info({ config: upgrade }, 'empty displayFrom/displayTo');
    }
    if (upgrade.depName) {
      upgrade.depNameEscaped = (upgrade.lookupName || upgrade.depName).replace(
        /\//g,
        '%2f'
      );
    }
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
    delete upgrade.lazyGrouping;

    const isTypesGroup = ifTypesGroup(depNames, hasGroupName, branchUpgrades);

    // istanbul ignore else
    if (toVersions.length > 1 && !isTypesGroup) {
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
    // extract parentDir and baseDir from packageFile
    if (upgrade.packageFile) {
      const packagePath = upgrade.packageFile.split('/');
      if (packagePath.length > 0) {
        packagePath.splice(-1, 1);
      }
      if (packagePath.length > 0) {
        upgrade.parentDir = packagePath[packagePath.length - 1];
        upgrade.baseDir = packagePath.join('/');
      } else {
        upgrade.parentDir = '';
        upgrade.baseDir = '';
      }
    }
    // Use templates to generate strings
    logger.trace('Compiling branchName: ' + upgrade.branchName);
    upgrade.branchName = handlebars.compile(upgrade.branchName)(upgrade);
    if (upgrade.semanticCommits && !upgrade.commitMessagePrefix) {
      logger.trace('Upgrade has semantic commits enabled');
      let semanticPrefix = upgrade.semanticCommitType;
      if (upgrade.semanticCommitScope) {
        semanticPrefix += `(${handlebars.compile(upgrade.semanticCommitScope)(
          upgrade
        )})`;
      }
      upgrade.commitMessagePrefix = semanticPrefix;
      upgrade.commitMessagePrefix += semanticPrefix.endsWith(':') ? ' ' : ': ';
      upgrade.toLowerCase =
        upgrade.semanticCommitType.match(/[A-Z]/) === null &&
        !upgrade.semanticCommitType.startsWith(':');
    }
    // Compile a few times in case there are nested templates
    upgrade.commitMessage = handlebars.compile(upgrade.commitMessage || '')(
      upgrade
    );
    upgrade.commitMessage = handlebars.compile(upgrade.commitMessage)(upgrade);
    upgrade.commitMessage = handlebars.compile(upgrade.commitMessage)(upgrade);
    upgrade.commitMessage = upgrade.commitMessage.trim(); // Trim exterior whitespace
    upgrade.commitMessage = upgrade.commitMessage.replace(/\s+/g, ' '); // Trim extra whitespace inside string
    upgrade.commitMessage = upgrade.commitMessage.replace(
      /to vv(\d)/,
      'to v$1'
    );
    if (upgrade.toLowerCase) {
      // We only need to lowercvase the first line
      const splitMessage = upgrade.commitMessage.split('\n');
      splitMessage[0] = splitMessage[0].toLowerCase();
      upgrade.commitMessage = splitMessage.join('\n');
    }
    if (upgrade.commitBody) {
      upgrade.commitMessage = `${upgrade.commitMessage}\n\n${handlebars.compile(
        upgrade.commitBody
      )(upgrade)}`;
    }
    logger.trace(`commitMessage: ` + JSON.stringify(upgrade.commitMessage));
    if (upgrade.prTitle) {
      upgrade.prTitle = handlebars.compile(upgrade.prTitle)(upgrade);
      upgrade.prTitle = handlebars.compile(upgrade.prTitle)(upgrade);
      upgrade.prTitle = handlebars
        .compile(upgrade.prTitle)(upgrade)
        .trim()
        .replace(/\s+/g, ' ');
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
    // Compile again to allow for nested handlebars templates
    upgrade.prTitle = handlebars.compile(upgrade.prTitle)(upgrade);
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
  if (
    depNames.length === 2 &&
    !hasGroupName &&
    config.upgrades[0].depName &&
    config.upgrades[0].depName.startsWith('@types/') &&
    config.upgrades[0].depName.endsWith(config.upgrades[1].depName)
  ) {
    logger.debug('Found @types - reversing upgrades to use depName in PR');
    config.upgrades.reverse();
    config.upgrades[0].recreateClosed = false;
    config.hasTypes = true;
  } else if (
    depNames.length === 2 &&
    !hasGroupName &&
    config.upgrades[1].depName &&
    config.upgrades[1].depName.startsWith('@types/') &&
    config.upgrades[1].depName.endsWith(config.upgrades[0].depName)
  ) {
    // do nothing
  } else {
    config.upgrades.sort((a, b) => {
      if (a.fileReplacePosition && b.fileReplacePosition) {
        // This is because we need to replace from the bottom of the file up
        return a.fileReplacePosition > b.fileReplacePosition ? -1 : 1;
      }
      if (a.depName < b.depName) return -1;
      if (a.depName > b.depName) return 1;
      return 0;
    });
  }
  // Now assign first upgrade's config as branch config
  config = { ...config, ...config.upgrades[0], releaseTimestamp };
  config.canBeUnpublished = config.upgrades.some(
    upgrade => upgrade.canBeUnpublished
  );
  config.reuseLockFiles = config.upgrades.every(
    upgrade => upgrade.updateType !== 'lockFileMaintenance'
  );
  config.masterIssueApproval = config.upgrades.some(
    upgrade => upgrade.masterIssueApproval
  );
  config.masterIssuePrApproval = config.upgrades.some(
    upgrade => upgrade.prCreation === 'approval'
  );
  config.automerge = config.upgrades.every(upgrade => upgrade.automerge);
  config.blockedByPin = config.upgrades.every(upgrade => upgrade.blockedByPin);
  const tableRows = config.upgrades
    .map(upgrade => getTableValues(upgrade))
    .filter(Boolean);
  if (tableRows.length) {
    let table = [];
    table.push(['datasource', 'package', 'from', 'to']);
    table = table.concat(tableRows);
    config.commitMessage += '\n\n' + mdTable(table) + '\n';
  }
  return config;
}
