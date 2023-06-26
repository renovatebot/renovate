import upath from 'upath';
import type { ProgrammingLanguage } from '../../../constants';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import { readLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

// key feature of maven-lockfile is to provide a way to maintain a lockfile
export const supportsLockFileMaintenance = true;
export const language: ProgrammingLanguage = 'java';

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  try {
    logger.debug({ updatedDeps }, 'maven-lockfile.updateArtifacts()');

    if (!updatedDeps.some((dep) => dep.datasource === 'maven')) {
      logger.info(
        'No Maven dependency version updated - skipping Artifacts update'
      );
      throw new Error(
        'No Maven dependency version updated - skipping Artifacts update'
      );
    }
    const execOptions = {
      cwd: upath.resolve(upath.dirname(packageFileName)),
    };
    const cmd = 'mvn io.github.chains-project:maven-lockfile:3.4.1:generate';
    const result = await exec(cmd, execOptions);
    logger.info({ result }, 'maven-lockfile.updateArtifacts() result');
    const status = await getRepoStatus();
    const res: UpdateArtifactsResult[] = [];

    for (const f of [...status.modified]) {
      logger.info(`modified: ${f}`);
      if (f.match('**/lockfile.json')) {
        logger.info(`lockfile.json updated`);
        res.push({
          file: {
            type: 'addition',
            path: f,
            contents: await readLocalFile(f),
          },
        });
      }
    }
    return res;
  } catch (err) {
    logger.debug({ err }, 'Error updating maven-lockfile');
    return [
      {
        artifactError: {
          lockFile: packageFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
