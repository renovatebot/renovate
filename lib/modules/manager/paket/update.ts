import { logger } from '../../../logger/index.ts';
import { getLocalFiles, getSiblingFileName } from '../../../util/fs/index.ts';
import { getFiles } from '../../../util/git/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { runPaketUpdateForAllPackages } from './tool.ts';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`paket.updateArtifacts(${updateArtifact.packageFileName})`);

  const lockFileName = getSiblingFileName(
    updateArtifact.packageFileName,
    'paket.lock',
  );
  const existingLockFileContentMap = await getFiles([lockFileName]);

  await runPaketUpdateForAllPackages(lockFileName);

  const newLockFileContentMap = await getLocalFiles([lockFileName]);

  if (
    existingLockFileContentMap[lockFileName] ===
    newLockFileContentMap[lockFileName]
  ) {
    logger.debug(`Lock file ${lockFileName} is unchanged`);
    return null;
  }

  return [
    {
      file: {
        type: 'addition',
        path: lockFileName,
        contents: newLockFileContentMap[lockFileName],
      },
    },
  ];
}
