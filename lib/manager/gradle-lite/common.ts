export interface ManagerData {
  fileReplacePosition: number;
  packageFile?: string;
}

export interface VariableData extends ManagerData {
  key: string;
  value: string;
}

export type PackageVariables = Record<string, VariableData>;

export type VariablePlaceholder = Pick<VariableData, 'key'>;

export type Interpolation = (string | VariablePlaceholder)[];

export enum TokenType {
  Space = 'space',
  LineComment = 'lineComment',
  MultiComment = 'multiComment',
  Newline = 'newline',

  Colon = 'colon',
  Dot = 'dot',
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
