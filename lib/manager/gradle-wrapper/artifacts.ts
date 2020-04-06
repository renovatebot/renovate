/* istanbul ignore file */
import Git from 'simple-git/promise';
import { resolve } from 'path';
import * as fs from 'fs-extra';
import { logger } from '../../logger';
import {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../common';
import { exec, ExecOptions } from '../../util/exec';
import { platform } from '../../platform';
import { VERSION_REGEX } from './search';
import { gradleWrapperFileName, prepareGradleCommand } from '../gradle';
import { readLocalFile } from '../../util/fs';

async function addIfUpdated(
  config: UpdateArtifactsConfig,
  status: Git.StatusResult,
  fileProjectPath: string
): Promise<UpdateArtifactsResult | null> {
  if (status.modified.includes(fileProjectPath)) {
    const rawFileContents = await readLocalFile(fileProjectPath);
    let fileContents;
    if (fileProjectPath.endsWith('.jar')) {
      fileContents = rawFileContents;
    } else {
      fileContents = rawFileContents.toString('utf8');
    }
    return {
      artifactError: null,
      file: {
        name: fileProjectPath,
        contents: fileContents,
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
          'gradle/wrapper/gradle-wrapper.properties',
          'gradle/wrapper/gradle-wrapper.jar',
          'gradlew',
          'gradlew.bat',
        ].map(async fileProjectPath =>
          addIfUpdated(config, status, fileProjectPath)
        )
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
