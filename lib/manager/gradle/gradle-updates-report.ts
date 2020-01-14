import { join } from 'path';
import { writeFile, exists, readFile } from 'fs-extra';
import { logger } from '../../logger';

const GRADLE_DEPENDENCY_REPORT_FILENAME = 'gradle-renovate-report.json';

interface GradleProject {
  project: string;
  repositories: string[];
  dependencies: GradleDependency[];
}

interface GradleDependency {
  name: string;
  group: string;
  version: string;
}

type GradleDependencyWithRepos = GradleDependency & { repos: string[] };

// TODO: Unify with GradleDependency ?
export interface BuildDependency {
  name: string;
  depGroup: string;
  depName?: string;
  currentValue?: string;
  registryUrls?: string[];
}

async function createRenovateGradlePlugin(localDir: string): Promise<void> {
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
        def repos = (repositories + settings.pluginManagement.repositories)
           .collect { "$it.url" }
           .findAll { !it.startsWith('file:') }
           .unique()
        project.repositories = repos
        def deps = (buildscript.configurations + configurations)
          .collect { it.dependencies + it.dependencyConstraints }
          .flatten()
          .findAll { it instanceof DefaultExternalModuleDependency || it instanceof DependencyConstraint }
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
  const gradleInitFile = join(localDir, 'renovate-plugin.gradle');
  logger.debug(
    'Creating renovate-plugin.gradle file with renovate gradle plugin'
  );
  await writeFile(gradleInitFile, content);
}

async function readGradleReport(localDir: string): Promise<GradleProject[]> {
  const renovateReportFilename = join(
    localDir,
    GRADLE_DEPENDENCY_REPORT_FILENAME
  );
  if (!(await exists(renovateReportFilename))) {
    return [];
  }

  const contents = await readFile(renovateReportFilename, 'utf8');
  try {
    return JSON.parse(contents);
  } catch (err) {
    logger.error({ err }, 'Invalid JSON');
    return [];
  }
}

function mergeDependenciesWithRepositories(
  project: GradleProject
): GradleDependencyWithRepos[] {
  if (!project.dependencies) {
    return [];
  }
  return project.dependencies.map(dep => ({
    ...dep,
    repos: [...project.repositories],
  }));
}

function flatternDependencies(
  accumulator: GradleDependencyWithRepos[],
  currentValue: GradleDependencyWithRepos[]
): GradleDependencyWithRepos[] {
  accumulator.push(...currentValue);
  return accumulator;
}

function combineReposOnDuplicatedDependencies(
  accumulator: GradleDependencyWithRepos[],
  currentValue: GradleDependencyWithRepos
): GradleDependencyWithRepos[] {
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

function buildDependency(
  gradleModule: GradleDependencyWithRepos
): BuildDependency {
  return {
    name: gradleModule.name,
    depGroup: gradleModule.group,
    depName: `${gradleModule.group}:${gradleModule.name}`,
    currentValue: gradleModule.version,
    registryUrls: gradleModule.repos,
  };
}

async function extractDependenciesFromUpdatesReport(
  localDir: string
): Promise<BuildDependency[]> {
  const gradleProjectConfigurations = await readGradleReport(localDir);

  const dependencies = gradleProjectConfigurations
    .map(mergeDependenciesWithRepositories, [])
    .reduce(flatternDependencies, [])
    .reduce(combineReposOnDuplicatedDependencies, []);

  return dependencies
    .map(gradleModule => buildDependency(gradleModule))
    .map(dep => {
      /* https://github.com/renovatebot/renovate/issues/4627 */
      const { depName, currentValue } = dep;
      if (depName.endsWith('_%%')) {
        return {
          ...dep,
          depName: depName.replace(/_%%/, ''),
          datasource: 'sbt',
        };
      }
      if (/^%.*%$/.test(currentValue)) {
        return { ...dep, skipReason: 'version-placeholder' };
      }
      return dep;
    });
}

export {
  extractDependenciesFromUpdatesReport,
  createRenovateGradlePlugin,
  GRADLE_DEPENDENCY_REPORT_FILENAME,
};
