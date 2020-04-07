import slugify from 'slugify';
import { clean as cleanGitRef } from 'clean-git-ref';
import { Merge } from 'type-fest';
import { logger, addMeta, removeMeta } from '../../../logger';
import * as template from '../../../util/template';
import { generateBranchConfig } from './generate';
import { flattenUpdates } from './flatten';
import { RenovateConfig, ValidationMessage } from '../../../config';
import { BranchUpgradeConfig, BranchConfig } from '../../common';

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

export type BranchifiedConfig = Merge<
  RenovateConfig,
  {
    branches: BranchConfig[];
    branchList: string[];
  }
>;
export function branchifyUpgrades(
  config: RenovateConfig,
  packageFiles: Record<string, any[]>
): BranchifiedConfig {
  logger.debug('branchifyUpgrades');
  const updates = flattenUpdates(config, packageFiles);
  logger.debug(
    `${updates.length} flattened updates found: ${updates
      .map(u => u.depName)
      .join(', ')}`
  );
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const branchUpgrades: Record<string, BranchUpgradeConfig[]> = {};
  const branches: BranchConfig[] = [];
  for (const u of updates) {
    const update: BranchUpgradeConfig = { ...u } as any;
    // Massage legacy vars just in case
    update.currentVersion = update.currentValue;
    update.newVersion = update.newVersion || update.newValue;
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
      update.branchName = template.compile(
        update.group.branchName || update.branchName,
        update
      );
    } else {
      update.branchName = template.compile(update.branchName, update);
    }
    // Compile extra times in case of nested templates
    update.branchName = template.compile(update.branchName, update);
    update.branchName = cleanBranchName(
      template.compile(update.branchName, update)
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
        logger.debug(
          { sourceUrl, toVersion, branches: value },
          'Found sourceUrl with multiple branches that should probably be combined into a group'
        );
      }
    }
  } catch (err) {
    logger.debug({ err }, 'Error checking branch duplicates');
  }
  return {
    errors: config.errors.concat(errors),
    warnings: config.warnings.concat(warnings),
    branches,
    branchList,
  };
}
