const fs = require('fs-extra');
const { exec } = require('../../util/exec');
const { logger } = require('../../logger');

const gradle = require('./build-gradle');
const updatesReport = require('./gradle-updates-report');

const GRADLE_DEPENDENCY_REPORT_OPTIONS =
  '--init-script renovate-plugin.gradle renovate';
const TIMEOUT_CODE = 143;

async function extractAllPackageFiles(config, packageFiles) {
  if (!packageFiles.some(packageFile => packageFile === 'build.gradle')) {
    logger.warn('No root build.gradle found - skipping');
    return null;
  }
  logger.info('Extracting dependencies from all gradle files');

  await updatesReport.createRenovateGradlePlugin(config.localDir);
  await executeGradle(config);

  gradle.init();

  const dependencies = await updatesReport.extractDependenciesFromUpdatesReport(
    config.localDir
  );
  if (dependencies.length === 0) {
    return [];
  }

  const gradleFiles = [];
  for (const packageFile of packageFiles) {
    const content = await platform.getFile(packageFile);
    if (content) {
      gradleFiles.push({
        packageFile,
        manager: 'gradle',
        datasource: 'maven',
        deps: dependencies,
      });

      gradle.collectVersionVariables(dependencies, content);
    } else {
      // istanbul ignore next
      logger.info({ packageFile }, 'packageFile has no content');
    }
  }

  return gradleFiles;
}

function updateDependency(fileContent, upgrade) {
  // prettier-ignore
  logger.debug(`gradle.updateDependency(): packageFile:${upgrade.packageFile} depName:${upgrade.depName}, version:${upgrade.currentVersion} ==> ${upgrade.newValue}`);

  return gradle.updateGradleVersion(
    fileContent,
    buildGradleDependency(upgrade),
    upgrade.newValue
  );
}

function buildGradleDependency(config) {
  return { group: config.depGroup, name: config.name, version: config.version };
}

async function executeGradle(config) {
  let stdout;
  let stderr;
  const gradleTimeout =
    config.gradle && config.gradle.timeout
      ? config.gradle.timeout * 1000
      : undefined;
  const cmd = await getGradleCommandLine(config);
  try {
    logger.debug({ cmd }, 'Start gradle command');
    ({ stdout, stderr } = await exec(cmd, {
      cwd: config.localDir,
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

async function getGradleCommandLine(config) {
  let cmd;
  const gradlewExists = await fs.exists(config.localDir + '/gradlew');
  if (config.binarySource === 'docker') {
    cmd = `docker run --rm -v ${config.localDir}:${config.localDir} -w ${config.localDir} renovate/gradle gradle`;
  } else if (gradlewExists) {
    cmd = 'sh gradlew';
  } else {
    cmd = 'gradle';
  }
  return cmd + ' ' + GRADLE_DEPENDENCY_REPORT_OPTIONS;
}

module.exports = {
  extractAllPackageFiles,
  updateDependency,
  language: 'java',
};
