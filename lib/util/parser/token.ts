import type { Token as MooToken } from 'moo';

export enum TokenType {
  Unknown = 'Unknown',

  // Space characters
  Space = 'Space',
  Tab = 'Tab',
  Newline = 'Newline',

  // Comments

  Comment = 'Comment',

  // Identifiers and keywords
  Symbol = 'Symbol',

  // Strings

  SingleQuote = 'SingleQuote',
  DoubleQuote = 'DoubleQuote',

  // Brackets

  RoundBracketLeft = 'RoundBracketLeft',
  RoundBracketRight = 'RoundBracketRight',

  SquareBracketLeft = 'SquareBracketLeft',
  SquareBracketRight = 'SquareBracketRight',

  CurlyBracketLeft = 'CurlyBracketLeft',
  CurlyBracketRight = 'CurlyBracketRight',

  AngleBracketLeft = 'AngleBracketLeft',
  AngleBracketRight = 'AngleBracketRight',

  // ...
}

export interface Token {
  type: TokenType;
  value: string;
  offset: number;
}

export function massageMooToken({ type, value, offset }: MooToken): Token {
  return {
    type: TokenType[type] || TokenType.Unknown,
    value,
    offset,
  };
}
