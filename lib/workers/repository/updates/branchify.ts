// TODO #22198
import type { Merge } from 'type-fest';
import type { RenovateConfig, ValidationMessage } from '../../../config/types';
import { addMeta, logger, removeMeta } from '../../../logger';
import type { BranchConfig, BranchUpgradeConfig } from '../../types';
import { flattenUpdates } from './flatten';
import { generateBranchConfig } from './generate';

export type BranchifiedConfig = Merge<
  RenovateConfig,
  {
    branches: BranchConfig[];
    branchList: string[];
  }
>;
export async function branchifyUpgrades(
  config: RenovateConfig,
  packageFiles: Record<string, any[]>,
): Promise<BranchifiedConfig> {
  logger.debug('branchifyUpgrades');
  const updates = await flattenUpdates(config, packageFiles);
  logger.debug(
    `${updates.length} flattened updates found: ${updates
      .map((u) => u.depName)
      .filter((txt) => txt?.trim().length)
      .join(', ')}`,
  );
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const branchUpgrades: Record<string, BranchUpgradeConfig[]> = {};
  const branches: BranchConfig[] = [];
  for (const u of updates) {
    const update: BranchUpgradeConfig = { ...u } as any;
    branchUpgrades[update.branchName] = branchUpgrades[update.branchName] || [];
    branchUpgrades[update.branchName] = [update].concat(
      branchUpgrades[update.branchName],
    );
  }
  logger.debug(`Returning ${Object.keys(branchUpgrades).length} branch(es)`);
  for (const branchName of Object.keys(branchUpgrades)) {
    // Add branch name to metadata before generating branch config
    addMeta({
      branch: branchName,
    });
    const seenUpdates: Record<string, string> = {};
    // Filter out duplicates
    branchUpgrades[branchName] = branchUpgrades[branchName]
      .reverse()
      .filter((upgrade) => {
        const { manager, packageFile, depName, currentValue, newValue } =
          upgrade;
        // TODO: types (#22198)
        const upgradeKey = `${packageFile!}:${depName!}:${currentValue!}`;
        const previousNewValue = seenUpdates[upgradeKey];
        if (previousNewValue && previousNewValue !== newValue) {
          logger.info(
            {
              manager,
              packageFile,
              depName,
              currentValue,
              previousNewValue,
              thisNewValue: newValue,
            },
            'Ignoring upgrade collision',
          );
          return false;
        }
        seenUpdates[upgradeKey] = newValue!;
        return true;
      })
      .reverse();

    const branch = generateBranchConfig(branchUpgrades[branchName]);
    branch.branchName = branchName;
    branch.packageFiles = packageFiles;
    branches.push(branch);
  }
  removeMeta(['branch']);
  // TODO: types (#22198)
  logger.debug(`config.repoIsOnboarded=${config.repoIsOnboarded!}`);
  const branchList = config.repoIsOnboarded
    ? branches.map((upgrade) => upgrade.branchName)
    : config.branchList;
  // istanbul ignore next
  try {
    // Here we check if there are updates from the same source repo
    // that are not grouped into the same branch
    const branchUpdates: Record<string, Record<string, string>> = {};
    for (const branch of branches) {
      const { sourceUrl, branchName, depName, newVersion } = branch;
      if (sourceUrl && newVersion) {
        const key = `${sourceUrl}|${newVersion}`;
        branchUpdates[key] = branchUpdates[key] || {};
        if (!branchUpdates[key][branchName]) {
          branchUpdates[key][branchName] = depName!;
        }
      }
    }
    for (const [key, value] of Object.entries(branchUpdates)) {
      if (Object.keys(value).length > 1) {
        const [sourceUrl, newVersion] = key.split('|');
        logger.debug(
          { sourceUrl, newVersion, branches: value },
          'Found sourceUrl with multiple branches that should probably be combined into a group',
        );
      }
    }
  } catch (err) {
    logger.debug({ err }, 'Error checking branch duplicates');
  }
  return {
    errors: config.errors!.concat(errors),
    warnings: config.warnings!.concat(warnings),
    branches,
    branchList: branchList!,
  };
}
