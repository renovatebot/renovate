import {
  ASTNode,
  BinaryOpNode,
  ComparisonNode,
  Token,
  TokenType,
} from './types';

// Parser

let tokens: Token[];
let currentTokenIndex: number;

export function parse(inputTokens: Token[]): ASTNode {
  tokens = inputTokens;
  currentTokenIndex = 0;
  return parseExpression();
}

function peek(): Token {
  return tokens[currentTokenIndex];
}

function consume(expectedType?: TokenType): Token {
  const token = tokens[currentTokenIndex];
  if (expectedType && token.type !== expectedType) {
    throw new Error(
      `Expected token type ${expectedType}, but got ${token.type} at position ${token.position}`,
    );
  }
  currentTokenIndex++;
  return token;
}

function parseExpression(): ASTNode {
  let node = parseTerm();
  while (peek().type === 'OR') {
    consume('OR');
    const right = parseTerm();
    node = {
      type: 'BinaryOp',
      operator: 'OR',
      left: node,
      right,
    } as BinaryOpNode;
  }
  return node;
}

function parseTerm(): ASTNode {
  let node = parseFactor();
  while (peek().type === 'AND') {
    consume('AND');
    const right = parseFactor();
    node = {
      type: 'BinaryOp',
      operator: 'AND',
      left: node,
      right,
    } as BinaryOpNode;
  }
  return node;
}

function parseFactor(): ASTNode {
  const token = peek();
  if (token.type === 'LPAREN') {
    consume('LPAREN');
    const node = parseExpression();
    consume('RPAREN');
    return node;
  } else if (token.type === 'IDENTIFIER') {
    return parseComparison();
  } else {
    throw new Error(
      `Unexpected token ${token.type} at position ${token.position}`,
    );
  }
}

function parseComparison(): ASTNode {
  const keyToken = consume('IDENTIFIER');

  // Check for nested properties
  if (keyToken.value.includes('.')) {
    throw new Error(
      `Nested properties are not supported at position ${keyToken.position}`,
    );
  }

  const operatorToken = consume();
  if (operatorToken.type !== 'EQUALS' && operatorToken.type !== 'NOT_EQUALS') {
    throw new Error(
      `Expected '=' or '!=', but got ${operatorToken.type} at position ${operatorToken.position}`,
    );
  }
  const valueToken = consume();
  if (
    valueToken.type !== 'IDENTIFIER' &&
    valueToken.type !== 'STRING_LITERAL' &&
    valueToken.type !== 'BOOLEAN_LITERAL' &&
    valueToken.type !== 'NUMBER_LITERAL'
  ) {
    throw new Error(
      `Expected a value, but got ${valueToken.type} at position ${valueToken.position}`,
    );
  }
  let value: any;
  if (valueToken.type === 'STRING_LITERAL') {
    value = valueToken.value;
  } else if (valueToken.type === 'BOOLEAN_LITERAL') {
    value = valueToken.value === 'true';
  } else if (valueToken.type === 'NUMBER_LITERAL') {
    value = parseFloat(valueToken.value);
  } else {
    if (valueToken.value === 'true') {
      value = true;
    } else if (valueToken.value === 'false') {
      value = false;
    } else if (isNaN(Number(valueToken.value))) {
      value = valueToken.value;
    } else {
      value = Number(valueToken.value);
    }
  }
  return {
    type: 'Comparison',
    operator: operatorToken.type,
    key: keyToken.value,
    value,
  } as ComparisonNode;
}
