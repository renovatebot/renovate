import { exists } from 'fs-extra';
import upath from 'upath';

import { exec } from '../../util/exec';
import { logger } from '../../logger';

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
import { PackageFile, ExtractConfig, Upgrade } from '../common';
import { platform } from '../../platform';

const GRADLE_DEPENDENCY_REPORT_OPTIONS =
  '--init-script renovate-plugin.gradle renovate';
const TIMEOUT_CODE = 143;

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  let rootBuildGradle: string | undefined;
  for (const packageFile of packageFiles) {
    if (['build.gradle', 'build.gradle.kts'].includes(packageFile)) {
      rootBuildGradle = packageFile;
      break;
    }

    // If there is gradlew in the same directory, the directory should be a Gradle project root
    const dirname = upath.dirname(packageFile);
    const gradlewPath = upath.join(dirname, 'gradlew');
    const gradlewExists = await exists(
      upath.join(config.localDir, gradlewPath)
    );
    if (gradlewExists) {
      rootBuildGradle = packageFile;
      break;
    }
  }
  if (!rootBuildGradle) {
    logger.warn('No root build.gradle nor build.gradle.kts found - skipping');
    return null;
  }
  logger.info('Extracting dependencies from all gradle files');

  const cwd = upath.join(config.localDir, upath.dirname(rootBuildGradle));

  await createRenovateGradlePlugin(cwd);
  await executeGradle(config, cwd);

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
        manager: 'gradle',
        datasource: 'maven',
        deps: dependencies,
      });

      collectVersionVariables(dependencies, content);
    } else {
      // istanbul ignore next
      logger.info({ packageFile }, 'packageFile has no content');
    }
  }

  return gradleFiles;
}

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string {
  // prettier-ignore
  logger.debug(`gradle.updateDependency(): packageFile:${upgrade.packageFile} depName:${upgrade.depName}, version:${upgrade.currentVersion} ==> ${upgrade.newValue}`);

  return updateGradleVersion(
    fileContent,
    buildGradleDependency(upgrade),
    upgrade.newValue
  );
}

function buildGradleDependency(config: Upgrade): GradleDependency {
  return { group: config.depGroup, name: config.name, version: config.version };
}

async function executeGradle(config: ExtractConfig, cwd: string) {
  let stdout: string;
  let stderr: string;
  const gradleTimeout =
    config.gradle && config.gradle.timeout
      ? config.gradle.timeout * 1000
      : undefined;
  const cmd = await getGradleCommandLine(config, cwd);
  try {
    logger.debug({ cmd }, 'Start gradle command');
    ({ stdout, stderr } = await exec(cmd, {
      cwd,
      timeout: gradleTimeout,
    }));
  } catch (err) {
    const errorStr = `Gradle command ${cmd} failed. Exit code: ${err.code}.`;
    // istanbul ignore if
    if (err.code === TIMEOUT_CODE) {
      logger.error(' Process killed. Possibly gradle timed out.');
    }
    // istanbul ignore if
    if (err.message.includes('Could not resolve all files for configuration')) {
      logger.debug({ err }, 'Gradle error');
      logger.warn('Gradle resolution error');
      return;
    }
    logger.warn({ err }, errorStr);
    logger.info('Aborting Renovate due to Gradle lookup errors');
    throw new Error('registry-failure');
  }
  logger.debug(stdout + stderr);
  logger.info('Gradle report complete');
}

async function getGradleCommandLine(
  config: ExtractConfig,
  cwd: string
): Promise<string> {
  let cmd: string;
  const gradlewExists = await exists(upath.join(cwd, 'gradlew'));
  if (config.binarySource === 'docker') {
    cmd = `docker run --rm `;
    // istanbul ignore if
    if (config.dockerUser) {
      cmd += `--user=${config.dockerUser} `;
    }
    cmd += `-v ${cwd}:${cwd} -w ${cwd} `;
    cmd += `renovate/gradle gradle`;
  } else if (gradlewExists) {
    cmd = 'sh gradlew';
  } else {
    cmd = 'gradle';
  }
  return cmd + ' ' + GRADLE_DEPENDENCY_REPORT_OPTIONS;
}

export const language = 'java';
