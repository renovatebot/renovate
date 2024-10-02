export type TokenType =
  | 'AND'
  | 'OR'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'LPAREN'
  | 'RPAREN'
  | 'IDENTIFIER'
  | 'STRING_LITERAL'
  | 'BOOLEAN_LITERAL'
  | 'NUMBER_LITERAL'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export interface ASTNode {
  type: string;
}

export interface BinaryOpNode extends ASTNode {
  type: 'BinaryOp';
  operator: 'AND' | 'OR';
  left: ASTNode;
  right: ASTNode;
}

export interface ComparisonNode extends ASTNode {
  type: 'Comparison';
  operator: 'EQUALS' | 'NOT_EQUALS';
  key: string;
  value: any;
}
