import type { Stats } from 'fs';
import os from 'os';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { chmod } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import gradleVersioning from '../../versioning/gradle';
import { id as npmVersioning } from '../../versioning/npm';
import type { GradleVersionExtract } from './types';

export const extraEnv = {
  GRADLE_OPTS:
    '-Dorg.gradle.parallel=true -Dorg.gradle.configureondemand=true -Dorg.gradle.daemon=false -Dorg.gradle.caching=false',
};

// istanbul ignore next
export function gradleWrapperFileName(): string {
  if (
    os.platform() === 'win32' &&
    GlobalConfig.get('binarySource') !== 'docker'
  ) {
    return 'gradlew.bat';
  }
  return './gradlew';
}

export async function prepareGradleCommand(
  gradlewName: string,
  cwd: string,
  gradlew: Stats | null,
  args: string | null
): Promise<string | null> {
  // istanbul ignore if
  if (gradlew?.isFile() === true) {
    // if the file is not executable by others
    if ((gradlew.mode & 0o1) === 0) {
      // add the execution permission to the owner, group and others
      await chmod(upath.join(cwd, gradlewName), gradlew.mode | 0o111);
    }
    if (args === null) {
      return gradlewName;
    }
    return `${gradlewName} ${args}`;
  }
  /* eslint-enable no-bitwise */
  return null;
}

/**
 * Find compatible java version for gradle.
 * see https://docs.gradle.org/current/userguide/compatibility.html
 * @param gradleVersion current gradle version
 * @returns A Java semver range
 */
export function getJavaContraint(gradleVersion: string): string | null {
  if (GlobalConfig.get('binarySource') !== 'docker') {
    // ignore
    return null;
  }

  const major = gradleVersioning.getMajor(gradleVersion);
  if (major && major >= 7) {
    return '^16.0.0';
  }
  // first public gradle version was 2.0
  if (major && major > 0 && major < 5) {
    return '^8.0.0';
  }
  return '^11.0.0';
}

export function getJavaVersioning(): string {
  return npmVersioning;
}

// https://regex101.com/r/IcOs7P/1
const DISTRIBUTION_URL_REGEX = regEx(
  '^(?:distributionUrl\\s*=\\s*)(?<url>\\S*-(?<version>\\d+\\.\\d+(?:\\.\\d+)?(?:-\\w+)*)-(?<type>bin|all)\\.zip)\\s*$'
);

export function extractGradleVersion(
  fileContent: string
): GradleVersionExtract | null {
  const lines = fileContent?.split(newlineRegex) ?? [];

  for (const line of lines) {
    const distributionUrlMatch = DISTRIBUTION_URL_REGEX.exec(line);

    if (distributionUrlMatch?.groups) {
      return {
        url: distributionUrlMatch.groups.url,
        version: distributionUrlMatch.groups.version,
      };
    }
  }
  logger.debug(
    'Gradle wrapper version and url could not be extracted from properties - skipping update'
  );

  return null;
}
