import { logger } from '../../../logger/index.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { runPaketUpdate } from './tool.ts';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`paket.updateArtifacts(${updateArtifact.packageFileName})`);

  const lockFileName = getSiblingFileName(
    updateArtifact.packageFileName,
    'paket.lock',
  );
  const existingLockFileContent = await readLocalFile(lockFileName);

  await runPaketUpdate({ filePath: lockFileName });

  const newLockFileContent = await readLocalFile(lockFileName);

  if (existingLockFileContent === newLockFileContent) {
    logger.debug(`Lock file ${lockFileName} is unchanged`);
    return null;
  }

  return [
    {
      file: {
        type: 'addition',
        path: lockFileName,
        contents: newLockFileContent,
      },
    },
  ];
}
