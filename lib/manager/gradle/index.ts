import { Stats } from 'fs';
import { stat } from 'fs-extra';
import upath from 'upath';
import { LANGUAGE_JAVA } from '../../constants/languages';
import * as datasourceMaven from '../../datasource/maven';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { ExecOptions, exec } from '../../util/exec';
import { readLocalFile } from '../../util/fs';
import * as gradleVersioning from '../../versioning/gradle';
import {
  ExtractConfig,
  PackageFile,
  UpdateDependencyConfig,
  Upgrade,
} from '../common';
import {
  GradleDependency,
  collectVersionVariables,
  init,
  updateGradleVersion,
} from './build-gradle';
import {
  createRenovateGradlePlugin,
  extractDependenciesFromUpdatesReport,
} from './gradle-updates-report';
import { extraEnv, gradleWrapperFileName, prepareGradleCommand } from './utils';

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
  gradlew: Stats | null
): Promise<void> {
  let stdout: string;
  let stderr: string;
  let timeout;
  if (config.gradle?.timeout) {
    timeout = config.gradle.timeout * 1000;
  }
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
    extraEnv,
  };
  try {
    logger.debug({ cmd }, 'Start gradle command');
    ({ stdout, stderr } = await exec(cmd, execOptions));
  } catch (err) /* istanbul ignore next */ {
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
  const rootDirs = new Set<string>(
    packageFiles.map((x) => upath.join(config.localDir, upath.dirname(x)))
  );
  for (const x of packageFiles) {
    const xdir = upath.dirname(x);
    for (const y of packageFiles) {
      const ydir = upath.dirname(y);
      if (xdir !== ydir && xdir.startsWith(ydir)) {
        rootDirs.delete(xdir);
      }
    }
  }

  if (!rootDirs.size) {
    logger.warn('No root build.gradle nor build.gradle.kts found - skipping');
    return null;
  }
  logger.debug('Extracting dependencies from all gradle files');

  for (const cwd of rootDirs) {
    debugger;
    const gradlewPath = upath.join(cwd, gradleWrapperFileName(config));
    debugger;
    const gradlew = await stat(upath.join(config.localDir, gradlewPath)).catch(
      () => null
    );
    debugger;
    await createRenovateGradlePlugin(cwd);
    debugger;
    await executeGradle(config, cwd, gradlew);

    debugger;
    init();
  }

  debugger;

  const gradleFiles: PackageFile[] = [];
  for (const packageFile of packageFiles) {
    const cwd = upath.join(config.localDir, upath.dirname(packageFile));
    const dependencies = await extractDependenciesFromUpdatesReport(cwd);
    const content = await readLocalFile(packageFile, 'utf8');
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
  return gradleFiles.length ? gradleFiles : null;
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
