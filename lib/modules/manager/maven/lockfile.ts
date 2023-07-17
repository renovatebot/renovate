import util from 'util';
import glob from 'glob';
import type { StatusResult } from 'simple-git';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecResult } from '../../../util/exec/types';
import { readLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

const maven_lockfile_version = '4.0.0';
export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  try {
    // Log the updated dependencies
    logger.trace({ updatedDeps }, 'maven-lockfile.updateArtifacts()');
    // Check if any Maven dependencies were updated
    if (!updatedDeps.some((dep) => dep.datasource === 'maven')) {
      logger.debug(
        'No Maven dependency version updated - skipping Artifacts update'
      );
      return null;
    }

    // Set the current working directory for the `glob` search
    const cwd = await getPackageFileName(packageFileName);

    // Search for files that match `lockfile.json`
    const files = glob.sync('**/lockfile.json', { cwd });

    // Check if any files were found
    if (files.length > 0) {
      logger.info(`Found ${files.length} lockfile.json files`);
      // Do something with the files...
      const execOptions = {
        cwdFile: cwd,
      };
      // Generate the Maven lockfile using the `mvn` command
      const cmd = 
        `mvn io.github.chains-project:maven-lockfile:${maven_lockfile_version}:generate`;
      const result: ExecResult = await exec(cmd, execOptions);
      logger.trace({ result }, 'maven-lockfile.updateArtifacts() result');
      const status = await getRepoStatus();
      const res: UpdateArtifactsResult[] = await addUpdatedLockfiles(status);
      return res;
    } else {
      logger.debug('No lockfile.json files found');
      //TODO: lookup if JS developers prefer to reject or resolve with null
      return null;
    }
  } catch (err) {
    logger.error({ err }, 'maven-lockfile.updateArtifacts() error');
    return Promise.reject(err);
  }
}

async function addUpdatedLockfiles(
  status: StatusResult
): Promise<UpdateArtifactsResult[]> {
  const res: UpdateArtifactsResult[] = [];
  for (const f of [...status.modified]) {
    if (/.*\/lockfile.json/.exec(f)) {
      logger.trace(`lockfile.json updated`);
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

function getPackageFileName(
  packageFileName: string | null
): Promise<string> | never {
  if (packageFileName) {
    return Promise.resolve(packageFileName);
  }
  throw new Error('Error, packageFileName is null');
}
