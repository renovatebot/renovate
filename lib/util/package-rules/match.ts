import is from '@sindresorhus/is';
import { logger } from '../../logger';
// Token types
type TokenType =
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

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// Tokenizer function
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  const isWhitespace = (c: string): boolean => /\s/.test(c);
  const isLetter = (c: string): boolean => /[a-zA-Z_]/.test(c);
  const isDigit = (c: string): boolean => /[0-9]/.test(c);
  const isIdentifierChar = (c: string): boolean => /[a-zA-Z0-9_]/.test(c);

  while (i < len) {
    let c = input[i];

    // Skip whitespace
    if (isWhitespace(c)) {
      i++;
      continue;
    }

    // Parentheses
    if (c === '(') {
      tokens.push({ type: 'LPAREN', value: c, position: i });
      i++;
      continue;
    } else if (c === ')') {
      tokens.push({ type: 'RPAREN', value: c, position: i });
      i++;
      continue;
    }

    // Operators
    if (c === '=' && input[i + 1] !== '=') {
      tokens.push({ type: 'EQUALS', value: '=', position: i });
      i++;
      continue;
    } else if (c === '!' && input[i + 1] === '=') {
      tokens.push({ type: 'NOT_EQUALS', value: '!=', position: i });
      i += 2;
      continue;
    }

    // Identifiers and keywords
    if (isLetter(c)) {
      const start = i;
      let value = '';
      while (i < len && isIdentifierChar(input[i])) {
        value += input[i];
        i++;
      }
      const upperValue = value.toUpperCase();
      if (upperValue === 'AND') {
        tokens.push({ type: 'AND', value: 'AND', position: start });
      } else if (upperValue === 'OR') {
        tokens.push({ type: 'OR', value: 'OR', position: start });
      } else if (upperValue === 'TRUE' || upperValue === 'FALSE') {
        tokens.push({
          type: 'BOOLEAN_LITERAL',
          value: value.toLowerCase(),
          position: start,
        });
      } else {
        tokens.push({ type: 'IDENTIFIER', value, position: start });
      }
      continue;
    }

    // Numeric literals
    if (isDigit(c)) {
      const start = i;
      let value = '';
      while (i < len && (isDigit(input[i]) || input[i] === '.')) {
        value += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER_LITERAL', value, position: start });
      continue;
    }

    // String literals
    if (c === "'" || c === '"') {
      const quoteType = c;
      const start = i;
      i++; // Skip the opening quote
      let str = '';
      let escaped = false;
      while (i < len) {
        c = input[i];
        if (escaped) {
          str += c;
          escaped = false;
        } else if (c === '\\') {
          escaped = true;
        } else if (c === quoteType) {
          break;
        } else {
          str += c;
        }
        i++;
      }
      if (i >= len || c !== quoteType) {
        throw new Error(`Unterminated string literal at position ${start}`);
      }
      i++; // Skip the closing quote
      tokens.push({ type: 'STRING_LITERAL', value: str, position: start });
      continue;
    }

    // Unrecognized character
    throw new Error(`Unrecognized character '${c}' at position ${i}`);
  }

  tokens.push({ type: 'EOF', value: '', position: i });
  return tokens;
}

// Parser
interface ASTNode {
  type: string;
}

interface BinaryOpNode extends ASTNode {
  type: 'BinaryOp';
  operator: 'AND' | 'OR';
  left: ASTNode;
  right: ASTNode;
}

interface ComparisonNode extends ASTNode {
  type: 'Comparison';
  operator: 'EQUALS' | 'NOT_EQUALS';
  key: string;
  value: any;
}

let tokens: Token[];
let currentTokenIndex: number;

function parse(inputTokens: Token[]): ASTNode {
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

// Evaluator
function evaluate(node: ASTNode, data: unknown): boolean {
  if (node.type === 'BinaryOp') {
    const opNode = node as BinaryOpNode;
    if (opNode.operator === 'AND') {
      const leftResult = evaluate(opNode.left, data);
      if (!leftResult) {
        return false; // Short-circuit
      }
      return evaluate(opNode.right, data);
    } else if (opNode.operator === 'OR') {
      const leftResult = evaluate(opNode.left, data);
      if (leftResult) {
        return true; // Short-circuit
      }
      return evaluate(opNode.right, data);
    }
  } else if (node.type === 'Comparison') {
    const compNode = node as ComparisonNode;
    const dataValue = (data as any)[compNode.key];
    if (dataValue === undefined || dataValue === null) {
      return false;
    }

    // Ensure type consistency for comparison
    if (typeof dataValue !== typeof compNode.value) {
      return false;
    }

    if (compNode.operator === 'EQUALS') {
      return dataValue === compNode.value;
    } else if (compNode.operator === 'NOT_EQUALS') {
      return dataValue !== compNode.value;
    }
  }
  return false;
}

export function match(input: string, data: unknown): boolean {
  if (!is.plainObject(data)) {
    return false;
  }
  try {
    const tokensList = tokenize(input);
    const ast = parse(tokensList);
    return evaluate(ast, data);
  } catch (err) {
    logger.debug({ err }, 'Error while matching package rule');
    return false;
  }
}
