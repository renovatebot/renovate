export { MAVEN_REPO } from '../../datasource/maven/common';

export const JCENTER_REPO = 'https://jcenter.bintray.com/';
export const GOOGLE_REPO = 'https://dl.google.com/android/maven2/';

// TODO: convert to types
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

  Chars = 'chars',
  EscapedChar = 'escapedChar',
  String = 'string',

  UnknownFragment = 'unknownFragment',
}
