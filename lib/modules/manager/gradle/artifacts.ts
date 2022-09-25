import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { dirname } from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  findUpLocal,
  getFileContentMap,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getFileList, getRepoStatus } from '../../../util/git';
import { regEx } from '../../../util/regex';
import {
  extraEnv,
  getJavaConstraint,
  gradleWrapperFileName,
} from '../gradle-wrapper/utils';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

async function getUpdatedLockfiles(
  oldLockFileContentMap: Record<string, string | null>
): Promise<UpdateArtifactsResult[]> {
  const res: UpdateArtifactsResult[] = [];

  const status = await getRepoStatus();

  for (const modifiedFile of status.modified) {
    if (modifiedFile.endsWith('.lockfile')) {
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
    let match: RegExpExecArray | null;
    do {
      match = projectRegex.exec(subprojectsMatch.groups.subprojects);
      if (match?.groups?.name) {
        subprojects.push(match.groups.name);
      }
    } while (match);
  }

  return subprojects;
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`gradle.updateArtifacts(${packageFileName})`);

  const fileList = await getFileList();
  const lockFiles = fileList.filter((file) => file.endsWith('.lockfile'));
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
  logger.debug('Updating found Gradle dependency lockfiles');

  try {
    const oldLockFileContentMap = await getFileContentMap(lockFiles);

    await writeLocalFile(packageFileName, newPackageFileContent);

    let cmd = `${gradlewName} --console=plain -q`;
    const execOptions: ExecOptions = {
      cwdFile: gradlewFile,
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

    const subprojects = await getSubProjectList(cmd, execOptions);
    cmd += ` ${subprojects
      .map((project) => project + ':dependencies')
      .map(quote)
      .join(' ')}`;

    if (config.isLockFileMaintenance) {
      cmd += ' --write-locks';
    } else {
      const updatedDepNames = updatedDeps
        .map(({ depName, packageName }) => packageName ?? depName)
        .filter(is.nonEmptyStringAndNotWhitespace);

      cmd += ` --update-locks ${updatedDepNames.map(quote).join(',')}`;
    }

    await exec(cmd, execOptions);

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
