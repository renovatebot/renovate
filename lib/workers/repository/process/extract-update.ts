import is from '@sindresorhus/is';
import hasha from 'hasha';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { getManagerList, hashMap } from '../../../modules/manager';
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
  const { baseBranch } = config;
  const baseBranchSha = getBranchCommit(baseBranch);
  let packageFiles: Record<string, PackageFile[]>;
  const cache = getCache();
  cache.scan ||= {};
  const cachedExtract = cache.scan[baseBranch];
  const configHash = hasha(JSON.stringify(config));
  let managerList = getManagerList();
  if (is.nonEmptyArray(config.enabledManagers)) {
    managerList = managerList.filter((manager) =>
      config.enabledManagers.includes(manager)
    );
  }
  const options = { algorithm: 'sha256' };
  const fingerprint = hasha(
    managerList.reduce(
      (acc, manager) => hasha([acc, hashMap.get(manager)], options),
      configHash + baseBranchSha
    ),
    options
  );
  // istanbul ignore if
  if (
    cachedExtract?.fingerprint &&
    cachedExtract?.fingerprint === fingerprint
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
    await checkoutBranch(baseBranch);
    packageFiles = await extractAllDependencies(config);
    cache.scan[baseBranch] = {
      sha: baseBranchSha,
      configHash,
      packageFiles,
      fingerprint,
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
