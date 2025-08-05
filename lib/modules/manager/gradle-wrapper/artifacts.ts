import is from '@sindresorhus/is';
import { lang, query as q } from 'good-enough-parser';
import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { StatusResult } from '../../../util/git/types';
import { Http } from '../../../util/http';
import { newlineRegex } from '../../../util/regex';
import { replaceAt } from '../../../util/string';
import { updateArtifacts as gradleUpdateArtifacts } from '../gradle';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';
import {
  extraEnv,
  getJavaConstraint,
  gradleWrapperFileName,
  prepareGradleCommand,
} from './utils';

const http = new Http('gradle-wrapper');
const groovy = lang.createLang('groovy');

type Ctx = string[];

async function addIfUpdated(
  status: StatusResult,
  fileProjectPath: string,
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
  const { body } = await http.getText(`${url}.sha256`);
  return body;
}

export async function updateBuildFile(
  localGradleDir: string,
  wrapperProperties: Record<string, string | undefined | null>,
): Promise<string> {
  let buildFileName = upath.join(localGradleDir, 'build.gradle');
  if (!(await localPathExists(buildFileName))) {
    buildFileName = upath.join(localGradleDir, 'build.gradle.kts');
  }

  const buildFileContent = await readLocalFile(buildFileName, 'utf8');
  if (!buildFileContent) {
    logger.debug('build.gradle or build.gradle.kts not found');
    return buildFileName;
  }

  let buildFileUpdated = buildFileContent;
  for (const [propertyName, newValue] of Object.entries(wrapperProperties)) {
    if (!newValue) {
      continue;
    }

    const query = q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: q
        .sym<Ctx>(propertyName)
        .op('=')
        .str((ctx, { value, offset }) => {
          buildFileUpdated = replaceAt(
            buildFileUpdated,
            offset,
            value,
            newValue,
          );
          return ctx;
        }),
    });
    groovy.query(buildFileUpdated, query, []);
  }

  await writeLocalFile(buildFileName, buildFileUpdated);

  return buildFileName;
}

export async function updateLockFiles(
  buildFileName: string,
  config: UpdateArtifactsConfig,
): Promise<UpdateArtifactsResult[] | null> {
  const buildFileContent = await readLocalFile(buildFileName, 'utf8');
  if (!buildFileContent) {
    logger.debug('build.gradle or build.gradle.kts not found');
    return null;
  }

  return await gradleUpdateArtifacts({
    packageFileName: buildFileName,
    updatedDeps: [],
    newPackageFileContent: buildFileContent,
    config,
  });
}

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  try {
    logger.debug({ updatedDeps }, 'gradle-wrapper.updateArtifacts()');
    const localGradleDir = upath.join(upath.dirname(packageFileName), '../../');
    const gradlewFile = upath.join(localGradleDir, gradleWrapperFileName());

    let cmd = await prepareGradleCommand(gradlewFile);
    if (!cmd) {
      logger.info('No gradlew found - skipping Artifacts update');
      return null;
    }
    cmd += ' :wrapper';

    let checksum: string | null = null;
    const distributionUrl = getDistributionUrl(newPackageFileContent);
    if (distributionUrl) {
      cmd += ` --gradle-distribution-url ${distributionUrl}`;
      if (newPackageFileContent.includes('distributionSha256Sum=')) {
        //update checksum in case of distributionSha256Sum in properties then run wrapper
        checksum = await getDistributionChecksum(distributionUrl);
        await writeLocalFile(
          packageFileName,
          newPackageFileContent.replace(
            /distributionSha256Sum=.*/,
            `distributionSha256Sum=${checksum}`,
          ),
        );
        cmd += ` --gradle-distribution-sha256-sum ${quote(checksum)}`;
      }
    } else {
      cmd += ` --gradle-version ${quote(config.newValue!)}`;
    }
    logger.debug(`Updating gradle wrapper: "${cmd}"`);
    const execOptions: ExecOptions = {
      cwdFile: gradlewFile,
      docker: {},
      extraEnv,
      toolConstraints: [
        {
          toolName: 'java',
          constraint:
            config.constraints?.java ??
            (await getJavaConstraint(config.currentValue, gradlewFile)),
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
        'Error executing gradle wrapper update command. It can be not a critical one though.',
      );
    }

    const buildFileName = await updateBuildFile(localGradleDir, {
      gradleVersion: config.newValue,
      distributionSha256Sum: checksum,
      distributionUrl,
    });
    const lockFiles = await updateLockFiles(buildFileName, config);

    const status = await getRepoStatus();
    const artifactFileNames = [
      packageFileName,
      buildFileName,
      ...['gradle/wrapper/gradle-wrapper.jar', 'gradlew', 'gradlew.bat'].map(
        (filename) => upath.join(localGradleDir, filename),
      ),
    ];
    const updateArtifactsResult = (
      await Promise.all(
        artifactFileNames.map((fileProjectPath) =>
          addIfUpdated(status, fileProjectPath),
        ),
      )
    ).filter(is.truthy);
    if (lockFiles) {
      updateArtifactsResult.push(...lockFiles);
    }

    logger.debug(
      { files: updateArtifactsResult.map((r) => r.file?.path) },
      `Returning updated gradle-wrapper files`,
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
