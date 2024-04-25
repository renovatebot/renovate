import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { hashMap } from '../../../modules/manager';
import type { PackageFile } from '../../../modules/manager/types';
import { scm } from '../../../modules/platform/scm';
import { getCache } from '../../../util/cache/repository';
import type { BaseBranchCache } from '../../../util/cache/repository/types';
import { checkGithubToken as ensureGithubToken } from '../../../util/check-token';
import { fingerprint } from '../../../util/fingerprint';
import type { BranchConfig } from '../../types';
import { extractAllDependencies } from '../extract';
import { generateFingerprintConfig } from '../extract/extract-fingerprint-config';
import { branchifyUpgrades } from '../updates/branchify';
import { raiseDeprecationWarnings } from './deprecated';
import { fetchUpdates } from './fetch';
import { sortBranches } from './sort';
import { Vulnerabilities } from './vulnerabilities';
import { WriteUpdateResult, writeUpdates } from './write';

export interface ExtractResult {
  branches: BranchConfig[];
  branchList: string[];
  packageFiles: Record<string, PackageFile[]>;
}

export interface StatsResult {
  fileCount: number;
  depCount: number;
}

export interface Stats {
  managers: Record<string, StatsResult>;
  total: StatsResult;
}

// istanbul ignore next
function extractStats(
  packageFiles: Record<string, PackageFile[]>,
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

export function isCacheExtractValid(
  baseBranchSha: string,
  configHash: string,
  cachedExtract?: BaseBranchCache,
): boolean {
  if (!(cachedExtract?.sha && cachedExtract.configHash)) {
    return false;
  }
  if (cachedExtract.sha !== baseBranchSha) {
    logger.debug(
      `Cached extract result cannot be used due to base branch SHA change (old=${cachedExtract.sha}, new=${baseBranchSha})`,
    );
    return false;
  }
  if (cachedExtract.configHash !== configHash) {
    logger.debug('Cached extract result cannot be used due to config change');
    return false;
  }
  if (!cachedExtract.extractionFingerprints) {
    logger.debug(
      'Cached extract is missing extractionFingerprints, so cannot be used',
    );
    return false;
  }
  const changedManagers = new Set();
  for (const [manager, fingerprint] of Object.entries(
    cachedExtract.extractionFingerprints,
  )) {
    if (fingerprint !== hashMap.get(manager)) {
      changedManagers.add(manager);
    }
  }
  if (changedManagers.size > 0) {
    logger.debug(
      { changedManagers: [...changedManagers] },
      'Manager fingerprint(s) have changed, extract cache cannot be reused',
    );
    return false;
  }
  logger.debug(
    `Cached extract for sha=${baseBranchSha} is valid and can be used`,
  );
  return true;
}

export async function extract(
  config: RenovateConfig,
): Promise<Record<string, PackageFile[]>> {
  logger.debug('extract()');
  const { baseBranch } = config;
  const baseBranchSha = await scm.getBranchCommit(baseBranch!);
  let packageFiles: Record<string, PackageFile[]>;
  const cache = getCache();
  cache.scan ||= {};
  const cachedExtract = cache.scan[baseBranch!];
  const configHash = fingerprint(generateFingerprintConfig(config));
  // istanbul ignore if
  if (isCacheExtractValid(baseBranchSha!, configHash, cachedExtract)) {
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
    await scm.checkoutBranch(baseBranch!);
    const extractResult = (await extractAllDependencies(config)) || {};
    packageFiles = extractResult.packageFiles;
    const { extractionFingerprints } = extractResult;
    // TODO: fix types (#22198)
    cache.scan[baseBranch!] = {
      sha: baseBranchSha!,
      configHash,
      extractionFingerprints,
      packageFiles,
    };
    // Clean up cached branch extracts
    const baseBranches = is.nonEmptyArray(config.baseBranches)
      ? config.baseBranches
      : [baseBranch];
    Object.keys(cache.scan).forEach((branchName) => {
      if (!baseBranches.includes(branchName)) {
        delete cache.scan![branchName];
      }
    });
  }
  const stats = extractStats(packageFiles);
  logger.info(
    { baseBranch: config.baseBranch, stats },
    `Dependency extraction complete`,
  );
  logger.trace({ config: packageFiles }, 'packageFiles');
  ensureGithubToken(packageFiles);
  return packageFiles;
}

async function fetchVulnerabilities(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
): Promise<void> {
  if (config.osvVulnerabilityAlerts) {
    logger.debug('fetchVulnerabilities() - osvVulnerabilityAlerts=true');
    try {
      const vulnerabilities = await Vulnerabilities.create();
      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
    } catch (err) {
      logger.warn({ err }, 'Unable to read vulnerability information');
    }
  }
}

export async function lookup(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
): Promise<ExtractResult> {
  await fetchVulnerabilities(config, packageFiles);
  await fetchUpdates(config, packageFiles);
  await raiseDeprecationWarnings(config, packageFiles);
  const { branches, branchList } = await branchifyUpgrades(
    config,
    packageFiles,
  );
  logger.debug(
    { baseBranch: config.baseBranch, config: packageFiles },
    'packageFiles with updates',
  );
  sortBranches(branches);
  return { branches, branchList, packageFiles };
}

export async function update(
  config: RenovateConfig,
  branches: BranchConfig[],
): Promise<WriteUpdateResult | undefined> {
  let res: WriteUpdateResult | undefined;
  // istanbul ignore else
  if (config.repoIsOnboarded) {
    res = await writeUpdates(config, branches);
  }

  return res;
}
