import is from '@sindresorhus/is';
import {
  RenovateConfig,
  getManagerConfig,
  mergeChildConfig,
} from '../../../config';
import { logger } from '../../../logger';
import { getManagerList } from '../../../manager';
import { PackageFile } from '../../../manager/common';
import { getManagerPackageFiles } from './manager-files';

export async function extractAllDependencies(
  config: RenovateConfig
): Promise<Record<string, PackageFile[]>> {
  const extractions: Record<string, PackageFile[]> = {};
  let fileCount = 0;
  let managerList = getManagerList();
  if (is.nonEmptyArray(config.enabledManagers)) {
    logger.debug('Applying enabledManagers filtering');
    managerList = managerList.filter((manager) =>
      config.enabledManagers.includes(manager)
    );
  }
  for (const manager of managerList) {
    const managerConfig = getManagerConfig(config, manager);
    let packageFiles = [];
    if (manager === 'regex') {
      for (const regexManager of config.regexManagers) {
        const regexManagerConfig = mergeChildConfig(
          managerConfig,
          regexManager
        );
        const customPackageFiles = await getManagerPackageFiles(
          regexManagerConfig
        );
        if (customPackageFiles) {
          packageFiles = packageFiles.concat(customPackageFiles);
        }
      }
    } else {
      packageFiles = await getManagerPackageFiles(managerConfig);
    }
    managerConfig.manager = manager;
    if (packageFiles && packageFiles.length) {
      fileCount += packageFiles.length;
      logger.debug(`Found ${manager} package files`);
      extractions[manager] = packageFiles;
    }
  }
  logger.debug(`Found ${fileCount} package file(s)`);
  return extractions;
}
