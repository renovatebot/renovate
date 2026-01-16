import type { Stats } from 'node:fs';
import os from 'node:os';
import { isTruthy } from '@sindresorhus/is';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions, ExtraEnv } from '../../../util/exec/types';
import {
  chmodLocalFile,
  deleteLocalFile,
  readLocalFile,
  statLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { StatusResult } from '../../../util/git/types';
import { hash } from '../../../util/hash';
import { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import mavenVersioning from '../../versioning/maven';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

const http = new Http('maven-wrapper');
const DEFAULT_MAVEN_REPO_URL = 'https://repo.maven.apache.org/maven2';

async function getChecksumFromUrl(url: string): Promise<string> {
  const { body } = await http.getBuffer(url);
  return hash(body, 'sha256');
}

function getDistributionUrl(content: string): string | null {
  const match = regEx(/^distributionUrl\s*=\s*(.+)$/m).exec(content);
  return match ? match[1].replace(/\\:/g, ':').trim() : null;
}

function getWrapperUrl(content: string): string | null {
  const match = regEx(/^wrapperUrl\s*=\s*(.+)$/m).exec(content);
  return match ? match[1].replace(/\\:/g, ':').trim() : null;
}

function constructWrapperUrl(
  version: string,
  repoUrl: string = DEFAULT_MAVEN_REPO_URL,
): string {
  return `${repoUrl}/org/apache/maven/wrapper/maven-wrapper/${version}/maven-wrapper-${version}.jar`;
}

function getWrapperVersion(content: string): string | null {
  const match = regEx(/^wrapperVersion\s*=\s*(.+)$/m).exec(content);
  return match ? match[1].trim() : null;
}

async function updateChecksums(
  content: string,
  updatedDeps: PackageDependency[],
  addDistributionChecksum: boolean,
  addWrapperChecksum: boolean,
): Promise<string> {
  let updatedContent = content;

  // Update or add distribution checksum
  if (addDistributionChecksum) {
    const distUrl = getDistributionUrl(updatedContent);
    if (distUrl) {
      try {
        const checksum = await getChecksumFromUrl(distUrl);
        if (updatedContent.includes('distributionSha256Sum=')) {
          updatedContent = updatedContent.replace(
            regEx(/distributionSha256Sum=.*/),
            `distributionSha256Sum=${checksum}`,
          );
        } else {
          // Add checksum after distributionUrl
          updatedContent = updatedContent.replace(
            regEx(/^(distributionUrl\s*=\s*.+)$/m),
            `$1\ndistributionSha256Sum=${checksum}`,
          );
        }
      } catch (err) {
        logger.warn(
          { err, url: distUrl },
          'Failed to fetch distribution checksum',
        );
      }
    }
  }

  // Update or add wrapper checksum
  if (addWrapperChecksum) {
    let wrapperUrl = getWrapperUrl(updatedContent);

    // If no wrapperUrl, try to construct from wrapperVersion
    if (!wrapperUrl) {
      const wrapperVersion = getWrapperVersion(updatedContent);
      if (wrapperVersion) {
        const customRepoUrl = getCustomMavenWrapperRepoUrl(updatedDeps);
        wrapperUrl = constructWrapperUrl(
          wrapperVersion,
          customRepoUrl ?? DEFAULT_MAVEN_REPO_URL,
        );
      }
    }

    if (wrapperUrl) {
      try {
        const checksum = await getChecksumFromUrl(wrapperUrl);
        if (updatedContent.includes('wrapperSha256Sum=')) {
          updatedContent = updatedContent.replace(
            regEx(/wrapperSha256Sum=.*/),
            `wrapperSha256Sum=${checksum}`,
          );
        } else {
          // Add checksum after wrapperUrl or wrapperVersion
          const wrapperLineMatch = regEx(
            /^(wrapperUrl\s*=\s*.+|wrapperVersion\s*=\s*.+)$/m,
          ).exec(updatedContent);
          if (wrapperLineMatch) {
            updatedContent = updatedContent.replace(
              wrapperLineMatch[0],
              `${wrapperLineMatch[0]}\nwrapperSha256Sum=${checksum}`,
            );
          }
        }
      } catch (err) {
        logger.warn(
          { err, url: wrapperUrl },
          'Failed to fetch wrapper checksum',
        );
      }
    }
  }

  return updatedContent;
}

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

    const hasMavenUpdate = updatedDeps.some((dep) => dep.depName === 'maven');
    const hasWrapperUpdate = updatedDeps.some(
      (dep) => dep.depName === 'maven-wrapper',
    );
    // Remember if original content had checksums - we'll restore them after wrapper:wrapper
    const hadDistributionChecksum = newPackageFileContent.includes(
      'distributionSha256Sum=',
    );
    const hadWrapperChecksum =
      newPackageFileContent.includes('wrapperSha256Sum=');

    // Skip if no relevant updates
    if (!hasWrapperUpdate && !(hasMavenUpdate && hadDistributionChecksum)) {
      logger.debug(
        'No Maven wrapper or distribution checksum updates - skipping Artifacts update',
      );
      return null;
    }

    // If wrapper is being updated, check if mvnw exists first
    let cmd: string | null = null;
    if (hasWrapperUpdate) {
      cmd = await createWrapperCommand(packageFileName, hadWrapperChecksum);

      if (!cmd) {
        logger.info('No mvnw found - skipping Artifacts update');
        return null;
      }
    }

    // Delete old maven-wrapper.jar if checksums exist
    // This prevents checksum validation failure when wrapper:wrapper runs
    if (hadWrapperChecksum || hadDistributionChecksum) {
      const jarPath = packageFileName.replace(
        'maven-wrapper.properties',
        'maven-wrapper.jar',
      );
      try {
        await deleteLocalFile(jarPath);
        logger.debug({ jarPath }, 'Deleted old maven-wrapper.jar');
      } catch {
        // File may not exist, ignore
      }
    }

    // Strip checksum lines before running wrapper:wrapper to avoid validation failure
    // (mvnw would try to validate NEW jar against OLD checksum)
    let contentToWrite = newPackageFileContent;
    if (hasWrapperUpdate && (hadWrapperChecksum || hadDistributionChecksum)) {
      contentToWrite = contentToWrite
        .replace(regEx(/^distributionSha256Sum=.*\n?/m), '')
        .replace(regEx(/^wrapperSha256Sum=.*\n?/m), '');
    }

    // Write the properties file
    await writeLocalFile(packageFileName, contentToWrite);

    // Run wrapper:wrapper if the wrapper itself is being updated
    if (hasWrapperUpdate && cmd) {
      const extraEnv = getExtraEnvOptions(updatedDeps);
      await executeWrapperCommand(cmd, config, packageFileName, extraEnv);
    }

    // Now update checksums AFTER wrapper:wrapper has run (if it ran)
    // This ensures we compute checksums for the actual generated content
    if (hadDistributionChecksum || hadWrapperChecksum) {
      const currentContent = await readLocalFile(packageFileName, 'utf8');
      if (currentContent) {
        const contentWithChecksums = await updateChecksums(
          currentContent,
          updatedDeps,
          hadDistributionChecksum,
          hadWrapperChecksum,
        );
        await writeLocalFile(packageFileName, contentWithChecksums);
      }
    }

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
    ).filter(isTruthy);

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
  const replaceString = deps.find(
    (dep) => dep.depName === 'maven-wrapper',
  )?.replaceString;

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
  hadWrapperChecksum: boolean,
): Promise<string | null> {
  const {
    wrapperExecutableFileName,
    localProjectDir,
    wrapperFullyQualifiedPath,
  } = getMavenPaths(packageFileName);

  // If user had wrapperSha256Sum, use -Dtype=script to preserve JAR-based mode
  // (prevents Maven 3.3.x from defaulting to only-script which removes checksums)
  const args = hadWrapperChecksum
    ? 'wrapper:wrapper -Dtype=script'
    : 'wrapper:wrapper';

  return await prepareCommand(
    wrapperExecutableFileName,
    localProjectDir,
    await statLocalFile(wrapperFullyQualifiedPath),
    args,
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
  const localProjectDir = upath.join(
    upath.dirname(packageFileName),
    packageFileName.includes('mvnw') ? '.' : '../../',
  );
  const wrapperFullyQualifiedPath = upath.join(
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
  /* v8 ignore next -- hard to test */
  if (pathFileStats?.isFile() === true) {
    // if the file is not executable by others
    if (os.platform() !== 'win32' && (pathFileStats.mode & 0o1) === 0) {
      // add the execution permission to the owner, group and others
      logger.warn('Maven wrapper is missing the executable bit');
      await chmodLocalFile(
        upath.join(cwd, fileName),
        pathFileStats.mode | 0o111,
      );
    }
    if (args === null) {
      return fileName;
    }
    return `${fileName} ${args}`;
  }
  return null;
}
