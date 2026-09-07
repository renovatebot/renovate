import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { localPathExists, readLocalFile } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import gradleVersioning from '../../versioning/gradle/index.ts';
import { parseJavaToolchainVersion } from '../gradle/parser.ts';
import { prepareWrapperCommand, wrapperFileName } from '../jvm-wrapper.ts';
import type { GradleVersionExtract } from './types.ts';

export const extraEnv = {
  GRADLE_OPTS:
    '-Dorg.gradle.parallel=true -Dorg.gradle.configureondemand=true -Dorg.gradle.daemon=false -Dorg.gradle.caching=false',
};

export function gradleWrapperFileName(): string {
  return wrapperFileName('./gradlew', 'gradlew.bat');
}

export async function prepareGradleCommand(
  gradlewFile: string,
): Promise<string | null> {
  return await prepareWrapperCommand(gradlewFile, gradleWrapperFileName());
}

/**
 * Find compatible java version for gradle.
 * see https://docs.gradle.org/current/userguide/compatibility.html
 * @param gradleVersion current gradle version
 * @param gradlewFile path to gradle wrapper
 * @returns A Java semver range
 */
export async function getJavaConstraint(
  gradleVersion: string | null | undefined,
  gradlewFile: string,
): Promise<string> {
  const major = gradleVersion ? gradleVersioning.getMajor(gradleVersion) : null;
  const minor = gradleVersion ? gradleVersioning.getMinor(gradleVersion) : null;

  if (major) {
    // https://docs.gradle.org/8.8/release-notes.html#daemon-toolchains
    if (major > 8 || (major === 8 && minor && minor >= 8)) {
      const toolChainVersion = await getJvmConfiguration(gradlewFile);
      if (toolChainVersion) {
        return `^${toolChainVersion}.0.0`;
      }
    }
    // https://docs.gradle.org/6.7/release-notes.html#new-jvm-ecosystem-features
    if (major > 6 || (major === 6 && minor && minor >= 7)) {
      const languageVersion = await getJavaLanguageVersion(gradlewFile);
      if (languageVersion) {
        return `^${languageVersion}.0.0`;
      }
    }
    if (major > 9 || (major === 9 && minor && minor >= 1)) {
      return '^25.0.0';
    }
    if (major > 8 || (major === 8 && minor && minor >= 5)) {
      return '^21.0.0';
    }
    if (major > 7 || (major === 7 && minor && minor >= 3)) {
      return '^17.0.0';
    }
    if (major === 7) {
      return '^16.0.0';
    }
    // first public gradle version was 2.0
    if (major > 0 && major < 5) {
      return '^8.0.0';
    }
  }

  return '^11.0.0';
}

/**
 * https://docs.gradle.org/current/userguide/gradle_daemon.html#sec:daemon_jvm_criteria
 */
export async function getJvmConfiguration(
  gradlewFile: string,
): Promise<string | null> {
  const daemonJvmFile = upath.join(
    upath.dirname(gradlewFile),
    'gradle/gradle-daemon-jvm.properties',
  );
  const daemonJvm = await readLocalFile(daemonJvmFile, 'utf8');
  if (daemonJvm) {
    const TOOLCHAIN_VERSION_REGEX = regEx(
      '^(?:toolchainVersion\\s*=\\s*)(?<version>\\d+)$',
      'm',
    );
    const toolChainMatch = TOOLCHAIN_VERSION_REGEX.exec(daemonJvm);
    if (toolChainMatch?.groups) {
      return toolChainMatch.groups.version;
    }
  }

  return null;
}

/**
 * https://docs.gradle.org/current/userguide/toolchains.html#sec:consuming
 */
export async function getJavaLanguageVersion(
  gradlewFile: string,
): Promise<string | null> {
  const localGradleDir = upath.dirname(gradlewFile);
  let buildFileName = upath.join(localGradleDir, 'build.gradle');
  if (!(await localPathExists(buildFileName))) {
    buildFileName = upath.join(localGradleDir, 'build.gradle.kts');
  }

  const buildFileContent = await readLocalFile(buildFileName, 'utf8');
  if (!buildFileContent) {
    logger.debug('build.gradle or build.gradle.kts not found');
    return null;
  }

  return parseJavaToolchainVersion(buildFileContent);
}

// https://regex101.com/r/IcOs7P/1
const DISTRIBUTION_URL_REGEX = regEx(
  '^(?:distributionUrl\\s*=\\s*)(?<url>\\S*-(?<version>\\d+\\.\\d+(?:\\.\\d+)?(?:-\\w+)*)-(?<type>bin|all)\\.zip)\\s*$',
  'm',
);

export function extractGradleVersion(
  fileContent: string,
): GradleVersionExtract | null {
  const distributionUrlMatch = DISTRIBUTION_URL_REGEX.exec(fileContent);
  if (distributionUrlMatch?.groups) {
    return {
      url: distributionUrlMatch.groups.url,
      version: distributionUrlMatch.groups.version,
    };
  }
  logger.debug(
    'Gradle wrapper version and url could not be extracted from properties - skipping update',
  );

  return null;
}
