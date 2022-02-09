import type { PackageDependency } from '../../types';
import type { GradleManagerData } from '../types';
import type { TokenType } from './common';

export interface VariableData extends GradleManagerData {
  key: string;
  value: string;
}

export type PackageVariables = Record<string, VariableData>;
export type VariableRegistry = Record<string, PackageVariables>;

export interface Token {
  type: TokenType;
  value: string;
  offset: number;
}

export interface StringInterpolation extends Token {
  type: TokenType.StringInterpolation;
  children: Token[]; // Tokens inside double-quoted string that are subject of interpolation
  isComplete: boolean; // True if token has parsed completely
  isValid: boolean; // False if string contains something unprocessable
}

// Matcher on single token
export interface SyntaxMatcher {
  matchType: TokenType | TokenType[];
  matchValue?: string | string[];
  lookahead?: boolean;
  tokenMapKey?: string;
}

export type TokenMap = Record<string, Token>;

export interface SyntaxHandlerInput {
  packageFile: string;
  variables: PackageVariables;
  tokenMap: TokenMap;
}

export type SyntaxHandlerOutput = {
  deps?: PackageDependency<GradleManagerData>[];
  vars?: PackageVariables;
  urls?: string[];
} | null;

export interface SyntaxMatchConfig {
  matchers: SyntaxMatcher[];
  handler: (_: SyntaxHandlerInput) => SyntaxHandlerOutput;
}

export interface MatchConfig {
  tokens: Token[];
  variables: PackageVariables;
  packageFile: string;
}

export interface ParseGradleResult {
  deps: PackageDependency<GradleManagerData>[];
  urls: string[];
  vars: PackageVariables;
}

export interface GradleCatalog {
  versions?: Record<string, string>;
  libraries?: Record<
    string,
    GradleCatalogModuleDescriptor | GradleCatalogArtifactDescriptor | string
  >;
  plugins?: Record<string, GradleCatalogPluginDescriptor | string>;
}

export interface GradleCatalogModuleDescriptor {
  module: string;
  version?: string | VersionPointer;
}

export interface GradleCatalogArtifactDescriptor {
  name: string;
  group: string;
  version?: string | VersionPointer;
}

export interface GradleCatalogPluginDescriptor {
  id: string;
  version: string | VersionPointer;
}

export interface VersionPointer {
  ref: string;
}
