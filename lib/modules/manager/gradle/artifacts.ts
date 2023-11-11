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
  oldLockFileContentMap: Record<string, string | null>,
): Promise<UpdateArtifactsResult[]> {
  const res: UpdateArtifactsResult[] = [];

  const status = await getRepoStatus();

  for (const modifiedFile of status.modified) {
    if (
      isLockFile(modifiedFile) ||
      modifiedFile.endsWith('gradle/verification-metadata.xml')
    ) {
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
  execOptions: ExecOptions,
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
    'gradle/wrapper/gradle-wrapper.properties',
  );
  const properties = await readLocalFile(propertiesFile, 'utf8');
  const extractResult = extractGradleVersion(properties ?? '');

  return extractResult ? extractResult.version : null;
}

async function buildUpdateVerificationMetadataCmd(
  verificationMetadataFile: string | undefined,
  baseCmd: string,
): Promise<string | null> {
  if (!verificationMetadataFile) {
    return null;
  }
  const hashTypes: string[] = [];
  const verificationMetadata = await readLocalFile(verificationMetadataFile);
  if (
    verificationMetadata?.includes('<verify-metadata>true</verify-metadata>')
  ) {
    logger.debug('Dependency verification enabled - generating checksums');
    for (const hashType of ['sha256', 'sha512']) {
      if (verificationMetadata?.includes(`<${hashType}`)) {
        hashTypes.push(hashType);
      }
    }
    if (!hashTypes.length) {
      hashTypes.push('sha256');
    }
  }
  if (
    verificationMetadata?.includes(
      '<verify-signatures>true</verify-signatures>',
    )
  ) {
    logger.debug(
      'Dependency signature verification enabled - generating PGP signatures',
    );
    // signature verification requires at least one checksum type as fallback.
    if (!hashTypes.length) {
      hashTypes.push('sha256');
    }
    hashTypes.push('pgp');
  }
  if (!hashTypes.length) {
    return null;
  }
  return `${baseCmd} --write-verification-metadata ${hashTypes.join(',')} help`;
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
  const verificationMetadataFile = fileList.find((fileName) =>
    fileName.endsWith('gradle/verification-metadata.xml'),
  );
  if (!lockFiles.length && !verificationMetadataFile) {
    logger.debug(
      'No Gradle dependency lockfiles or verification metadata found - skipping update',
    );
    return null;
  }

  const gradlewName = gradleWrapperFileName();
  const gradlewFile = await findUpLocal(gradlewName, dirname(packageFileName));
  if (!gradlewFile) {
    logger.debug(
      'Found Gradle dependency lockfiles but no gradlew - aborting update',
    );
    return null;
  }

  if (
    config.isLockFileMaintenance &&
    (!isGradleBuildFile(packageFileName) ||
      dirname(packageFileName) !== dirname(gradlewFile))
  ) {
    logger.trace(
      'No build.gradle(.kts) file or not in root project - skipping lock file maintenance',
    );
    return null;
  }

  logger.debug('Updating found Gradle dependency lockfiles');

  try {
    const oldLockFileContentMap = await getFiles(lockFiles);
    await prepareGradleCommand(gradlewFile);

    const baseCmd = `${gradlewName} --console=plain --dependency-verification lenient -q`;
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

    const cmds = [];
    if (lockFiles.length) {
      const subprojects = await getSubProjectList(baseCmd, execOptions);
      let lockfileCmd = `${baseCmd} ${subprojects
        .map((project) => `${project}:dependencies`)
        .map(quote)
        .join(' ')}`;

      if (
        config.isLockFileMaintenance === true ||
        !updatedDeps.length ||
        isGcvPropsFile(packageFileName)
      ) {
        lockfileCmd += ' --write-locks';
      } else {
        const updatedDepNames = updatedDeps
          .map(({ depName, packageName }) => packageName ?? depName)
          .filter(is.nonEmptyStringAndNotWhitespace);

        lockfileCmd += ` --update-locks ${updatedDepNames
          .map(quote)
          .join(',')}`;
      }
      cmds.push(lockfileCmd);
    }

    const updateVerificationMetadataCmd =
      await buildUpdateVerificationMetadataCmd(
        verificationMetadataFile,
        baseCmd,
      );
    if (updateVerificationMetadataCmd) {
      cmds.push(updateVerificationMetadataCmd);
    }

    if (!cmds.length) {
      logger.debug('No lockfile or verification metadata update necessary');
      return null;
    }

    await writeLocalFile(packageFileName, newPackageFileContent);
    await exec(cmds, { ...execOptions, ignoreStdout: true });

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
