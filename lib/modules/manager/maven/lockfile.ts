import { glob } from 'glob';
import type { StatusResult } from 'simple-git';
import upath from 'upath';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecResult } from '../../../util/exec/types';
import { readLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  try {
    // Check if any Maven dependencies were updated
    if (!updatedDeps.some((dep) => dep.datasource === 'maven')) {
      logger.debug(
        'No Maven dependency version updated - skipping Artifacts update'
      );
      return null;
    }
    const parent = upath.dirname(packageFileName);
    const parentDir = upath.resolve(parent);
    const files = await getLockfileJsonFiles(parentDir);

    // Check if any files were found
    if (files.length > 0) {
      logger.info(`Found ${files.length} lockfile.json files`);
      const execOptions = {
        cwd: parentDir,
      };
      const maven_lockfile_version = await getLockfileVersion(parentDir);
      // Generate the Maven lockfile using the `mvn` command
      const cmd = `mvn io.github.chains-project:maven-lockfile:${maven_lockfile_version}:generate`;
      const result: ExecResult = await exec(cmd, execOptions);
      logger.trace({ result }, 'maven-lockfile.updateArtifacts() result');
      const status = await getRepoStatus();
      const res: UpdateArtifactsResult[] = await addUpdatedLockfiles(status);
      return res;
    } else {
      logger.debug('No lockfile.json files found');
      return null;
    }
  } catch (err) {
    logger.error({ err }, 'maven-lockfile.updateArtifacts() error');
    return [
      {
        artifactError: {
          stderr: err.stdout || err.message,
        },
      },
    ];
  }
}

/**
 * Returns a `Promise<UpdateArtifactsResult[]>` of updated lockfile.json files.<br>
 *
 * Only modified files are added to the result not created files.
 * If there was no preexisting lockfile we assume this was a decision by the developer.
 * @param status The `StatusResult` object returned by `simple-git`.
 * @returns A `Promise<UpdateArtifactsResult[]>` of updated lockfile.json files.
 */
async function addUpdatedLockfiles(
  status: StatusResult
): Promise<UpdateArtifactsResult[]> {
  const res: UpdateArtifactsResult[] = [];
  for (const f of filterLockfileJsonFiles(status.modified)) {
    logger.trace(`lockfile.json updated`);
    res.push({
      file: {
        type: 'addition',
        path: f,
        contents: await readLocalFile(f),
      },
    });
  }
  return res;
}
/**
 * Returns a `Promise<string[]>` of `lockfile.json` files. If the array is empty, no files were found.
 * @param directoryPath the directory to start the search from
 * @returns a `Promise<string[]>` of `lockfile.json` files, empty if none were found.
 */
function getLockfileJsonFiles(directoryPath: string): Promise<string[]> {
  return glob('**/lockfile.json', { cwd: directoryPath });
}
/**
 * Returns the version of the maven-lockfile plugin used in the project. 
 * For this the `lockfile.json` file is read and the version is extracted from the `metaData.config.mavenLockfileVersion` field.
 *
 * @param {string} folder - The folder to check. This should be the parent folder of the `pom.xml` file.
 * @returns {Promise<string>} The version of the maven-lockfile plugin used in the project.
 */
async function getLockfileVersion(folder: string): Promise<string> {
  var lockFiles : string[] = await getLockfileJsonFiles(folder);
    if (lockFiles.length > 0) {
      const fileContent = await readLocalFile(lockFiles[0]);
      if (!fileContent) {
        throw new Error('Could not read lockfile.json');
      }
      const json = JSON.parse(fileContent.toString());
      const version = json.metaData.config.mavenLockfileVersion;
      return version;
    } else {
      throw new Error('No lockfile.json files found. Cant get the correct version of maven-lockfile plugin');
    }
  }
/**
 * Filters the file paths to only include `lockfile.json` files
 * @param filePaths The file paths to filter
 * @returns The filtered file paths
 */
function filterLockfileJsonFiles(filePaths: string[]): string[] {
  if (!filePaths) {
    return [];
  }
  return filePaths.filter((filePath) => {
    const fileName = upath.basename(filePath);
    return fileName === 'lockfile.json';
  });
}
