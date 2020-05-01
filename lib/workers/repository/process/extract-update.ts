import { hrtime } from 'process';
import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import { PackageFile } from '../../../manager/common';
import { BranchConfig } from '../../common';
import { extractAllDependencies } from '../extract';
import { branchifyUpgrades } from '../updates/branchify';
import { raiseDeprecationWarnings } from './deprecated';
import { fetchUpdates } from './fetch';
import { sortBranches } from './sort';
import { WriteUpdateResult, writeUpdates } from './write';

export type ExtractResult = {
  branches: BranchConfig[];
  branchList: string[];
  packageFiles: Record<string, PackageFile[]>;
};

// istanbul ignore next
function extractStats(packageFiles: Record<string, PackageFile[]>): any {
  if (!packageFiles) {
    return {};
  }
  const stats = {
    managers: {},
    total: {
      fileCount: 0,
      depCount: 0,
    },
  };
  for (const [manager, managerPackageFiles] of Object.entries(packageFiles)) {
    const fileCount = managerPackageFiles.length;
    let depCount = 0;
    for (const file of managerPackageFiles) {
      depCount += file.deps.length;
    }
    stats.managers[manager] = {
      fileCount,
      depCount,
    };
    stats.total.fileCount += fileCount;
    stats.total.depCount += depCount;
  }
  return stats;
}

export async function extract(config: RenovateConfig): Promise<ExtractResult> {
  logger.debug('extractAndUpdate()');
  const startTime = hrtime();
  const packageFiles = await extractAllDependencies(config);
  const duration = hrtime(startTime);
  const seconds = Math.round(duration[0] + duration[1] / 1e9);
  const stats = extractStats(packageFiles);
  logger.info({ stats, seconds }, `Dependency extraction complete`);
  logger.trace({ config: packageFiles }, 'packageFiles');
  await fetchUpdates(config, packageFiles);
  logger.debug({ config: packageFiles }, 'packageFiles with updates');
  await raiseDeprecationWarnings(config, packageFiles);
  const { branches, branchList } = await branchifyUpgrades(
    config,
    packageFiles
  );
  sortBranches(branches);
  return { branches, branchList, packageFiles };
}

export async function update(
  config: RenovateConfig,
  branches: BranchConfig[],
  branchList: string[],
  packageFiles: Record<string, PackageFile[]>
): Promise<WriteUpdateResult | undefined> {
  let res: WriteUpdateResult | undefined;
  // istanbul ignore else
  if (config.repoIsOnboarded) {
    res = await writeUpdates(config, packageFiles, branches);
  }

  return res;
}
