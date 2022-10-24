import type { Stats } from 'fs';
import os from 'os';
import is from '@sindresorhus/is';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { chmodLocalFile, readLocalFile, statLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { StatusResult } from '../../../util/git/types';
import mavenVersioning from '../../versioning/maven';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

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

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  try {
    logger.debug({ updatedDeps }, 'maven-wrapper.updateArtifacts()');

    if (
      !updatedDeps.some(
        (dep) => dep.depName === 'org.apache.maven.wrapper:maven-wrapper'
      )
    ) {
      logger.info(
        'Maven wrapper version not updated - skipping Artifacts update'
      );
      return null;
    }

    const cmd = await createWrapperCommand();
    if (!cmd) {
      logger.info('No mvnw found - skipping Artifacts update');
      return null;
    }
    await executeWrapperCommand(cmd, config);

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
        filename
    );
    const updateArtifactsResult = (
      await getUpdatedArtifacts(status, artifactFileNames)
    ).filter(is.truthy);

    logger.debug(
      { files: updateArtifactsResult.map((r) => r.file?.path) },
      `Returning updated maven-wrapper files`
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
  artifactFileNames: string[]
): Promise<UpdateArtifactsResult[]> {
  const updatedResults: (UpdateArtifactsResult | null)[] = [];
  for (const artifactFileName of artifactFileNames) {
    updatedResults.push(await addIfUpdated(status, artifactFileName));
  }
  return updatedResults.filter(is.truthy);
}

/**
 * Find compatible java version for maven.
 * see https://maven.apache.org/developers/compatibility-plan.html
 * @param mavenWrapperVersion current maven version
 * @returns A Java semver range
 */
export function getJavaConstraint(
  mavenWrapperVersion: string | null | undefined
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
  config: UpdateArtifactsConfig
): Promise<void> {
  logger.debug(`Updating maven wrapper: "${cmd}"`);
  const execOptions: ExecOptions = {
    docker: {
      image: 'sidecar',
    },
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

async function createWrapperCommand(): Promise<string | null> {
  const projectDir = GlobalConfig.get('localDir');
  const wrapperExecutableFileName = mavenWrapperFileName();
  const wrapperFullyQualifiedPath = upath.resolve(
    projectDir,
    `./${wrapperExecutableFileName}`
  );
  return await prepareCommand(
    wrapperExecutableFileName,
    projectDir,
    await statLocalFile(wrapperFullyQualifiedPath),
    `wrapper:wrapper`
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

async function prepareCommand(
  fileName: string,
  cwd: string | undefined,
  pathFileStats: Stats | null,
  args: string | null
): Promise<string | null> {
  // istanbul ignore if
  if (pathFileStats?.isFile() === true) {
    // if the file is not executable by others
    if (os.platform() !== 'win32' && (pathFileStats.mode & 0o1) === 0) {
      // add the execution permission to the owner, group and others
      logger.warn('Maven wrapper is missing the executable bit');
      await chmodLocalFile(
        upath.join(cwd, fileName),
        pathFileStats.mode | 0o111
      );
    }
    if (args === null) {
      return fileName;
    }
    return `${fileName} ${args}`;
  }
  return null;
}
