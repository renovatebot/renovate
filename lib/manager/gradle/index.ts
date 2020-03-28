import * as os from 'os';
import * as fs from 'fs-extra';
import { Stats } from 'fs';

import upath from 'upath';
import { exec, ExecOptions } from '../../util/exec';
import { logger } from '../../logger';

import * as mavenVersioning from '../../versioning/maven';
import {
  init,
  collectVersionVariables,
  updateGradleVersion,
  GradleDependency,
} from './build-gradle';
import {
  createRenovateGradlePlugin,
  extractDependenciesFromUpdatesReport,
} from './gradle-updates-report';
import {
  PackageFile,
  ExtractConfig,
  Upgrade,
  UpdateDependencyConfig,
} from '../common';
import { platform } from '../../platform';
import { LANGUAGE_JAVA } from '../../constants/languages';
import * as datasourceMaven from '../../datasource/maven';
import { DatasourceError } from '../../datasource';
import { BinarySource } from '../../util/exec/common';

export const GRADLE_DEPENDENCY_REPORT_OPTIONS =
  '--init-script renovate-plugin.gradle renovate';
const TIMEOUT_CODE = 143;

function gradleWrapperFileName(config: ExtractConfig): string {
  if (
    os.platform() === 'win32' &&
    config.binarySource !== BinarySource.Docker
  ) {
    /* istanbul ignore next */
    return 'gradlew.bat';
  }
  /* istanbul ignore next */
  return './gradlew';
}

async function prepareGradleCommandLine(
  config: ExtractConfig,
  cwd: string,
  gradlew: Stats
): Promise<string> {
  const args = GRADLE_DEPENDENCY_REPORT_OPTIONS;
  const gradlewName = gradleWrapperFileName(config);

  if (gradlew.isFile()) {
    // if the file is not executable by others
    // eslint-disable-next-line no-bitwise
    if ((gradlew.mode & 0o1) === 0) {
      // add the execution permission to the owner, group and others
      // eslint-disable-next-line no-bitwise
      await fs.chmod(upath.join(cwd, gradlewName), gradlew.mode | 0o111);
    }

    return `${gradlewName} ${args}`;
  }

  return `gradle ${args}`;
}

export async function executeGradle(
  config: ExtractConfig,
  cwd: string,
  gradlew: Stats
): Promise<void> {
  let stdout: string;
  let stderr: string;
  const timeout =
    config.gradle && config.gradle.timeout
      ? config.gradle.timeout * 1000
      : undefined;
  const cmd = await prepareGradleCommandLine(config, cwd, gradlew);
  const execOptions: ExecOptions = {
    timeout,
    cwd,
    docker: {
      image: 'renovate/gradle',
    },
  };
  try {
    logger.debug({ cmd }, 'Start gradle command');
    ({ stdout, stderr } = await exec(cmd, execOptions));
  } catch (err) /* istanbul ignore next */ {
    if (err.code === TIMEOUT_CODE) {
      const error = new DatasourceError(err);
      error.datasource = 'gradle';
      throw error;
    }
    logger.warn({ errMessage: err.message }, 'Gradle extraction failed');
    return;
  }
  logger.debug(stdout + stderr);
  logger.debug('Gradle report complete');
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  let rootBuildGradle: string | undefined;
  let gradlew: Stats;
  for (const packageFile of packageFiles) {
    const dirname = upath.dirname(packageFile);
    const gradlewPath = upath.join(dirname, gradleWrapperFileName(config));
    gradlew = await fs.stat(upath.join(config.localDir, gradlewPath));

    if (['build.gradle', 'build.gradle.kts'].includes(packageFile)) {
      rootBuildGradle = packageFile;
      break;
    }

    // If there is gradlew in the same directory, the directory should be a Gradle project root
    if (gradlew.isFile()) {
      rootBuildGradle = packageFile;
      break;
    }
  }
  if (!rootBuildGradle) {
    logger.warn('No root build.gradle nor build.gradle.kts found - skipping');
    return null;
  }
  logger.debug('Extracting dependencies from all gradle files');

  const cwd = upath.join(config.localDir, upath.dirname(rootBuildGradle));

  await createRenovateGradlePlugin(cwd);
  await executeGradle(config, cwd, gradlew);

  init();

  const dependencies = await extractDependenciesFromUpdatesReport(cwd);
  if (dependencies.length === 0) {
    return [];
  }

  const gradleFiles: PackageFile[] = [];
  for (const packageFile of packageFiles) {
    const content = await platform.getFile(packageFile);
    if (content) {
      gradleFiles.push({
        packageFile,
        datasource: datasourceMaven.id,
        deps: dependencies,
      });

      collectVersionVariables(dependencies, content);
    } else {
      // istanbul ignore next
      logger.debug({ packageFile }, 'packageFile has no content');
    }
  }

  return gradleFiles;
}

function buildGradleDependency(config: Upgrade): GradleDependency {
  return {
    group: config.depGroup,
    name: config.name,
    version: config.currentValue,
  };
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string {
  // prettier-ignore
  logger.debug(`gradle.updateDependency(): packageFile:${upgrade.packageFile} depName:${upgrade.depName}, version:${upgrade.currentValue} ==> ${upgrade.newValue}`);

  return updateGradleVersion(
    fileContent,
    buildGradleDependency(upgrade),
    upgrade.newValue
  );
}

export const language = LANGUAGE_JAVA;

export const defaultConfig = {
  fileMatch: ['\\.gradle(\\.kts)?$', '(^|/)gradle.properties$'],
  timeout: 600,
  versioning: mavenVersioning.id,
};
