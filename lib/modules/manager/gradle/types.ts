import type { lexer } from '@renovatebot/good-enough-parser';
import type { PackageDependency } from '../types.ts';

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
