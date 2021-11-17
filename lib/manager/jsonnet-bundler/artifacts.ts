import { dirname, join } from 'upath';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import { readLocalFile } from '../../util/fs';
import { getRepoStatus } from '../../util/git';
import { regEx } from '../../util/regex';
import { UpdateArtifact, UpdateArtifactsResult } from '../types';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, newPackageFileContent } = updateArtifact;
  logger.trace(`jsonnetfile.updateArtifacts(${packageFileName})`);
  logger.trace({ newPackageFileContent });

  const lockFileName = packageFileName.replace(regEx(/\.json$/), '.lock.json');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');

  if (!existingLockFileContent) {
    logger.debug('No jsonnetfile.lock.json found');
    return null;
  }

  const vendorDir = join(dirname(packageFileName), 'vendor/');

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
  };
  await exec('jb update', execOptions);

  const status = await getRepoStatus();

  if (!status.modified.includes(lockFileName)) {
    return null;
  }

  const res: UpdateArtifactsResult[] = [
    {
      file: {
        name: lockFileName,
        contents: await readLocalFile(lockFileName),
      },
    },
  ];

  for (const f of status.modified.concat(status.not_added)) {
    if (f.startsWith(vendorDir)) {
      res.push({
        file: {
          name: f,
          contents: await readLocalFile(f),
        },
      });
    }
  }
  for (const f of status.deleted || []) {
    res.push({
      file: {
        name: '|delete|',
        contents: f,
      },
    });
  }

  const finalPackageFileContent = await readLocalFile(packageFileName, 'utf8');
  if (finalPackageFileContent !== newPackageFileContent) {
    res.push({
      file: {
        name: packageFileName,
        contents: finalPackageFileContent,
      },
    });
  }

  return res;
}
