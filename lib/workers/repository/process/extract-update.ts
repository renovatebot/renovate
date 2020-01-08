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

export type ExtractAndUpdateResult = {
  res: WriteUpdateResult | undefined;
  branches: BranchConfig[];
  branchList: string[];
  packageFiles?: Record<string, PackageFile[]>;
};

export async function extractAndUpdate(
  config: RenovateConfig
): Promise<ExtractAndUpdateResult> {
  logger.debug('extractAndUpdate()');
  const packageFiles = await extractAllDependencies(config);
  logger.trace({ config: packageFiles }, 'packageFiles');
  await fetchUpdates(config, packageFiles);
  logger.debug({ config: packageFiles }, 'packageFiles with updates');
  await raiseDeprecationWarnings(config, packageFiles);
  const { branches, branchList } = branchifyUpgrades(config, packageFiles);
  sortBranches(branches);
  let res: WriteUpdateResult | undefined;
  // istanbul ignore else
  if (config.repoIsOnboarded) {
    res = await writeUpdates(config, packageFiles, branches);
  }
  return { res, branches, branchList, packageFiles };
}
