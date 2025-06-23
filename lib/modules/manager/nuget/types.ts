import type { PackageDependency } from '../types';

export interface DotnetToolsManifest {
  readonly version: number;
  readonly isRoot: boolean;

  readonly tools: Record<string, DotnetTool>;
}

export interface DotnetTool {
  readonly version: string;
  readonly commands: string[];
}

export interface Registry {
  readonly url: string;
  readonly name?: string;
  sourceMappedPackagePatterns?: string[];
}
export interface ProjectFile {
  readonly isLeaf: boolean;
  readonly name: string;
}

export interface PackageSourceCredential {
  readonly name: string;
  readonly username: string | undefined;
  readonly password: string | undefined;
}

export interface PackageSourceMap {
  readonly name: string;
  readonly patterns: string[];
}

export interface NugetPackageDependency extends PackageDependency {
  depName: string;
}
