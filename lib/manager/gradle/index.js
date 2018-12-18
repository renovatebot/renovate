const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const path = require('path');

const gradle = require('./build-gradle');

const GRADLE_DEPENDENCY_REPORT_COMMAND =
  'gradle --init-script init.gradle renovate';
const GRADLE_DEPENDENCY_REPORT_FILENAME = 'renovate.json';
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

  const gradleProjectConfigurations = await readGradleReport(config.localDir);
  gradle.init();
  const gradleFiles = [];

  config.maven = {
    repositories: extractMavenRepositories(gradleProjectConfigurations)
  };
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
  const deps = await extractDependenciesFromUpdatesReport(config.localDir);
  gradle.collectVersionVariables(deps, content);
  return deps.length > 0 ? { deps } : null;
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

async function readGradleReport(localDir) {
  const renovateReportFilename = path.join(localDir, GRADLE_DEPENDENCY_REPORT_FILENAME);
  if (!(await fs.exists(renovateReportFilename))) {
    return [];
  }

  const contents = await fs.readFile(
    renovateReportFilename,
    'utf8'
  );
  return JSON.parse(contents);
}

async function configureUseLatestVersionPlugin(localDir) {
  const content = `
import groovy.json.JsonOutput
import org.gradle.api.internal.artifacts.dependencies.DefaultExternalModuleDependency
  
def outputFile = new File('renovate.json')
def output = []

allprojects {

  tasks.register("renovate") {
    doLast {
        def project = ['project': project.name]
        output << project
        def repos = repositories.collect { "$it.url" }
        project.repositories = repos
        def deps = configurations.collect { config ->
          config.dependencies
            .find { it instanceof DefaultExternalModuleDependency }
            .collect { ['name':it.name, 'group':it.group, 'version':it.version] }
        }.flatten()
        project.dependencies = deps
        def json = JsonOutput.toJson(output)
        outputFile.write json
    }
  }
}  `;
  const gradleInitFile = path.join(localDir, 'init.gradle');
  logger.debug('Creating init.gradle file');
  await fs.writeFile(gradleInitFile, content);
}

function extractMavenRepositories(gradleProjectConfigurations) {
  return gradleProjectConfigurations
    .map(proj => proj.repositories)
    .reduce((accumulator, currentValue) => {
      accumulator.push(...currentValue);
      return accumulator
    });
}

function buildGradleDependency(config) {
  return { group: config.depGroup, name: config.name, version: config.version };
}

async function extractDependenciesFromUpdatesReport(localDir) {
  const gradleProjectConfigurations = await readGradleReport(localDir);
  const flatDeps = gradleProjectConfigurations
    .map(project => project.dependencies)
    .reduce((accumulator, currentValue) => {
      accumulator.push(...currentValue);
      return accumulator
  }, []);

  return flatDeps.map(gradleModule => {
    const dependency = { ...gradleModule };
    delete dependency.group;
    dependency.depGroup = gradleModule.group;
    dependency.depName = `${gradleModule.group}:${gradleModule.name}`;
    dependency.currentValue = gradleModule.version;
    dependency.purl = `pkg:maven/${dependency.depName}@${dependency.currentValue}`;
    dependency.versionScheme = 'loose';
    return dependency;
  })
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
