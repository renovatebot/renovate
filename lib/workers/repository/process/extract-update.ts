import is from '@sindresorhus/is';
import hasha from 'hasha';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { PackageFile } from '../../../modules/manager/types';
import { getCache } from '../../../util/cache/repository';
import { checkoutBranch, getBranchCommit } from '../../../util/git';
import type { BranchConfig } from '../../types';
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

interface StatsResult {
  fileCount: number;
  depCount: number;
}

interface Stats {
  managers: Record<string, StatsResult>;
  total: StatsResult;
}

// istanbul ignore next
function extractStats(
  packageFiles: Record<string, PackageFile[]>
): Stats | null {
  if (!packageFiles) {
    return null;
  }
  const stats: Stats = {
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
  const { baseBranch } = config;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const baseBranchSha = getBranchCommit(baseBranch!);
  let packageFiles: Record<string, PackageFile[]>;
  const cache = getCache();
  cache.scan ||= {};
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const cachedExtract = cache.scan[baseBranch!];
  const configHash = hasha(JSON.stringify(config));
  // istanbul ignore if
  if (
    cachedExtract?.sha === baseBranchSha &&
    cachedExtract?.configHash === configHash
  ) {
    logger.debug({ baseBranch, baseBranchSha }, 'Found cached extract');
    packageFiles = cachedExtract.packageFiles;
    try {
      for (const files of Object.values(packageFiles)) {
        for (const file of files) {
          for (const dep of file.deps) {
            delete dep.updates;
          }
        }
      }
      logger.debug('Deleted cached dep updates');
    } catch (err) {
      logger.info({ err }, 'Error deleting cached dep updates');
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    await checkoutBranch(baseBranch!);
    packageFiles = await extractAllDependencies(config);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    cache.scan[baseBranch!] = {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      sha: baseBranchSha!,
      configHash,
      packageFiles,
    };
    // Clean up cached branch extracts
    const baseBranches = is.nonEmptyArray(config.baseBranches)
      ? config.baseBranches
      : [baseBranch];
    Object.keys(cache.scan).forEach((branchName) => {
      if (!baseBranches.includes(branchName)) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        delete cache.scan![branchName];
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
  await raiseDeprecationWarnings(config, packageFiles);
  const { branches, branchList } = await branchifyUpgrades(
    config,
    packageFiles
  );
  logger.debug({ config: packageFiles }, 'packageFiles with updates');
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
