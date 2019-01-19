const path = require('path');
const fs = require('fs-extra');

const GRADLE_DEPENDENCY_REPORT_FILENAME = 'gradle-renovate-report.json';

async function createRenovateGradlePlugin(localDir) {
  const content = `
import groovy.json.JsonOutput
import org.gradle.api.internal.artifacts.dependencies.DefaultExternalModuleDependency
  
def outputFile = new File('${GRADLE_DEPENDENCY_REPORT_FILENAME}')
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
  logger.debug('Creating init.gradle file with renovate gradle plugin');
  await fs.writeFile(gradleInitFile, content);
}

async function extractDependenciesFromUpdatesReport(localDir) {
  const gradleProjectConfigurations = await readGradleReport(localDir);

  const dependencies = gradleProjectConfigurations
    .map(mergeDependenciesWithRepositories, [])
    .reduce(flatternDependencies, [])
    .reduce(combineReposOnDuplicatedDependencies, []);

  return dependencies.map(gradleModule => {
    return buildDependency(gradleModule);
  });
}

async function readGradleReport(localDir) {
  const renovateReportFilename = path.join(
    localDir,
    GRADLE_DEPENDENCY_REPORT_FILENAME
  );
  if (!(await fs.exists(renovateReportFilename))) {
    return [];
  }

  const contents = await fs.readFile(renovateReportFilename, 'utf8');
  try {
    return JSON.parse(contents);
  } catch (e) {
    logger.error('Invalid JSON', e);
    return [];
  }
}

const mergeDependenciesWithRepositories = function(project) {
  if (!project.dependencies) {
    return [];
  }
  return project.dependencies.map(dep => {
    return {
      ...dep,
      repos: [...project.repositories],
    };
  });
};

const flatternDependencies = function(accumulator, currentValue) {
  accumulator.push(...currentValue);
  return accumulator;
};

const combineReposOnDuplicatedDependencies = function(
  accumulator,
  currentValue
) {
  const existingDependency = accumulator.find(dep => {
    return dep.name === currentValue.name;
  });
  if (!existingDependency) {
    accumulator.push(currentValue);
  } else {
    existingDependency.repos.push(...currentValue.repos);
  }
  return accumulator;
};

function buildDependency(gradleModule) {
  const repositories = gradleModule.repos.join(',');
  return {
    name: gradleModule.name,
    depGroup: gradleModule.group,
    depName: `${gradleModule.group}:${gradleModule.name}`,
    currentValue: gradleModule.version,
    purl: `pkg:maven/${gradleModule.group}/${
      gradleModule.name
    }?repository_url=${repositories}`,
  };
}

module.exports = {
  extractDependenciesFromUpdatesReport,
  createRenovateGradlePlugin,
  GRADLE_DEPENDENCY_REPORT_FILENAME,
};
