import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types.ts';
import { runPaketUpdate } from './tool.ts';

export async function updateLockedDependency(
  config: UpdateLockedConfig,
): Promise<UpdateLockedResult> {
  logger.debug(`paket.updateLockedDependency(${config.lockFile}})`);

  const existingLockFileContent = await readLocalFile(config.lockFile, 'utf8');

  await runPaketUpdate({
    filePath: config.lockFile,
    packageName: config.depName,
    version: config.newVersion,
  });

  const newLockFileContent = await readLocalFile(config.lockFile, 'utf8');
  if (existingLockFileContent === newLockFileContent || !newLockFileContent) {
    logger.debug(`Lock file ${config.lockFile} is unchanged`);
    return { status: 'already-updated' };
  }

  return {
    status: 'updated',
    files: { [config.lockFile]: newLockFileContent },
  };
}
