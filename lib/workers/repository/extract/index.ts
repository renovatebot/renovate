import { logger } from '../../../logger';
import { getManagerList } from '../../../manager';
import {
  getManagerConfig,
  mergeChildConfig,
  RenovateConfig,
} from '../../../config';
import { getManagerPackageFiles } from './manager-files';
import { PackageFile } from '../../../manager/common';

export async function extractAllDependencies(
  config: RenovateConfig
): Promise<Record<string, PackageFile[]>> {
  const extractions: Record<string, PackageFile[]> = {};
  let fileCount = 0;
  for (const manager of getManagerList()) {
    if (
      config.enabledManagers.length &&
      !config.enabledManagers.includes(manager)
    ) {
      logger.debug(`${manager} is not in enabledManagers list - skipping`);
      continue; // eslint-disable-line
    }
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
