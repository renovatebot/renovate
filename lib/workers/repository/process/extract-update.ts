import { logger } from '../../../logger';
import { writeUpdates, WriteUpdateResult } from './write';
import { sortBranches } from './sort';
import { fetchUpdates } from './fetch';
import { raiseDeprecationWarnings } from './deprecated';
import { branchifyUpgrades } from '../updates/branchify';
import { extractAllDependencies } from '../extract';
import { PackageFile } from '../../../manager/common';
import { RenovateConfig } from '../../../config';
import { BranchConfig } from '../../common';

export type ExtractResult = {
  branches: BranchConfig[];
  branchList: string[];
  packageFiles?: Record<string, PackageFile[]>;
};

export type UpdateResult = {
  res: WriteUpdateResult | undefined;
};

export async function extract(config: RenovateConfig): Promise<ExtractResult> {
  logger.debug('extractAndUpdate()');
  const packageFiles = await extractAllDependencies(config);
  logger.trace({ config: packageFiles }, 'packageFiles');
  await fetchUpdates(config, packageFiles);
  logger.debug({ config: packageFiles }, 'packageFiles with updates');
  await raiseDeprecationWarnings(config, packageFiles);
  const { branches, branchList } = branchifyUpgrades(config, packageFiles);
  sortBranches(branches);
  return { branches, branchList, packageFiles };
}

export async function update(
  config: RenovateConfig,
  branches: BranchConfig[],
  branchList: string[],
  packageFiles?: Record<string, PackageFile[]>
): Promise<UpdateResult> {
  let res: WriteUpdateResult | undefined;
  // istanbul ignore else
  if (config.repoIsOnboarded) {
    res = await writeUpdates(config, packageFiles, branches);
  }

  return { res };
}
