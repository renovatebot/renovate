import is from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { readLocalFile, stat, writeLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { StatusResult } from '../../../util/git/types';
import { Http } from '../../../util/http';
import { newlineRegex } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import {
  extraEnv,
  getJavaContraint,
  getJavaVersioning,
  gradleWrapperFileName,
  prepareGradleCommand,
} from './utils';

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
    const projectDir = GlobalConfig.get('localDir');
    logger.debug({ updatedDeps }, 'gradle-wrapper.updateArtifacts()');
    const gradlew = gradleWrapperFileName();
    const gradlewPath = upath.resolve(projectDir, `./${gradlew}`);
    let cmd = await prepareGradleCommand(
      gradlew,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      projectDir!,
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      cmd += ` --gradle-version ${quote(config.newValue!)}`;
    }
    logger.debug(`Updating gradle wrapper: "${cmd}"`);
    const execOptions: ExecOptions = {
      docker: {
        image: 'java',
        tagConstraint:
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          config.constraints?.java ?? getJavaContraint(config.currentValue!),
        tagScheme: getJavaVersioning(),
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
