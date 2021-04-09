import {
  RenovateConfig,
  getManagerConfig,
  mergeChildConfig,
} from '../../../config';
import { logger } from '../../../logger';
import { getManagerList } from '../../../manager';
import type { PackageFile } from '../../../manager/types';
import { getFileList } from '../../../util/git';
import { getMatchingFiles } from './file-match';
import { getManagerPackageFiles } from './manager-files';

export async function extractAllDependencies(
  config: RenovateConfig
): Promise<Record<string, PackageFile[]>> {
  const managerList = getManagerList();
  const extractList: RenovateConfig[] = [];
  const fileList = await getFileList();

  const tryConfig = (extractConfig: RenovateConfig): void => {
    if (extractConfig.enabled === false) {
      return;
    }

    const matchingFileList = getMatchingFiles(extractConfig, fileList);
    if (matchingFileList.length) {
      extractList.push(
        mergeChildConfig(extractConfig, { fileList: matchingFileList })
      );
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
