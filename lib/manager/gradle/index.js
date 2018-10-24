const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const path = require('path');

const gradle = require('./build-gradle');

const GRADLE_DEPENDENCY_REPORT_COMMAND =
  'gradle --init-script init.gradle dependencyUpdates -Drevision=release';
const GRADLE_DEPENDENCY_REPORT_FILENAME = 'build/dependencyUpdates/report.json';

async function preExtract(config, packageFiles) {
  // eslint-disable-next-line guard-for-in
  for (const fileName in packageFiles) {
    await mkdirp(config.localDir, fileName);
    const gradleFile = path.join(config.localDir, fileName);
    logger.debug(`preExtract=${fileName}`);
    await fs.writeFile(gradleFile, packageFiles[fileName]);
  }
}

async function extractDependencies(content, fileName, config) {
  logger.debug(`gradle.extractDependencies(filename=${fileName})`);
  const gradleFile = path.join(config.localDir, fileName);
  const baseDir = path.dirname(gradleFile);

  if (isProjectRootGradle(fileName)) {
    await configureUseLatestVersionPlugin(baseDir);
    const gradleSuccess = await executeGradle(baseDir, config);
    if (!gradleSuccess) {
      return null;
    }
  }

  const deps = await extractDependenciesFromUpdatesReport(baseDir);
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
  await fs.writeFile(gradleInitFile, content);
}

function buildGradleDependency(config) {
  return { group: config.depGroup, name: config.name, version: config.version };
}

async function extractDependenciesFromUpdatesReport(localDir) {
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

async function executeGradle(baseDir, config) {
  let stdout;
  let stderr;
  const gradleTimeout =
    config.gradle && config.gradle.timeout
      ? config.gradle.timeout * 1000
      : undefined;
  try {
    logger.debug('Start gradle command');
    ({ stdout, stderr } = await exec(GRADLE_DEPENDENCY_REPORT_COMMAND, {
      cwd: baseDir,
      timeout: gradleTimeout,
      shell: true,
    }));
  } catch (err) {
    logger.error(err);
    logger.error(`Gradle command ${GRADLE_DEPENDENCY_REPORT_COMMAND} failed.`);
    return false;
  }
  logger.info(stdout + stderr);
  logger.info('Gradle report complete');
  return true;
}

async function mkdirp(localDir, dir) {
  const parts = path.dirname(dir).split('/');

  for (let i = 1; i <= parts.length; i += 1) {
    const pathToCreate = path.join.apply(
      null,
      [localDir].concat(parts.slice(0, i))
    );
    if (!(await fs.pathExists(pathToCreate))) {
      await fs.mkdir(pathToCreate);
    }
  }
}

function isProjectRootGradle(fileName) {
  return fileName === 'build.gradle';
}

module.exports = {
  extractDependencies,
  getPackageUpdates,
  preExtract,
  updateDependency,
  language: 'java',
};
