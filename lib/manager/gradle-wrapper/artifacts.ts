import Git from 'simple-git/promise';
import { resolve } from 'path';
import * as fs from 'fs-extra';
import { logger } from '../../logger';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';
import { exec, ExecOptions } from '../../util/exec';
import { readLocalFile } from '../../util/fs';
import { platform } from '../../platform';
import { gradleWrapperFileName, prepareGradleCommand } from '../gradle/index';

async function addIfUpdated(
  status: Git.StatusResult,
  fileProjectPath: string
): Promise<UpdateArtifactsResult | null> {
  if (status.modified.includes(fileProjectPath)) {
    return {
      file: {
        name: fileProjectPath,
        contents: await readLocalFile(fileProjectPath),
      },
    };
  }
  return null;
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  try {
    const projectDir = config.localDir;
    logger.debug({ updatedDeps }, 'gradle-wrapper.updateArtifacts()');
    const gradlew = gradleWrapperFileName(config);
    const gradlewPath = resolve(projectDir, `./${gradlew}`);
    const cmd = await prepareGradleCommand(
      gradlew,
      projectDir,
      await fs.stat(gradlewPath).catch(() => null),
      `wrapper --gradle-version ${config.toVersion}`
    );
    logger.debug(`Updating gradle wrapper: "${cmd}"`);
    const execOptions: ExecOptions = {
      docker: {
        image: 'renovate/gradle',
      },
    };
    try {
      await exec(cmd, execOptions);
    } catch (err) {
      logger.warn(
        { err },
        'Error executing gradle wrapper update command. It can be not a critical one though.'
      );
    }
    const status = await platform.getRepoStatus();
    const updateArtifactsResult = (
      await Promise.all(
        [
          'gradle/wrapper/gradle-wrapper.properties',
          'gradle/wrapper/gradle-wrapper.jar',
          'gradlew',
          'gradlew.bat',
        ].map(async fileProjectPath => addIfUpdated(status, fileProjectPath))
      )
    ).filter(e => e != null);
    logger.debug(
      { files: updateArtifactsResult.map(r => r.file.name) },
      `Returning updated gradle-wrapper files`
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
