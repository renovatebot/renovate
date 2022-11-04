export { MAVEN_REPO } from '../../datasource/maven/common';

export const JCENTER_REPO = 'https://jcenter.bintray.com/';
export const GOOGLE_REPO = 'https://dl.google.com/android/maven2/';
export const GRADLE_PLUGIN_PORTAL_REPO = 'https://plugins.gradle.org/m2/';

export type TokenType =
  | 'space'
  | 'lineComment'
  | 'multiComment'
  | 'newline'
  | 'semicolon'
  | 'colon'
  | 'dot'
  | 'comma'
  | 'operator'
  | 'assignment'
  | 'word'
  | 'leftParen'
  | 'rightParen'
  | 'leftBracket'
  | 'rightBracket'
  | 'leftBrace'
  | 'rightBrace'
  | 'singleQuotedStart'
  | 'singleQuotedFinish'
  | 'doubleQuotedStart'
  | 'interpolation'
  | 'ignoredInterpolation'
  | 'variable'
  | 'doubleQuotedFinish'
  | 'tripleQuotedStart'
  | 'tripleDoubleQuotedStart'
  | 'tripleQuotedFinish'
  | 'chars'
  | 'escapedChar'
  | 'string'
  | 'unknownFragment';
