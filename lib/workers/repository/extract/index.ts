import is from '@sindresorhus/is';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type {
  ManagerConfig,
  MatchStringsStrategy,
  RegExManager,
  RenovateConfig,
} from '../../../config/types';
import { logger } from '../../../logger';
import { getManagerList } from '../../../modules/manager';
import type {
  ExtractConfig,
  PackageFile,
} from '../../../modules/manager/types';
import { getFileList } from '../../../util/git';
import { getMatchingFiles } from './file-match';
import { getManagerPackageFiles } from './manager-files';

export function narrowedConfig(
  config: ManagerConfig & Partial<RegExManager>
): ExtractConfig {
  return {
    manager: config.manager,
    fileMatch: config.fileMatch,
    updateInternalDeps: config.updateInternalDeps,
    includePaths: config.includePaths,
    ignorePaths: config.ignorePaths,
    regexManagers: config.regexManagers,
    enabledManagers: config.enabledManagers,
    enabled: config.enabled,
    registryAliases: config.registryAliases as Record<string, string>,
    npmrc: config.npmrc,
    npmrcMerge: config.npmrcMerge,
    skipInstalls: config.skipInstalls as boolean,
    autoReplaceStringTemplate: config.autoReplaceStringTemplate,
    matchStrings: config.matchStrings as string[],
    matchStringsStrategy: config.matchStringsStrategy as MatchStringsStrategy,
    depNameTemplate: config.depNameTemplate,
    packageNameTemplate: config.packageNameTemplate,
    datasourceTemplate: config.datasourceTemplate,
    versioningTemplate: config.versioningTemplate,
    depTypeTemplate: config.depTypeTemplate,
    currentValueTemplate: config.currentValueTemplate,
    currentDigestTemplate: config.currentDigestTemplate,
    extractVersionTemplate: config.extractVersionTemplate,
    registryUrlTemplate: config.registryUrlTemplate,
    fileList: config.fileList,
  };
}

export async function extractAllDependencies(
  config: RenovateConfig
): Promise<Record<string, PackageFile[]>> {
  let managerList = getManagerList();
  const { enabledManagers } = config;
  if (is.nonEmptyArray(enabledManagers)) {
    logger.debug('Applying enabledManagers filtering');
    managerList = managerList.filter((manager) =>
      enabledManagers.includes(manager)
    );
  }
  const extractList: ExtractConfig[] = [];
  const fileList = await getFileList();

  const tryConfig = (managerConfig: ManagerConfig): void => {
    const matchingFileList = getMatchingFiles(managerConfig, fileList);
    if (matchingFileList.length) {
      extractList.push({ ...managerConfig, fileList: matchingFileList });
    }
  };

  for (const manager of managerList) {
    const managerConfig = getManagerConfig(config, manager);
    managerConfig.manager = manager;
    if (manager === 'regex') {
      for (const regexManager of config.regexManagers ?? []) {
        tryConfig(mergeChildConfig(managerConfig, regexManager));
      }
    } else {
      tryConfig(managerConfig);
    }
  }

  const extractResults = await Promise.all(
    extractList.map(async (managerConfig) => {
      const packageFiles = await getManagerPackageFiles(managerConfig);
      return { manager: managerConfig.manager, packageFiles };
    })
  );
  const extractions: Record<string, PackageFile[]> = {};
  let fileCount = 0;
  for (const { manager, packageFiles } of extractResults) {
    if (packageFiles?.length) {
      fileCount += packageFiles.length;
      logger.debug(`Found ${manager} package files`);
      extractions[manager] = (extractions[manager] || []).concat(packageFiles);
    }
  }
  logger.debug(`Found ${fileCount} package file(s)`);

  // If enabledManagers is non-empty, check that each of them has at least one extraction.
  // If not, log a warning to indicate possible misconfiguration.
  if (is.nonEmptyArray(config.enabledManagers)) {
    for (const enabledManager of config.enabledManagers) {
      if (!(enabledManager in extractions)) {
        logger.debug(
          { manager: enabledManager },
          `Manager explicitly enabled in "enabledManagers" config, but found no results. Possible config error?`
        );
      }
    }
  }

  return extractions;
}
