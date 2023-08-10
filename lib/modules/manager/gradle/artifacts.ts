import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { dirname, join } from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { findUpLocal, readLocalFile, writeLocalFile } from '../../../util/fs';
import { getFiles, getRepoStatus } from '../../../util/git';
import { regEx } from '../../../util/regex';
import { scm } from '../../platform/scm';
import {
  extraEnv,
  extractGradleVersion,
  getJavaConstraint,
  gradleWrapperFileName,
  prepareGradleCommand,
} from '../gradle-wrapper/utils';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import {
  isGcvLockFile,
  isGcvPropsFile,
} from './extract/consistent-versions-plugin';
import { isGradleBuildFile } from './utils';

// .lockfile is gradle default lockfile, /versions.lock is gradle-consistent-versions plugin lockfile
function isLockFile(fileName: string): boolean {
  return fileName.endsWith('.lockfile') || isGcvLockFile(fileName);
}

async function getUpdatedLockfiles(
  oldLockFileContentMap: Record<string, string | null>
): Promise<UpdateArtifactsResult[]> {
  const res: UpdateArtifactsResult[] = [];

  const status = await getRepoStatus();

  for (const modifiedFile of status.modified) {
    if (isLockFile(modifiedFile)) {
      const newContent = await readLocalFile(modifiedFile, 'utf8');
      if (oldLockFileContentMap[modifiedFile] !== newContent) {
        res.push({
          file: {
            type: 'addition',
            path: modifiedFile,
            contents: newContent,
          },
        });
      }
    }
  }

  return res;
}

async function getSubProjectList(
  cmd: string,
  execOptions: ExecOptions
): Promise<string[]> {
  const subprojects = ['']; // = root project
  const subprojectsRegex = regEx(/^[ \t]*subprojects: \[(?<subprojects>.+)\]/m);

  const gradleProperties = await exec(`${cmd} properties`, execOptions);
  const subprojectsMatch = gradleProperties.stdout.match(subprojectsRegex);
  if (subprojectsMatch?.groups?.subprojects) {
    const projectRegex = regEx(/project '(?<name>.+?)'/g);
    const matches = subprojectsMatch.groups.subprojects.matchAll(projectRegex);
    for (const match of matches) {
      if (match?.groups?.name) {
        subprojects.push(match.groups.name);
      }
    }
  }

  return subprojects;
}

async function getGradleVersion(gradlewFile: string): Promise<string | null> {
  const propertiesFile = join(
    dirname(gradlewFile),
    'gradle/wrapper/gradle-wrapper.properties'
  );
  const properties = await readLocalFile(propertiesFile, 'utf8');
  const extractResult = extractGradleVersion(properties ?? '');

  return extractResult ? extractResult.version : null;
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`gradle.updateArtifacts(${packageFileName})`);

  const fileList = await scm.getFileList();
  const lockFiles = fileList.filter((file) => isLockFile(file));
  if (!lockFiles.length) {
    logger.debug('No Gradle dependency lockfiles found - skipping update');
    return null;
  }

  const gradlewName = gradleWrapperFileName();
  const gradlewFile = await findUpLocal(gradlewName, dirname(packageFileName));
  if (!gradlewFile) {
    logger.debug(
      'Found Gradle dependency lockfiles but no gradlew - aborting update'
    );
    return null;
  }

  if (
    config.isLockFileMaintenance &&
    (!isGradleBuildFile(packageFileName) ||
      dirname(packageFileName) !== dirname(gradlewFile))
  ) {
    logger.trace(
      'No build.gradle(.kts) file or not in root project - skipping lock file maintenance'
    );
    return null;
  }

  logger.debug('Updating found Gradle dependency lockfiles');

  try {
    const oldLockFileContentMap = await getFiles(lockFiles);
    await prepareGradleCommand(gradlewFile);

    let cmd = `${gradlewName} --console=plain -q`;
    const execOptions: ExecOptions = {
      cwdFile: gradlewFile,
      docker: {},
      extraEnv,
      toolConstraints: [
        {
          toolName: 'java',
          constraint:
            config.constraints?.java ??
            getJavaConstraint(await getGradleVersion(gradlewFile)),
        },
      ],
    };

    const subprojects = await getSubProjectList(cmd, execOptions);
    cmd += ` ${subprojects
      .map((project) => project + ':dependencies')
      .map(quote)
      .join(' ')}`;

    if (
      config.isLockFileMaintenance === true ||
      !updatedDeps.length ||
      isGcvPropsFile(packageFileName)
    ) {
      cmd += ' --write-locks';
    } else {
      const updatedDepNames = updatedDeps
        .map(({ depName, packageName }) => packageName ?? depName)
        .filter(is.nonEmptyStringAndNotWhitespace);

      cmd += ` --update-locks ${updatedDepNames.map(quote).join(',')}`;
    }

    await writeLocalFile(packageFileName, newPackageFileContent);
    await exec(cmd, { ...execOptions, ignoreStdout: true });

    const res = await getUpdatedLockfiles(oldLockFileContentMap);
    logger.debug('Returning updated Gradle dependency lockfiles');

    return res.length > 0 ? res : null;
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    logger.debug({ err }, 'Error while updating Gradle dependency lockfiles');
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
