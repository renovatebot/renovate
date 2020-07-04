import is from '@sindresorhus/is';
import hash from 'object-hash';
import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import { PackageFile } from '../../../manager/common';
import { getCache } from '../../../util/cache/repository';
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

export async function extract(
  config: RenovateConfig
): Promise<Record<string, PackageFile[]>> {
  logger.debug('extract()');
  const { baseBranch, baseBranchSha } = config;
  let packageFiles;
  const cache = getCache();
  const cachedExtract = cache?.scan?.[baseBranch];
  const configHash = hash(config);
  // istanbul ignore if
  if (
    cachedExtract?.sha === baseBranchSha &&
    cachedExtract?.configHash === configHash
  ) {
    logger.debug({ baseBranch, baseBranchSha }, 'Found cached extract');
    packageFiles = cachedExtract.packageFiles;
  } else {
    packageFiles = await extractAllDependencies(config);
    cache.scan = cache.scan || Object.create({});
    cache.scan[baseBranch] = {
      sha: baseBranchSha,
      configHash,
      packageFiles,
    };
    // Clean up cached branch extracts
    const baseBranches = is.nonEmptyArray(config.baseBranches)
      ? config.baseBranches
      : [baseBranch];
    Object.keys(cache.scan).forEach((branchName) => {
      if (!baseBranches.includes(branchName)) {
        delete cache.scan[branchName];
      }
    });
  }
  const stats = extractStats(packageFiles);
  logger.info(
    { baseBranch: config.baseBranch, stats },
    `Dependency extraction complete`
  );
  logger.trace({ config: packageFiles }, 'packageFiles');
  return packageFiles;
}

export async function lookup(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>
): Promise<ExtractResult> {
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
  branches: BranchConfig[]
): Promise<WriteUpdateResult | undefined> {
  let res: WriteUpdateResult | undefined;
  // istanbul ignore else
  if (config.repoIsOnboarded) {
    res = await writeUpdates(config, branches);
  }

  return res;
}
