import { stat } from 'fs-extra';
import { resolve } from 'upath';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import { readLocalFile, writeLocalFile } from '../../util/fs';
import { StatusResult, getRepoStatus } from '../../util/git';
import { Http } from '../../util/http';
import {
  extraEnv,
  gradleWrapperFileName,
  prepareGradleCommand,
} from '../gradle/utils';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

const http = new Http('gradle-wrapper');

async function addIfUpdated(
  status: StatusResult,
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

function getDistributionUrl(newPackageFileContent: string): string {
  const distributionUrlLine = newPackageFileContent
    .split('\n')
    .find((line) => line.startsWith('distributionUrl='));
  if (distributionUrlLine) {
    return distributionUrlLine
      .replace('distributionUrl=', '')
      .replace('https\\:', 'https:');
  }
  return null;
}

async function getDistributionChecksum(url: string): Promise<string> {
  const { body } = await http.get(`${url}.sha256`);
  return body;
}

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  try {
    const projectDir = config.localDir;
    logger.debug({ updatedDeps }, 'gradle-wrapper.updateArtifacts()');
    const gradlew = gradleWrapperFileName(config);
    const gradlewPath = resolve(projectDir, `./${gradlew}`);
    let cmd = await prepareGradleCommand(
      gradlew,
      projectDir,
      await stat(gradlewPath).catch(() => null),
      `wrapper`
    );
    if (!cmd) {
      logger.info('No gradlew found - skipping Artifacts update');
      return null;
    }
    const distributionUrl = getDistributionUrl(newPackageFileContent);
    if (distributionUrl) {
      cmd += ` --gradle-distribution-url ${distributionUrl}`;
      if (newPackageFileContent.includes('distributionSha256Sum=')) {
        // need to reset version, otherwise we have a checksum mismatch
        await writeLocalFile(
          packageFileName,
          newPackageFileContent.replace(config.newValue, config.currentValue)
        );
        const checksum = await getDistributionChecksum(distributionUrl);
        cmd += ` --gradle-distribution-sha256-sum ${checksum}`;
      }
    } else {
      cmd += ` --gradle-version ${config.newValue}`;
    }
    logger.debug(`Updating gradle wrapper: "${cmd}"`);
    const execOptions: ExecOptions = {
      docker: {
        image: 'gradle',
      },
      extraEnv,
    };
    try {
      await exec(cmd, execOptions);
    } catch (err) {
      // istanbul ignore if
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.warn(
        { err },
        'Error executing gradle wrapper update command. It can be not a critical one though.'
      );
    }
    const status = await getRepoStatus();
    const artifactFileNames = [
      'gradle/wrapper/gradle-wrapper.properties',
      'gradle/wrapper/gradle-wrapper.jar',
      'gradlew',
      'gradlew.bat',
    ].map(
      (filename) =>
        packageFileName
          .replace('gradle/wrapper/', '')
          .replace('gradle-wrapper.properties', '') + filename
    );
    const updateArtifactsResult = (
      await Promise.all(
        artifactFileNames.map((fileProjectPath) =>
          addIfUpdated(status, fileProjectPath)
        )
      )
    ).filter((e) => e != null);
    logger.debug(
      { files: updateArtifactsResult.map((r) => r.file.name) },
      `Returning updated gradle-wrapper files`
    );
    return updateArtifactsResult;
  } catch (err) {
    logger.debug({ err }, 'Error setting new Gradle Wrapper release value');
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
