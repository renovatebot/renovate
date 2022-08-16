import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { readLocalFile, writeLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { StatusResult } from '../../../util/git/types';
import { Http } from '../../../util/http';
import { newlineRegex } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { extraEnv, getJavaConstraint, prepareGradleCommand } from './utils';

const http = new Http('gradle-wrapper');

async function addIfUpdated(
  status: StatusResult,
  fileProjectPath: string
): Promise<UpdateArtifactsResult | null> {
  if (status.modified.includes(fileProjectPath)) {
    return {
      file: {
        type: 'addition',
        path: fileProjectPath,
        contents: await readLocalFile(fileProjectPath),
      },
    };
  }
  return null;
}

function getDistributionUrl(newPackageFileContent: string): string | null {
  const distributionUrlLine = newPackageFileContent
    .split(newlineRegex)
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
    logger.debug({ updatedDeps }, 'gradle-wrapper.updateArtifacts()');
    let cmd = await prepareGradleCommand();
    if (!cmd) {
      logger.info('No gradlew found - skipping Artifacts update');
      return null;
    }
    cmd += ' wrapper';
    const distributionUrl = getDistributionUrl(newPackageFileContent);
    if (distributionUrl) {
      cmd += ` --gradle-distribution-url ${distributionUrl}`;
      if (newPackageFileContent.includes('distributionSha256Sum=')) {
        //update checksum in case of distributionSha256Sum in properties then run wrapper
        const checksum = await getDistributionChecksum(distributionUrl);
        await writeLocalFile(
          packageFileName,
          newPackageFileContent.replace(
            /distributionSha256Sum=.*/,
            `distributionSha256Sum=${checksum}`
          )
        );
        cmd += ` --gradle-distribution-sha256-sum ${quote(checksum)}`;
      }
    } else {
      cmd += ` --gradle-version ${quote(config.newValue!)}`;
    }
    logger.debug(`Updating gradle wrapper: "${cmd}"`);
    const execOptions: ExecOptions = {
      docker: {
        image: 'sidecar',
      },
      extraEnv,
      toolConstraints: [
        {
          toolName: 'java',
          constraint:
            config.constraints?.java ?? getJavaConstraint(config.currentValue),
        },
      ],
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
    ).filter(is.truthy);
    logger.debug(
      { files: updateArtifactsResult.map((r) => r.file?.path) },
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
