import { Stats } from 'fs';
import { stat } from 'fs-extra';
import { ReleaseType, inc } from 'semver';
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
  readGradleReport,
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
  let rootBuildGradle: string | undefined;
  let gradlew: Stats | null;
  for (const packageFile of packageFiles) {
    const dirname = upath.dirname(packageFile);
    const gradlewPath = upath.join(dirname, gradleWrapperFileName(config));
    gradlew = await stat(upath.join(config.localDir, gradlewPath)).catch(
      () => null
    );

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

  const gradleProjectConfigurations = await readGradleReport(cwd);
  const dependencies = extractDependenciesFromUpdatesReport(
    gradleProjectConfigurations
  );
  if (dependencies.length === 0) {
    return [];
  }

  let gradleProjectVersion = null;
  try {
    gradleProjectVersion = gradleProjectConfigurations.find((c) => c.version)
      .version;
  } catch (e) {
    logger.debug(
      'Was unable to locate a project version within any of the gradle project configurations.'
    );
  }

  const gradleFiles: PackageFile[] = [];
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');

    if (content) {
      const gradleFileObject: PackageFile = {
        packageFile,
        datasource: datasourceMaven.id,
        deps: dependencies,
      };

      if (gradleProjectVersion != null) {
        gradleFileObject.packageFileVersion = gradleProjectVersion;
      }

      gradleFiles.push(gradleFileObject);

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

function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType | string
): string {
  if (!bumpVersion || currentValue == null) {
    return content;
  }

  if (currentValue.endsWith('-SNAPSHOT')) {
    return content;
  }

  /*
   TODO:
    This is currently missing the ability to mirror a package as described in the docs, more work may be required
    here in order to both find and mirror the version. The npm version has access to the package.json, which makes it
    easier to parse.
   */

  const newVersion = inc(currentValue, bumpVersion as ReleaseType);

  if (!newVersion) {
    logger.debug(
      `Unable to increment the project version, likely because the version is not semver. Attempted to bump ${currentValue} by ${bumpVersion} but the new version was ${newVersion}`
    );
    return content;
  }

  const bumpedContent = content.replace(
    /(version\s*=\s*['"])[^'"]*/,
    `$1${newVersion}`
  );

  if (bumpedContent === content) {
    logger.debug('Version was already bumped');
  } else {
    logger.debug('Bumped gradle project version');
  }

  return bumpedContent;
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string {
  // prettier-ignore
  logger.debug(`gradle.updateDependency(): packageFile:${upgrade.packageFile} depName:${upgrade.depName}, version:${upgrade.currentValue} ==> ${upgrade.newValue}`);

  const content = updateGradleVersion(
    fileContent,
    buildGradleDependency(upgrade),
    upgrade.newValue
  );

  return bumpPackageVersion(
    content,
    // This is a holdover from the npm bumpVersion implementation. This should either stay the same with a slightly weird name or be renamed to be more generic.
    upgrade.packageFileVersion,
    upgrade.bumpVersion
  );
}

export const language = LANGUAGE_JAVA;

export const defaultConfig = {
  fileMatch: ['\\.gradle(\\.kts)?$', '(^|/)gradle.properties$'],
  timeout: 600,
  versioning: gradleVersioning.id,
};
