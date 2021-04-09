import type { PackageDependency } from '../types';

export { MAVEN_REPO } from '../../datasource/maven/common';

export const JCENTER_REPO = 'https://jcenter.bintray.com/';
export const GOOGLE_REPO = 'https://dl.google.com/android/maven2/';

export interface ManagerData {
  fileReplacePosition: number;
  packageFile?: string;
}

export interface VariableData extends ManagerData {
  key: string;
  value: string;
}

export type PackageVariables = Record<string, VariableData>;
export type VariableRegistry = Record<string, PackageVariables>;

export enum TokenType {
  Space = 'space',
  LineComment = 'lineComment',
  MultiComment = 'multiComment',
  Newline = 'newline',

  Semicolon = 'semicolon',
  Colon = 'colon',
  Dot = 'dot',
  Comma = 'comma',
  Operator = 'operator',

  Assignment = 'assignment',

  Word = 'word',

  LeftParen = 'leftParen',
  RightParen = 'rightParen',

  LeftBracket = 'leftBracket',
  RightBracket = 'rightBracket',

  LeftBrace = 'leftBrace',
  RightBrace = 'rightBrace',

  SingleQuotedStart = 'singleQuotedStart',
  SingleQuotedFinish = 'singleQuotedFinish',

  DoubleQuotedStart = 'doubleQuotedStart',
  StringInterpolation = 'interpolation',
  IgnoredInterpolationStart = 'ignoredInterpolation',
  Variable = 'variable',
  DoubleQuotedFinish = 'doubleQuotedFinish',

  TripleSingleQuotedStart = 'tripleQuotedStart',
  TripleDoubleQuotedStart = 'tripleDoubleQuotedStart',
  TripleQuotedFinish = 'tripleQuotedFinish',

  Char = 'char',
  EscapedChar = 'escapedChar',
  String = 'string',

  UnknownLexeme = 'unknownChar',
  UnknownFragment = 'unknownFragment',
}

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
  deps?: PackageDependency<ManagerData>[];
  vars?: PackageVariables;
  urls?: string[];
} | null;

export interface SyntaxMatchConfig {
  matchers: SyntaxMatcher[];
  handler: (MatcherHandlerInput) => SyntaxHandlerOutput;
}
