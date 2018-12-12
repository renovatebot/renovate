const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const path = require('path');

const gradle = require('./build-gradle');

const GRADLE_DEPENDENCY_REPORT_COMMAND =
  'gradle --init-script init.gradle dependencyUpdates -Drevision=release';
const GRADLE_DEPENDENCY_REPORT_FILENAME = 'build/dependencyUpdates/report.json';
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

  await configureUseLatestVersionPlugin(config.localDir);
  const gradleSuccess = await executeGradle(config);
  if (!gradleSuccess) {
    return null;
  }

  gradle.init();
  const gradleFiles = [];
  for (const packageFile of packageFiles) {
    const content = await platform.getFile(packageFile);
    if (content) {
      const deps = await extractPackageFile(content, packageFile, config);
      if (deps) {
        gradleFiles.push({
          packageFile,
          manager: 'gradle',
          ...deps,
        });
      }
    } else {
      logger.info({ packageFile }, 'packageFile has no content');
    }
  }
  return gradleFiles;
}

async function extractPackageFile(content, fileName, config) {
  logger.debug(`gradle.extractPackageFile(filename=${fileName})`);
  const gradleFile = path.join(config.localDir, fileName);
  const baseDir = path.dirname(gradleFile);

  const deps = await extractDependenciesFromUpdatesReport(baseDir);
  gradle.collectVersionVariables(deps, content);
  return deps.length > 0 ? { deps } : null;
}

function getPackageUpdates(config) {
  logger.debug(`gradle.getPackageUpdates(depName=${config.depName})`);

  if (config.available) {
    return [
      {
        depName: config.depName,
        newValue: config.available.release,
      },
    ];
  }
  return [];
}

function updateDependency(fileContent, upgrade) {
  // prettier-ignore
  logger.debug(`gradle.updateDependency(): packageFile:${upgrade.packageFile} depName:${upgrade.depName}, version:${upgrade.version} ==> ${upgrade.newValue}`);

  const newFileContent = gradle.updateGradleVersion(
    fileContent,
    buildGradleDependency(upgrade),
    upgrade.available.release
  );
  return newFileContent;
}

async function configureUseLatestVersionPlugin(localDir) {
  const content = `
gradle.projectsLoaded {
    rootProject.allprojects {
        buildscript {
            repositories {
                maven {
                 url "https://plugins.gradle.org/m2/"
                }
            }
           dependencies {
            classpath "gradle.plugin.se.patrikerdes:gradle-use-latest-versions-plugin:0.2.3"
            classpath 'com.github.ben-manes:gradle-versions-plugin:0.17.0'
          }
        }
        afterEvaluate { project ->
          project.apply plugin: 'com.github.ben-manes.versions'
          project.apply plugin: 'se.patrikerdes.use-latest-versions'
        }
    }
}
  `;
  const gradleInitFile = path.join(localDir, 'init.gradle');
  logger.debug('Creating init.gradle file');
  await fs.writeFile(gradleInitFile, content);
}

function buildGradleDependency(config) {
  return { group: config.depGroup, name: config.name, version: config.version };
}

async function extractDependenciesFromUpdatesReport(localDir) {
  const filename = path.join(localDir, GRADLE_DEPENDENCY_REPORT_FILENAME);
  if (!(await fs.exists(filename))) {
    return [];
  }

  const contents = await fs.readFile(
    path.join(localDir, GRADLE_DEPENDENCY_REPORT_FILENAME),
    'utf8'
  );
  const dependencies = JSON.parse(contents);
  const combinedGradleDeps = dependencies.current.dependencies.concat(
    dependencies.exceeded.dependencies,
    dependencies.outdated.dependencies,
    dependencies.unresolved.dependencies
  );
  return combinedGradleDeps.map(gradleModule => {
    const dependency = { ...gradleModule };
    delete dependency.group;
    dependency.depGroup = gradleModule.group;
    dependency.depName = `${gradleModule.group}:${gradleModule.name}`;
    dependency.currentValue = gradleModule.version;
    return dependency;
  });
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
  getPackageUpdates,
  updateDependency,
  language: 'java',
};
