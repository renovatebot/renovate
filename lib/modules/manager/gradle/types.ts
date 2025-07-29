import type { lexer } from 'good-enough-parser';
import type { PackageDependency } from '../types';

export interface GradleManagerData {
  fileReplacePosition?: number;
  packageFile?: string;
}

export interface VariableData extends GradleManagerData {
  key: string;
  value: string;
}

export type PackageVariables = Record<string, VariableData>;
export type VariableRegistry = Record<string, PackageVariables>;

export interface ParseGradleResult {
  deps: PackageDependency<GradleManagerData>[];
  urls: PackageRegistry[];
  vars: PackageVariables;
  javaLanguageVersion?: string;
}

export interface GradleCatalog {
  versions?: Record<string, GradleVersionPointerTarget>;
  libraries?: Record<
    string,
    GradleCatalogModuleDescriptor | GradleCatalogArtifactDescriptor | string
  >;
  plugins?: Record<string, GradleCatalogPluginDescriptor | string>;
}

export interface GradleCatalogModuleDescriptor {
  module: string;
  version?: GradleVersionCatalogVersion;
}

export interface GradleCatalogArtifactDescriptor {
  name: string;
  group: string;
  version?: GradleVersionCatalogVersion;
}

export interface GradleCatalogPluginDescriptor {
  id: string;
  version: GradleVersionCatalogVersion;
}

export interface VersionPointer {
  ref: string;
}

/**
 * Rich version declarations in Gradle version catalogs
 *
 * @see https://docs.gradle.org/current/userguide/rich_versions.html
 * @see https://docs.gradle.org/current/userguide/platforms.html#sub::toml-dependencies-format
 */
export interface RichVersion {
  require?: string;
  strictly?: string;
  prefer?: string;
  reject?: string[];
  rejectAll?: boolean;
}

// references cannot themselves be references
export type GradleVersionPointerTarget = string | RichVersion;
export type GradleVersionCatalogVersion = string | VersionPointer | RichVersion;

export type ContentDescriptorMatcher = 'simple' | 'regex' | 'subgroup';

export interface ContentDescriptorSpec {
  mode: 'include' | 'exclude';
  matcher: ContentDescriptorMatcher;
  groupId: string;
  artifactId?: string;
  version?: string;
}

export interface PackageRegistry {
  registryUrl: string;
  registryType: 'regular' | 'exclusive';
  scope: 'dep' | 'plugin';
  content?: ContentDescriptorSpec[];
}

export interface Ctx {
  readonly packageFile: string;
  readonly fileContents: Record<string, string | null>;
  recursionDepth: number;

  globalVars: PackageVariables;
  deps: PackageDependency<GradleManagerData>[];
  registryUrls: PackageRegistry[];
  javaLanguageVersion?: string;

  varTokens: lexer.Token[];
  tmpKotlinImportStore: lexer.Token[][];
  tmpNestingDepth: lexer.Token[];
  tmpRegistryContent: ContentDescriptorSpec[];
  tmpTokenStore: Record<string, lexer.Token[]>;
  tokenMap: Record<string, lexer.Token[]>;
}

export type NonEmptyArray<T> = T[] & { 0: T };
