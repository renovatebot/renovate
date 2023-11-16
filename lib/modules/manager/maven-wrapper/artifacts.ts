import type { Stats } from 'node:fs';
import os from 'node:os';
import is from '@sindresorhus/is';
import { dirname, join } from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions, ExtraEnv } from '../../../util/exec/types';
import { chmodLocalFile, readLocalFile, statLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { StatusResult } from '../../../util/git/types';
import { regEx } from '../../../util/regex';
import mavenVersioning from '../../versioning/maven';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

const DEFAULT_MAVEN_REPO_URL = 'https://repo.maven.apache.org/maven2';
interface MavenWrapperPaths {
  wrapperExecutableFileName: string;
  localProjectDir: string;
  wrapperFullyQualifiedPath: string;
}

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

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  try {
    logger.debug({ updatedDeps }, 'maven-wrapper.updateArtifacts()');

    if (!updatedDeps.some((dep) => dep.depName === 'maven-wrapper')) {
      logger.info(
        'Maven wrapper version not updated - skipping Artifacts update',
      );
      return null;
    }

    const cmd = await createWrapperCommand(packageFileName);

    if (!cmd) {
      logger.info('No mvnw found - skipping Artifacts update');
      return null;
    }

    const extraEnv = getExtraEnvOptions(updatedDeps);
    await executeWrapperCommand(cmd, config, packageFileName, extraEnv);

    const status = await getRepoStatus();
    const artifactFileNames = [
      '.mvn/wrapper/maven-wrapper.properties',
      '.mvn/wrapper/maven-wrapper.jar',
      '.mvn/wrapper/MavenWrapperDownloader.java',
      'mvnw',
      'mvnw.cmd',
    ].map(
      (filename) =>
        packageFileName.replace('.mvn/wrapper/maven-wrapper.properties', '') +
        filename,
    );
    const updateArtifactsResult = (
      await getUpdatedArtifacts(status, artifactFileNames)
    ).filter(is.truthy);

    logger.debug(
      { files: updateArtifactsResult.map((r) => r.file?.path) },
      `Returning updated maven-wrapper files`,
    );
    return updateArtifactsResult;
  } catch (err) {
    logger.debug({ err }, 'Error setting new Maven Wrapper release value');
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

async function getUpdatedArtifacts(
  status: StatusResult,
  artifactFileNames: string[],
): Promise<UpdateArtifactsResult[]> {
  const updatedResults: UpdateArtifactsResult[] = [];
  for (const artifactFileName of artifactFileNames) {
    const updatedResult = await addIfUpdated(status, artifactFileName);
    if (updatedResult !== null) {
      updatedResults.push(updatedResult);
    }
  }
  return updatedResults;
}

/**
 * Find compatible java version for maven.
 * see https://maven.apache.org/developers/compatibility-plan.html
 * @param mavenWrapperVersion current maven version
 * @returns A Java semver range
 */
export function getJavaConstraint(
  mavenWrapperVersion: string | null | undefined,
): string | null {
  const major = mavenWrapperVersion
    ? mavenVersioning.getMajor(mavenWrapperVersion)
    : null;

  if (major && major >= 3) {
    return '^17.0.0';
  }

  return '^8.0.0';
}

async function executeWrapperCommand(
  cmd: string,
  config: UpdateArtifactsConfig,
  packageFileName: string,
  extraEnv: ExtraEnv,
): Promise<void> {
  logger.debug(`Updating maven wrapper: "${cmd}"`);
  const { wrapperFullyQualifiedPath } = getMavenPaths(packageFileName);

  const execOptions: ExecOptions = {
    cwdFile: wrapperFullyQualifiedPath,
    docker: {},
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
    logger.error({ err }, 'Error executing maven wrapper update command.');
    throw err;
  }
}

function getExtraEnvOptions(deps: PackageDependency[]): ExtraEnv {
  const customMavenWrapperUrl = getCustomMavenWrapperRepoUrl(deps);
  if (customMavenWrapperUrl) {
    return { MVNW_REPOURL: customMavenWrapperUrl };
  }
  return {};
}

function getCustomMavenWrapperRepoUrl(
  deps: PackageDependency[],
): string | null {
  const replaceString = deps.find((dep) => dep.depName === 'maven-wrapper')
    ?.replaceString;

  if (!replaceString) {
    return null;
  }

  const match = regEx(/^(.*?)\/org\/apache\/maven\/wrapper\//).exec(
    replaceString,
  );

  if (!match) {
    return null;
  }

  return match[1] === DEFAULT_MAVEN_REPO_URL ? null : match[1];
}

async function createWrapperCommand(
  packageFileName: string,
): Promise<string | null> {
  const {
    wrapperExecutableFileName,
    localProjectDir,
    wrapperFullyQualifiedPath,
  } = getMavenPaths(packageFileName);

  return await prepareCommand(
    wrapperExecutableFileName,
    localProjectDir,
    await statLocalFile(wrapperFullyQualifiedPath),
    'wrapper:wrapper',
  );
}

function mavenWrapperFileName(): string {
  if (
    os.platform() === 'win32' &&
    GlobalConfig.get('binarySource') !== 'docker'
  ) {
    return 'mvnw.cmd';
  }
  return './mvnw';
}

function getMavenPaths(packageFileName: string): MavenWrapperPaths {
  const wrapperExecutableFileName = mavenWrapperFileName();
  const localProjectDir = join(dirname(packageFileName), '../../');
  const wrapperFullyQualifiedPath = join(
    localProjectDir,
    wrapperExecutableFileName,
  );
  return {
    wrapperExecutableFileName,
    localProjectDir,
    wrapperFullyQualifiedPath,
  };
}

async function prepareCommand(
  fileName: string,
  cwd: string | undefined,
  pathFileStats: Stats | null,
  args: string | null,
): Promise<string | null> {
  // istanbul ignore if
  if (pathFileStats?.isFile() === true) {
    // if the file is not executable by others
    if (os.platform() !== 'win32' && (pathFileStats.mode & 0o1) === 0) {
      // add the execution permission to the owner, group and others
      logger.warn('Maven wrapper is missing the executable bit');
      await chmodLocalFile(join(cwd, fileName), pathFileStats.mode | 0o111);
    }
    if (args === null) {
      return fileName;
    }
    return `${fileName} ${args}`;
  }
  return null;
}
