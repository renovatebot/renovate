import { logger } from '../../../logger';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { newlineRegex } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { parseLine } from './extract';
import type { ManagerData, ParsedLine } from './types';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`carthage.getArtifacts(${packageFileName})`);

  if (updatedDeps.length < 1) {
    logger.debug('Carthage: empty update - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'Cartfile.resolved');

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
  } catch (err) {
    logger.warn({ err }, 'Cartfile could not be written');
    return [
      {
        artifactError: {
          lockFile: packageFileName,
          stderr: err.message,
        },
      },
    ];
  }

  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug(`Lockfile not found: ${lockFileName}`);
    return null;
  }

  const packageFileLines = newPackageFileContent.split(newlineRegex);
  const lockFileLines = existingLockFileContent.split(newlineRegex);

  for (const update of updatedDeps) {
    // istanbul ignore if: should never happen
    if (!update.managerData || !update.newVersion) {
      continue;
    }

    const managerData = update.managerData as unknown as ManagerData;
    const packageLine = packageFileLines[managerData.lineNumber];
    const parsedLine = parseLine(packageLine);
    const { type, url }: ParsedLine = parsedLine;
    const search = `${type} "${url}" "`;
    lockFileLines.forEach((lockFileLine, index, array) => {
      if (lockFileLine.startsWith(search)) {
        array[index] = `${type} "${url}" "${update.newVersion}"`;
      }
    });
  }

  const newLockFileContent = lockFileLines.join('\n');

  try {
    await writeLocalFile(lockFileName, newLockFileContent);
  } catch (err) {
    logger.warn({ err }, 'Cartfile.resolved could not be written');
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }

  const res: UpdateArtifactsResult[] = [
    {
      file: {
        type: 'addition',
        path: lockFileName,
        contents: newLockFileContent,
      },
    },
  ];

  return res;
}
