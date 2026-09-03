export interface BaseToken {
  prefix: string;
  type: 'TYPE_NUMBER' | 'TYPE_QUALIFIER';
  val: number | string;
  isTransition?: boolean;
}

export interface NumberToken extends BaseToken {
  type: 'TYPE_NUMBER';
  val: number;
}

export interface QualifierToken extends BaseToken {
  type: 'TYPE_QUALIFIER';
  val: string;
}

export type Token = NumberToken | QualifierToken;

export interface Range {
  leftType: 'INCLUDING_POINT' | 'EXCLUDING_POINT' | null;
  leftValue: string | null;
  leftBracket: string | null;
  rightType: 'INCLUDING_POINT' | 'EXCLUDING_POINT' | null;
  rightValue: string | null;
  rightBracket: string | null;
}
