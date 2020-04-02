import Git from 'simple-git/promise';
import { resolve } from 'path';
import * as fs from 'fs-extra';
import { logger } from '../../logger';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';
import { exec, ExecOptions } from '../../util/exec';
import { readLocalFile } from '../../util/fs';
import { platform } from '../../platform';
import { VERSION_REGEX } from './search';
import { gradleWrapperFileName, prepareGradleCommand } from '../gradle/index';

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
    const projectDir = config.localDir;
    logger.debug(updatedDeps, 'gradle-wrapper.updateArtifacts()');
    const gradlewPath = resolve(
      projectDir,
      `./${gradleWrapperFileName(config)}`
    );
    const version = VERSION_REGEX.exec(newPackageFileContent).groups.version;
    await prepareGradleCommand(
      gradleWrapperFileName(config),
      projectDir,
      await fs.stat(gradlewPath).catch(() => null),
      null
    );
    const cmd = `${gradlewPath} wrapper --gradle-version ${version} --project-dir ${projectDir}`;
    logger.debug(`Updating gradle wrapper: "${cmd}"`);
    const execOptions: ExecOptions = {
      cwd: config.localDir,
      docker: {
        image: 'renovate/gradle',
      },
    };
    try {
      await exec(cmd, execOptions);
    } catch (err) /* istanbul ignore next */ {
      logger.warn(
        { err },
        'Error executing gradle wrapper update command. It can be not a critical one though.'
      );
    }
    const status = await platform.getRepoStatus();
    const updateArtifactsResult = (
      await Promise.all(
        [
          resolve(projectDir, './gradle/wrapper/gradle-wrapper.properties'),
          resolve(projectDir, './gradle/wrapper/gradle-wrapper.jar'),
          resolve(projectDir, './gradlew'),
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
    return [
      {
        artifactError: {
          lockFile: packageFileName,
          stderr: err.stdout + '\n' + err.stderr,
        },
      },
    ];
  }
}
