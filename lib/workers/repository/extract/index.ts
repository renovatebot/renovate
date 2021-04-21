import is from '@sindresorhus/is';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { getManagerList } from '../../../manager';
import type { PackageFile } from '../../../manager/types';
import { getFileList } from '../../../util/git';
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
  const fileList = await getFileList();

  const tryConfig = (extractConfig: RenovateConfig): void => {
    const matchingFileList = getMatchingFiles(extractConfig, fileList);
    if (matchingFileList.length) {
      extractList.push({ ...extractConfig, fileList: matchingFileList });
    }
  };

  for (const manager of managerList) {
    const managerConfig = getManagerConfig(config, manager);
    managerConfig.manager = manager;
    if (manager === 'regex') {
      for (const regexManager of config.regexManagers) {
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
  return extractions;
}
