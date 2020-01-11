import slugify from 'slugify';
import handlebars from 'handlebars';
import { clean as cleanGitRef } from 'clean-git-ref';
import { logger, addMeta, removeMeta } from '../../../logger';

import { generateBranchConfig } from './generate';
import { flattenUpdates } from './flatten';
import { RenovateConfig, ValidationMessage } from '../../../config';

/**
 * Clean git branch name
 *
 * Remove what clean-git-ref fails to:
 * - leading dot/leading dot after slash
 * - trailing dot
 * - whitespace
 */
function cleanBranchName(branchName: string): string {
  return cleanGitRef(branchName)
    .replace(/^\.|\.$/, '') // leading or trailing dot
    .replace(/\/\./g, '/') // leading dot after slash
    .replace(/\s/g, ''); // whitespace
}

// TODO: fix return type
export function branchifyUpgrades(
  config: RenovateConfig,
  packageFiles: Record<string, any[]>
): RenovateConfig {
  logger.debug('branchifyUpgrades');
  const updates = flattenUpdates(config, packageFiles);
  logger.debug(
    `${updates.length} flattened updates found: ${updates
      .map(u => u.depName)
      .join(', ')}`
  );
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const branchUpgrades = {};
  const branches = [];
  for (const u of updates) {
    const update = { ...u };
    // Massage legacy vars just in case
    update.currentVersion = update.currentValue;
    update.newVersion = update.newVersion || update.newValue;
    // massage for handlebars
    const upper = (str: string): string =>
      str.charAt(0).toUpperCase() + str.substr(1);
    if (update.updateType) {
      update[`is${upper(update.updateType)}`] = true;
    }
    // Check whether to use a group name
    if (update.groupName) {
      logger.debug('Using group branchName template');
      logger.debug(
        `Dependency ${update.depName} is part of group ${update.groupName}`
      );
      update.groupSlug = slugify(update.groupSlug || update.groupName, {
        lower: true,
      });
      if (update.updateType === 'major' && update.separateMajorMinor) {
        if (update.separateMultipleMajor) {
          update.groupSlug = `major-${update.newMajor}-${update.groupSlug}`;
        } else {
          update.groupSlug = `major-${update.groupSlug}`;
        }
      }
      if (update.updateType === 'patch') {
        update.groupSlug = `patch-${update.groupSlug}`;
      }
      update.branchTopic = update.group.branchTopic || update.branchTopic;
      update.branchName = handlebars.compile(
        update.group.branchName || update.branchName
      )(update);
    } else {
      update.branchName = handlebars.compile(update.branchName)(update);
    }
    // Compile extra times in case of nested handlebars templates
    update.branchName = handlebars.compile(update.branchName)(update);
    update.branchName = cleanBranchName(
      handlebars.compile(update.branchName)(update)
    );

    branchUpgrades[update.branchName] = branchUpgrades[update.branchName] || [];
    branchUpgrades[update.branchName] = [update].concat(
      branchUpgrades[update.branchName]
    );
  }
  logger.debug(`Returning ${Object.keys(branchUpgrades).length} branch(es)`);
  for (const branchName of Object.keys(branchUpgrades)) {
    // Add branch name to metadata before generating branch config
    addMeta({
      branch: branchName,
    });
    const branch = generateBranchConfig(branchUpgrades[branchName]);
    branch.branchName = branchName;
    branches.push(branch);
  }
  removeMeta(['branch']);
  logger.debug(`config.repoIsOnboarded=${config.repoIsOnboarded}`);
  const branchList = config.repoIsOnboarded
    ? branches.map(upgrade => upgrade.branchName)
    : config.branchList;
  // istanbul ignore next
  try {
    // Here we check if there are updates from the same source repo
    // that are not grouped into the same branch
    const branchUpdates = {};
    for (const branch of branches) {
      const { sourceUrl, branchName, depName, toVersion } = branch;
      if (sourceUrl && toVersion) {
        const key = `${sourceUrl}|${toVersion}`;
        branchUpdates[key] = branchUpdates[key] || {};
        if (!branchUpdates[key][branchName]) {
          branchUpdates[key][branchName] = depName;
        }
      }
    }
    for (const [key, value] of Object.entries(branchUpdates)) {
      if (Object.keys(value).length > 1) {
        const [sourceUrl, toVersion] = key.split('|');
        logger.info(
          { sourceUrl, toVersion, branches: value },
          'Found sourceUrl with multiple branches that should probably be combined into a group'
        );
      }
    }
  } catch (err) {
    logger.info({ err }, 'Error checking branch duplicates');
  }
  return {
    errors: config.errors.concat(errors),
    warnings: config.warnings.concat(warnings),
    branches,
    branchList,
  };
}
