export interface GradleDependency {
  group: string;
  name: string;
  version?: string;
}

export interface UpdateFunction {
  (dependency: GradleDependency, buildGradleContent: string, newValue: string):
    | string
    | null;
}

export interface GradleProject {
  project: string;
  repositories: string[];
  dependencies: GradleDependency[];
}

export type GradleDependencyWithRepos = GradleDependency & { repos: string[] };

export interface BuildDependency {
  name: string;
  depGroup: string;
  depName?: string;
  currentValue?: string;
  registryUrls?: string[];
}
