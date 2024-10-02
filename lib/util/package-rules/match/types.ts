// types.ts

export type TokenType =
  | 'AND'
  | 'OR'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'ANY'
  | 'NONE'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COMMA'
  | 'IDENTIFIER'
  | 'STRING_LITERAL'
  | 'BOOLEAN_LITERAL'
  | 'NUMBER_LITERAL'
  | 'NULL_LITERAL'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export interface ASTNode {
  type: string;
  value?: string | boolean | number | any[];
  key?: string;
  operator?: string;
  left?: ASTNode;
  right?: ASTNode;
}

export interface BinaryOpNode extends ASTNode {
  type: 'BinaryOp';
  operator: 'AND' | 'OR';
  left: ASTNode;
  right: ASTNode;
}

export interface ComparisonNode extends ASTNode {
  type: 'Comparison';
  operator:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'GREATER_THAN'
    | 'GREATER_THAN_OR_EQUAL'
    | 'LESS_THAN'
    | 'LESS_THAN_OR_EQUAL'
    | 'ANY'
    | 'NONE';
  key: string;
  value: any;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}
