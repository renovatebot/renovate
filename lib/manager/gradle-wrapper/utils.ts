import type { Stats } from 'fs';
import os from 'os';
import upath from 'upath';
import { getGlobalConfig } from '../../config/global';
import { chmod } from '../../util/fs';
import { regEx } from '../../util/regex';
import gradleVersioning from '../../versioning/gradle';
import { id as npmVersioning } from '../../versioning/npm';

export const extraEnv = {
  GRADLE_OPTS:
    '-Dorg.gradle.parallel=true -Dorg.gradle.configureondemand=true -Dorg.gradle.daemon=false -Dorg.gradle.caching=false',
};

export function gradleWrapperFileName(): string {
  if (
    os.platform() === 'win32' &&
    getGlobalConfig()?.binarySource !== 'docker'
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
): Promise<string> {
  /* eslint-disable no-bitwise */
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
  if (getGlobalConfig()?.binarySource !== 'docker') {
    // ignore
    return null;
  }

  const major = gradleVersioning.getMajor(gradleVersion);
  if (major >= 7) {
    return '^16.0.0';
  }
  if (major < 5) {
    return '^8.0.0';
  }
  return '^11.0.0';
}

export function getJavaVersioning(): string {
  return npmVersioning;
}

// https://regex101.com/r/1GaQ2X/1
const DISTRIBUTION_URL_REGEX = regEx(
  '^(?:distributionUrl\\s*=\\s*)\\S*-(?<version>\\d+\\.\\d+(?:\\.\\d+)?(?:-\\w+)*)-(?<type>bin|all)\\.zip\\s*$'
);

export function extractGradleVersion(fileContent: string): string | null {
  const lines = fileContent?.split('\n') ?? [];

  for (const line of lines) {
    const distributionUrlMatch = DISTRIBUTION_URL_REGEX.exec(line);
    if (distributionUrlMatch) {
      return distributionUrlMatch.groups.version;
    }
  }

  return null;
}
