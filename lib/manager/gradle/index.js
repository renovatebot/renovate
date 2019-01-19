const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const path = require('path');

const gradle = require('./build-gradle');
const updatesReport = require('./gradle-updates-report');

const GRADLE_DEPENDENCY_REPORT_COMMAND =
  'gradle --init-script init.gradle renovate';
const TIMEOUT_CODE = 143;

async function extractAllPackageFiles(config, packageFiles) {
  if (!packageFiles.some(packageFile => packageFile === 'build.gradle')) {
    logger.warn('No root build.gradle found - skipping');
    return null;
  }
  logger.info('Extracting dependencies from all gradle files');
  // Gradle needs all files to be written to disk before we parse any as some files may reference others
  // But if we're using gitFs then it's not necessary because they're already there
  if (!config.gitFs) {
    for (const packageFile of packageFiles) {
      const localFileName = path.join(config.localDir, packageFile);
      const content = await platform.getFile(packageFile);
      await fs.outputFile(localFileName, content);
    }
  }

  await updatesReport.createRenovateGradlePlugin(config.localDir);
  const gradleSuccess = await executeGradle(config);
  if (!gradleSuccess) {
    logger.warn('No gradle dependencies found');
    return null;
  }

  gradle.init();

  const dependencies = await updatesReport.extractDependenciesFromUpdatesReport(
    config.localDir
  );
  if (dependencies.length === 0) {
    return [];
  }

  for (const packageFile of packageFiles) {
    const content = await platform.getFile(packageFile);
    if (content) {
      gradle.collectVersionVariables(dependencies, content);
    } else {
      logger.info({ packageFile }, 'packageFile has no content');
    }
  }

  return dependencies;
}

function updateDependency(fileContent, upgrade) {
  // prettier-ignore
  logger.debug(`gradle.updateDependency(): packageFile:${upgrade.packageFile} depName:${upgrade.depName}, version:${upgrade.version} ==> ${upgrade.newValue}`);

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
  let cmd;
  if (config.binarySource === 'docker') {
    cmd = getDockerRenovateGradleCommandLine(config.localDir);
  } else {
    cmd = GRADLE_DEPENDENCY_REPORT_COMMAND;
  }
  try {
    logger.debug({ cmd }, 'Start gradle command');
    ({ stdout, stderr } = await exec(cmd, {
      cwd: config.localDir,
      timeout: gradleTimeout,
      shell: true,
    }));
  } catch (err) {
    const errorStr = `Gradle command ${cmd} failed. Exit code: ${err.code}.`;
    // istanbul ignore if
    if (err.code === TIMEOUT_CODE) {
      logger.error(' Process killed. Possibly gradle timed out.');
    }
    logger.warn({ err }, errorStr);
    return false;
  }
  logger.debug(stdout + stderr);
  logger.info('Gradle report complete');
  return true;
}

function getDockerRenovateGradleCommandLine(localDir) {
  return `docker run --rm -v ${localDir}:${localDir} -w ${localDir} renovate/gradle ${GRADLE_DEPENDENCY_REPORT_COMMAND}`;
}

module.exports = {
  extractAllPackageFiles,
  updateDependency,
  language: 'java',
};
