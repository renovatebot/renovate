import is from '@sindresorhus/is';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { ManagerConfig, RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { getManagerList, hashMap } from '../../../modules/manager';
import { scm } from '../../../modules/platform/scm';
import type { ExtractResult, WorkerExtractConfig } from '../../types';
import { getMatchingFiles } from './file-match';
import { getManagerPackageFiles } from './manager-files';

export async function extractAllDependencies(
  config: RenovateConfig
): Promise<ExtractResult> {
  let managerList = getManagerList();
  const { enabledManagers } = config;
  if (is.nonEmptyArray(enabledManagers)) {
    logger.debug('Applying enabledManagers filtering');
    managerList = managerList.filter((manager) =>
      enabledManagers.includes(manager)
    );
  }
  const extractList: WorkerExtractConfig[] = [];
  const fileList = await scm.getFileList();

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

  const extractResult: ExtractResult = {
    packageFiles: {},
    extractionFingerprints: {},
  };

  // Store the fingerprint of all managers which match any file (even if they do not find any dependencies)
  // The cached result needs to be invalidated if the fingerprint of any matching manager changes
  for (const { manager } of extractList) {
    extractResult.extractionFingerprints[manager] = hashMap.get(manager);
  }

  const extractDurations: Record<string, number> = {};
  const extractResults = await Promise.all(
    extractList.map(async (managerConfig) => {
      const start = Date.now();
      const packageFiles = await getManagerPackageFiles(managerConfig);
      const durationMs = Math.round(Date.now() - start);
      extractDurations[managerConfig.manager] = durationMs;
      return { manager: managerConfig.manager, packageFiles };
    })
  );
  logger.debug(
    { managers: extractDurations },
    'manager extract durations (ms)'
  );
  let fileCount = 0;
  for (const { manager, packageFiles } of extractResults) {
    if (packageFiles?.length) {
      fileCount += packageFiles.length;
      logger.debug(`Found ${manager} package files`);
      extractResult.packageFiles[manager] = (
        extractResult.packageFiles[manager] || []
      ).concat(packageFiles);
    }
  }
  logger.debug(`Found ${fileCount} package file(s)`);

  // If enabledManagers is non-empty, check that each of them has at least one extraction.
  // If not, log a warning to indicate possible misconfiguration.
  if (is.nonEmptyArray(config.enabledManagers)) {
    for (const enabledManager of config.enabledManagers) {
      if (!(enabledManager in extractResult.packageFiles)) {
        logger.debug(
          { manager: enabledManager },
          `Manager explicitly enabled in "enabledManagers" config, but found no results. Possible config error?`
        );
      }
    }
  }

  return extractResult;
}
