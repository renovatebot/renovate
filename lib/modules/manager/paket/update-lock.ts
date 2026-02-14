import { logger } from '../../../logger/index.ts';
import { getLocalFiles } from '../../../util/fs/index.ts';
import { getFiles } from '../../../util/git/index.ts';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types.ts';
import { runPaketUpdate } from './tool.ts';

export async function updateLockedDependency(
  config: UpdateLockedConfig,
): Promise<UpdateLockedResult> {
  logger.debug(`paket.updateLockedDependency(${config.lockFile}})`);

  const existingLockFileContentMap = await getFiles([config.lockFile]);

  await runPaketUpdate({
    filePath: config.lockFile,
    packageName: config.depName,
    version: config.newVersion,
  });

  const newLockFileContentMap = await getLocalFiles([config.lockFile]);
  const newLockFileContent = newLockFileContentMap[config.lockFile];
  if (
    existingLockFileContentMap[config.lockFile] === newLockFileContent ||
    !newLockFileContent
  ) {
    logger.debug(`Lock file ${config.lockFile} is unchanged`);
    return { status: 'already-updated' };
  }

  return {
    status: 'updated',
    files: { [config.lockFile]: newLockFileContent },
  };
}
