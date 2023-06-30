import type { StatusResult } from 'simple-git';
import upath from 'upath';
import type { ProgrammingLanguage } from '../../../constants';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecResult } from '../../../util/exec/types';
import { readLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export const supportsLockFileMaintenance = true;
export const language: ProgrammingLanguage = 'java';

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  try {
    // Log the updated dependencies
    logger.debug({ updatedDeps }, 'maven-lockfile.updateArtifacts()');

    // Check if any Maven dependencies were updated
    if (!updatedDeps.some((dep) => dep.datasource === 'maven')) {
      logger.info(
        'No Maven dependency version updated - skipping Artifacts update'
      );
      return null;
    }

    // Set the current working directory for the `exec` command
    const execOptions = {
      cwd: upath.resolve(upath.dirname(packageFileName)),
    };

    // Generate the Maven lockfile using the `mvn` command
    const cmd = 'mvn io.github.chains-project:maven-lockfile:3.4.1:generate';
    const result: ExecResult = await exec(cmd, execOptions);
    logger.info({ result }, 'maven-lockfile.updateArtifacts() result');

    // Get the repository status
    const status = await getRepoStatus();
    // Add the updated lockfile to the array of updated artifacts
    const res: UpdateArtifactsResult[] = await addUpdatedLockfiles(status);
    return res;
  } catch (err) {
    logger.error({ err }, 'maven-lockfile.updateArtifacts() error');
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

async function addUpdatedLockfiles(
  status: StatusResult
): Promise<UpdateArtifactsResult[]> {
  const res: UpdateArtifactsResult[] = [];
  for (const f of [...status.modified]) {
    logger.info(`modified: ${f}`);
    if (/.*\/lockfile.json/.exec(f)) {
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
}
