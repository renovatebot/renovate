import * as os from 'os';
import * as fs from 'fs-extra';
import { Stats } from 'fs';
import upath from 'upath';
import { exec, ExecOptions } from '../../util/exec';
import { logger } from '../../logger';
import * as gradleVersioning from '../../versioning/gradle';
import {
  ExtractConfig,
  PackageFile,
  UpdateDependencyConfig,
  Upgrade,
} from '../common';
import { platform } from '../../platform';
import { LANGUAGE_JAVA } from '../../constants/languages';
import * as datasourceMaven from '../../datasource/maven';
import { DatasourceError } from '../../datasource';
import { BinarySource } from '../../util/exec/common';
import {
  collectVersionVariables,
  GradleDependency,
  init,
  updateGradleVersion,
} from './build-gradle';
import {
  createRenovateGradlePlugin,
  extractDependenciesFromUpdatesReport,
} from './gradle-updates-report';

export const GRADLE_DEPENDENCY_REPORT_OPTIONS =
  '--init-script renovate-plugin.gradle renovate';
const TIMEOUT_CODE = 143;

export function gradleWrapperFileName(config: ExtractConfig): string {
  if (
    os.platform() === 'win32' &&
    config != null &&
    config.binarySource !== BinarySource.Docker
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
      await fs.chmod(upath.join(cwd, gradlewName), gradlew.mode | 0o111);
    }
    if (args === null) {
      return gradlewName;
    }
    return `${gradlewName} ${args}`;
  }
  /* eslint-enable no-bitwise */
  return null;
}

async function prepareGradleCommandFallback(
  gradlewName: string,
  cwd: string,
  gradlew: Stats | null,
  args: string
): Promise<string> {
  const cmd = await prepareGradleCommand(gradlewName, cwd, gradlew, args);
  if (cmd === null) {
    return `gradle ${args}`;
  }
  return cmd;
}

export async function executeGradle(
  config: ExtractConfig,
  cwd: string,
  gradlew: Stats | null
): Promise<void> {
  let stdout: string;
  let stderr: string;
  const timeout =
    config.gradle && config.gradle.timeout
      ? config.gradle.timeout * 1000
      : undefined;
  const cmd = await prepareGradleCommandFallback(
    gradleWrapperFileName(config),
    cwd,
    gradlew,
    GRADLE_DEPENDENCY_REPORT_OPTIONS
  );
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
  let gradlew: Stats | null;
  for (const packageFile of packageFiles) {
    const dirname = upath.dirname(packageFile);
    const gradlewPath = upath.join(dirname, gradleWrapperFileName(config));
    gradlew = await fs
      .stat(upath.join(config.localDir, gradlewPath))
      .catch(() => null);

    if (['build.gradle', 'build.gradle.kts'].includes(packageFile)) {
      rootBuildGradle = packageFile;
      break;
    }

    // If there is gradlew in the same directory, the directory should be a Gradle project root
    if (gradlew?.isFile() === true) {
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
  versioning: gradleVersioning.id,
};
