import { join } from 'path';
import { writeFile, exists, readFile } from 'fs-extra';
import { logger } from '../../logger';

const GRADLE_DEPENDENCY_REPORT_FILENAME = 'gradle-renovate-report.json';

interface GraddleProject {
  project: string;
  repositories: string[];
  dependencies: GraddleModule[];
}

interface GraddleModule {
  name: string;
  group: string;
  version: string;
}

type GraddleModuleWithRepos = GraddleModule & { repos: string[] };

// TODO: Unify with GraddleDependency ?
export interface BuildDependency {
  name: string;
  depGroup: string;
  depName?: string;
  currentValue?: string;
  registryUrls?: string[];
}

async function createRenovateGradlePlugin(localDir: string) {
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
  const gradleInitFile = join(localDir, 'renovate-plugin.gradle');
  logger.debug(
    'Creating renovate-plugin.gradle file with renovate gradle plugin'
  );
  await writeFile(gradleInitFile, content);
}

async function extractDependenciesFromUpdatesReport(localDir: string) {
  const gradleProjectConfigurations = await readGradleReport(localDir);

  const dependencies = gradleProjectConfigurations
    .map(mergeDependenciesWithRepositories, [])
    .reduce(flatternDependencies, [])
    .reduce(combineReposOnDuplicatedDependencies, []);

  return dependencies.map(gradleModule => buildDependency(gradleModule));
}

async function readGradleReport(localDir: string): Promise<GraddleProject[]> {
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
  project: GraddleProject
): GraddleModuleWithRepos[] {
  if (!project.dependencies) {
    return [];
  }
  return project.dependencies.map(dep => ({
    ...dep,
    repos: [...project.repositories],
  }));
}

function flatternDependencies(
  accumulator: GraddleModuleWithRepos[],
  currentValue: GraddleModuleWithRepos[]
) {
  accumulator.push(...currentValue);
  return accumulator;
}

function combineReposOnDuplicatedDependencies(
  accumulator: GraddleModuleWithRepos[],
  currentValue: GraddleModuleWithRepos
): GraddleModuleWithRepos[] {
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
  gradleModule: GraddleModuleWithRepos
): BuildDependency {
  return {
    name: gradleModule.name,
    depGroup: gradleModule.group,
    depName: `${gradleModule.group}:${gradleModule.name}`,
    currentValue: gradleModule.version,
    registryUrls: gradleModule.repos,
  };
}

export {
  extractDependenciesFromUpdatesReport,
  createRenovateGradlePlugin,
  GRADLE_DEPENDENCY_REPORT_FILENAME,
};
