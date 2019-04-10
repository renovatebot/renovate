const path = require('path');
const fs = require('fs-extra');

const GRADLE_DEPENDENCY_REPORT_FILENAME = 'gradle-renovate-report.json';

async function createRenovateGradlePlugin(localDir) {
  const content = `
import groovy.json.JsonOutput
import org.gradle.api.internal.artifacts.dependencies.DefaultExternalModuleDependency
import java.util.concurrent.ConcurrentLinkedQueue

def output = new ConcurrentLinkedQueue<>();

allprojects {
  tasks.register("renovate") {
    doLast {
        def project = ['project': project.name]
        output << project
        def repos = repositories
           .collect { "$it.url" }
           .findAll { !it.startsWith('file:') }
        project.repositories = repos
        def deps = configurations
          .collect { it.dependencies }
          .flatten()
          .findAll { it instanceof DefaultExternalModuleDependency }
          .collect { ['name':it.name, 'group':it.group, 'version':it.version] }
        project.dependencies = deps
    }
  }
}

gradle.buildFinished {
   def outputFile = new File('${GRADLE_DEPENDENCY_REPORT_FILENAME}')
   def json = JsonOutput.toJson(output)
   outputFile.write json
}  `;
  const gradleInitFile = path.join(localDir, 'renovate-plugin.gradle');
  logger.debug(
    'Creating renovate-plugin.gradle file with renovate gradle plugin'
  );
  await fs.writeFile(gradleInitFile, content);
}

async function extractDependenciesFromUpdatesReport(localDir) {
  const gradleProjectConfigurations = await readGradleReport(localDir);

  const dependencies = gradleProjectConfigurations
    .map(mergeDependenciesWithRepositories, [])
    .reduce(flatternDependencies, [])
    .reduce(combineReposOnDuplicatedDependencies, []);

  return dependencies.map(gradleModule => buildDependency(gradleModule));
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

function mergeDependenciesWithRepositories(project) {
  if (!project.dependencies) {
    return [];
  }
  return project.dependencies.map(dep => ({
    ...dep,
    repos: [...project.repositories],
  }));
}

function flatternDependencies(accumulator, currentValue) {
  accumulator.push(...currentValue);
  return accumulator;
}

function combineReposOnDuplicatedDependencies(accumulator, currentValue) {
  const existingDependency = accumulator.find(
    dep => dep.name === currentValue.name && dep.group === currentValue.group
  );
  if (!existingDependency) {
    accumulator.push(currentValue);
  } else {
    const nonExistingRepos = currentValue.repos.filter(
      repo => existingDependency.repos.indexOf(repo) === -1
    );
    existingDependency.repos.push(...nonExistingRepos);
  }
  return accumulator;
}

function buildDependency(gradleModule) {
  return {
    name: gradleModule.name,
    depGroup: gradleModule.group,
    depName: `${gradleModule.group}:${gradleModule.name}`,
    currentValue: gradleModule.version,
    registryUrls: gradleModule.repos,
  };
}

module.exports = {
  extractDependenciesFromUpdatesReport,
  createRenovateGradlePlugin,
  GRADLE_DEPENDENCY_REPORT_FILENAME,
};
