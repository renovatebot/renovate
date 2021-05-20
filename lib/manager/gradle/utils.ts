import { Stats } from 'fs';
import os from 'os';
import { chmod } from 'fs-extra';
import upath from 'upath';
import { BinarySource } from '../../util/exec/common';
import type { ExtractConfig } from '../types';

export const extraEnv = {
  GRADLE_OPTS:
    '-Dorg.gradle.parallel=true -Dorg.gradle.configureondemand=true -Dorg.gradle.daemon=false -Dorg.gradle.caching=false',
};

export function gradleWrapperFileName(config: ExtractConfig): string {
  if (
    os.platform() === 'win32' &&
    config?.binarySource !== BinarySource.Docker
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
