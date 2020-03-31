import Git from 'simple-git/promise';
import { resolve } from 'path';
import { logger } from '../../logger';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';
import { exec } from '../../util/exec';
import { readLocalFile } from '../../util/fs';
import { platform } from '../../platform';
import { VERSION_REGEX } from './search';

async function addIfUpdated(
  status: Git.StatusResult,
  filePath: string
): Promise<UpdateArtifactsResult | null> {
  if (status.modified.includes(filePath)) {
    return {
      artifactError: null,
      file: {
        name: filePath,
        contents: await readLocalFile(filePath),
      },
    };
  }
  return null;
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  try {
    const projectDir = resolve(packageFileName, './../../../');
    logger.debug(updatedDeps, 'gradle-wrapper.updateArtifacts()');
    const gradlew = resolve(projectDir, './gradlew');
    const version = VERSION_REGEX.exec(newPackageFileContent).groups.version;
    const execStr = `${gradlew} wrapper --gradle-version ${version} --project-dir ${projectDir}`;
    logger.debug(`Updating gradle wrapper: "${execStr}"`);
    await exec(execStr);
    const status = await platform.getRepoStatus();
    const updateArtifactsResult = (
      await Promise.all(
        [
          resolve(projectDir, './gradle/wrapper/gradle-wrapper.properties'),
          resolve(projectDir, './gradle/wrapper/gradle-wrapper.jar'),
          gradlew,
          resolve(projectDir, './gradlew.bat'),
        ].map(async filePath => addIfUpdated(status, filePath))
      )
    ).filter(e => e != null);
    logger.debug(
      `Returning updated gradle-wrapper files: ${updateArtifactsResult}`
    );
    return updateArtifactsResult;
  } catch (err) {
    logger.debug({ err }, 'Error setting new Gradle Wrapper release value');
    return null;
  }
}
