import is from '@sindresorhus/is';
import {
  RenovateConfig,
  getManagerConfig,
  mergeChildConfig,
} from '../../../config';
import { logger } from '../../../logger';
import { getManagerList } from '../../../manager';
import { PackageFile } from '../../../manager/common';
import { getMatchingFiles } from './file-match';
import { getManagerPackageFiles } from './manager-files';

export async function extractAllDependencies(
  config: RenovateConfig
): Promise<Record<string, PackageFile[]>> {
  let managerList = getManagerList();
  if (is.nonEmptyArray(config.enabledManagers)) {
    logger.debug('Applying enabledManagers filtering');
    managerList = managerList.filter((manager) =>
      config.enabledManagers.includes(manager)
    );
  }
  const extractList: RenovateConfig[] = [];
  for (const manager of managerList) {
    const managerConfig = getManagerConfig(config, manager);
    managerConfig.manager = manager;
    if (manager === 'regex') {
      for (const regexManager of config.regexManagers) {
        const regexManagerConfig = mergeChildConfig(
          managerConfig,
          regexManager
        );
        regexManagerConfig.fileList = await getMatchingFiles(
          regexManagerConfig
        );
        if (regexManagerConfig.fileList.length) {
          extractList.push(regexManagerConfig);
        }
      }
    } else {
      managerConfig.fileList = await getMatchingFiles(managerConfig);
      if (managerConfig.fileList.length) {
        extractList.push(managerConfig);
      }
    }
  }
  const extractResults = [];
  for (const managerConfig of extractList) {
    const { manager } = managerConfig;
    const packageFiles = await getManagerPackageFiles(managerConfig);
    extractResults.push({ manager, packageFiles });
  }
  const extractions: Record<string, PackageFile[]> = {};
  let fileCount = 0;
  for (const { manager, packageFiles } of extractResults) {
    if (packageFiles && packageFiles.length) {
      fileCount += packageFiles.length;
      logger.debug(`Found ${manager} package files`);
      extractions[manager] = (extractions[manager] || []).concat(packageFiles);
    }
  }
  logger.debug(`Found ${fileCount} package file(s)`);
  return extractions;
}
