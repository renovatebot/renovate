import type { Stats } from 'fs';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { ExternalHostError } from '../../../../types/errors/external-host-error';
import { exec } from '../../../../util/exec';
import type { ExecOptions } from '../../../../util/exec/types';
import { readLocalFile, stat } from '../../../../util/fs';
import { MavenDatasource } from '../../../datasource/maven';
import {
  extraEnv,
  getJavaVersioning,
  gradleWrapperFileName,
  prepareGradleCommand,
} from '../../gradle-wrapper/utils';
import type {
  ExtractConfig,
  PackageFile,
  UpdateDependencyConfig,
  Upgrade,
} from '../../types';
import {
  collectVersionVariables,
  init,
  updateGradleVersion,
} from './build-gradle';
import {
  createRenovateGradlePlugin,
  extractDependenciesFromUpdatesReport,
} from './gradle-updates-report';
import type { GradleDependency } from './types';
import { getDockerConstraint, getDockerPreCommands } from './utils';

export const GRADLE_DEPENDENCY_REPORT_OPTIONS =
  '--init-script renovate-plugin.gradle renovate';
const TIMEOUT_CODE = 143;

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
  gradlew: Stats | null,
  gradleRoot = '.'
): Promise<void> {
  let stdout: string;
  let stderr: string;
  let timeout: number;
  if (config.gradle?.timeout) {
    timeout = config.gradle.timeout * 1000;
  }
  const cmd = await prepareGradleCommandFallback(
    gradleWrapperFileName(),
    cwd,
    gradlew,
    GRADLE_DEPENDENCY_REPORT_OPTIONS
  );
  const execOptions: ExecOptions = {
    timeout,
    cwd,
    docker: {
      image: 'java',
      tagConstraint:
        config.constraints?.java ?? (await getDockerConstraint(gradleRoot)),
      tagScheme: getJavaVersioning(),
    },
    preCommands: await getDockerPreCommands(gradleRoot),
    extraEnv,
  };
  try {
    logger.debug({ cmd }, 'Start gradle command');
    ({ stdout, stderr } = await exec(cmd, execOptions));
  } catch (err) /* istanbul ignore next */ {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    if (err.code === TIMEOUT_CODE) {
      throw new ExternalHostError(err, 'gradle');
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
  const { localDir } = GlobalConfig.get();
  for (const packageFile of packageFiles) {
    const dirname = upath.dirname(packageFile);
    const gradlewPath = upath.join(dirname, gradleWrapperFileName());
    gradlew = await stat(upath.join(localDir, gradlewPath)).catch(() => null);

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

  const gradleRoot = upath.dirname(rootBuildGradle);
  const cwd = upath.join(localDir, gradleRoot);

  await createRenovateGradlePlugin(gradleRoot);
  await executeGradle(config, cwd, gradlew, gradleRoot);

  init();

  const dependencies = await extractDependenciesFromUpdatesReport(gradleRoot);
  if (dependencies.length === 0) {
    return [];
  }

  const gradleFiles: PackageFile[] = [];
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    // istanbul ignore else
    if (content) {
      gradleFiles.push({
        packageFile,
        datasource: MavenDatasource.id,
        deps: dependencies,
      });

      collectVersionVariables(dependencies, content);
    } else {
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

  if (upgrade.updateType === 'replacement') {
    logger.warn('gradle manager does not support replacement updates yet');
    return null;
  }

  return updateGradleVersion(
    fileContent,
    buildGradleDependency(upgrade),
    upgrade.newValue
  );
}
