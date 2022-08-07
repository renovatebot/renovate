import type { Stats } from 'fs';
import os from 'os';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { chmodLocalFile, readLocalFile, statLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { StatusResult } from '../../../util/git/types';
import mavenVersioning from '../../versioning/maven';
import { id as npmVersioning } from '../../versioning/npm';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

/**
 * Find compatible java version for maven.
 * see https://maven.apache.org/developers/compatibility-plan.html
 * @param mavenVersion current maven version
 * @returns A Java semver range
 */
function getJavaContraint(mavenVersion: string | undefined): string | null {
  const major = mavenVersion && mavenVersioning.getMajor(mavenVersion);
  const minor = mavenVersion && mavenVersioning.getMinor(mavenVersion);

  if (major && major >= 3) {
    return minor && minor >= 1 ? '^8.0.0' : '^7.0.0';
  }

  return '^5.0.0';
}

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
}: UpdateArtifact): Promise<(UpdateArtifactsResult | null)[] | null> {
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
      await Promise.all(
        artifactFileNames.map((fileProjectPath) =>
          addIfUpdated(status, fileProjectPath)
        )
      )
    ).filter(Boolean);
    logger.debug(
      { files: updateArtifactsResult.map((r) => r?.file?.path) },
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

async function executeWrapperCommand(
  cmd: string,
  config: UpdateArtifactsConfig
): Promise<void> {
  logger.debug(`Updating maven wrapper: "${cmd}"`);
  const execOptions: ExecOptions = {
    docker: {
      image: 'java',
      tagConstraint:
        config.constraints?.java ?? getJavaContraint(config.currentValue),
      tagScheme: npmVersioning,
    },
    // extraEnv,
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
      'Error executing maven wrapper update command. It can be not a critical one though.'
    );
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
    await statLocalFile(wrapperFullyQualifiedPath).catch(() => null),
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
    if ((pathFileStats.mode & 0o1) === 0) {
      // add the execution permission to the owner, group and others
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
  /* eslint-enable no-bitwise */
  return null;
}
