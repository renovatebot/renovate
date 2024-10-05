// main.ts

import {
  ASTNode,
  BinaryOpNode,
  ComparisonNode,
  Token,
  TokenType,
  ValidationResult,
} from './types';

// Tokenizer function
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  const isWhitespace = (c: string): boolean => /\s/.test(c);
  const isLetter = (c: string): boolean => /[a-zA-Z_]/.test(c);
  const isDigit = (c: string): boolean => /[0-9]/.test(c);
  const isIdentifierChar = (c: string): boolean => /[a-zA-Z0-9_]/.test(c);

  const singleCharTokens: { [key: string]: TokenType } = {
    '(': 'LPAREN',
    ')': 'RPAREN',
    '[': 'LBRACKET',
    ']': 'RBRACKET',
    ',': 'COMMA',
  };

  while (i < len) {
    let c = input[i];

    // Skip whitespace
    if (isWhitespace(c)) {
      i++;
      continue;
    }

    // Single-character tokens
    if (singleCharTokens.hasOwnProperty(c)) {
      tokens.push({ type: singleCharTokens[c], value: c, position: i });
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
    } else if (c === '>' && input[i + 1] === '=') {
      tokens.push({ type: 'GREATER_THAN_OR_EQUAL', value: '>=', position: i });
      i += 2;
      continue;
    } else if (c === '>') {
      tokens.push({ type: 'GREATER_THAN', value: '>', position: i });
      i++;
      continue;
    } else if (c === '<' && input[i + 1] === '=') {
      tokens.push({ type: 'LESS_THAN_OR_EQUAL', value: '<=', position: i });
      i += 2;
      continue;
    } else if (c === '<') {
      tokens.push({ type: 'LESS_THAN', value: '<', position: i });
      i++;
      continue;
    }

    // Numeric literals (including negative numbers)
    if (c === '-' || isDigit(c)) {
      const start = i;
      let value = '';
      if (c === '-') {
        value += c;
        i++;
        c = input[i];
        if (!isDigit(c)) {
          throw new Error(`Invalid number at position ${start}`);
        }
      }
      while (i < len && (isDigit(input[i]) || input[i] === '.')) {
        value += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER_LITERAL', value, position: start });
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
      } else if (upperValue === 'ANY') {
        tokens.push({ type: 'ANY', value: 'ANY', position: start });
      } else if (upperValue === 'NONE') {
        tokens.push({ type: 'NONE', value: 'NONE', position: start });
      } else if (upperValue === 'TRUE' || upperValue === 'FALSE') {
        tokens.push({
          type: 'BOOLEAN_LITERAL',
          value: value.toLowerCase(),
          position: start,
        });
      } else if (upperValue === 'NULL') {
        tokens.push({
          type: 'NULL_LITERAL',
          value: 'null',
          position: start,
        });
      } else {
        tokens.push({ type: 'IDENTIFIER', value, position: start });
      }
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

// Parser functions and variables
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

  const isRelationalOperator =
    operatorToken.type === 'GREATER_THAN' ||
    operatorToken.type === 'GREATER_THAN_OR_EQUAL' ||
    operatorToken.type === 'LESS_THAN' ||
    operatorToken.type === 'LESS_THAN_OR_EQUAL';

  const isArrayOperator =
    operatorToken.type === 'ANY' || operatorToken.type === 'NONE';

  if (
    operatorToken.type !== 'EQUALS' &&
    operatorToken.type !== 'NOT_EQUALS' &&
    !isRelationalOperator &&
    !isArrayOperator
  ) {
    throw new Error(
      `Expected a comparison operator, but got ${operatorToken.type} at position ${operatorToken.position}`,
    );
  }

  let value: any;

  if (isArrayOperator) {
    // Parse array of values
    value = parseArray();
  } else {
    const valueToken = consume();
    if (
      valueToken.type !== 'IDENTIFIER' &&
      valueToken.type !== 'STRING_LITERAL' &&
      valueToken.type !== 'BOOLEAN_LITERAL' &&
      valueToken.type !== 'NUMBER_LITERAL' &&
      valueToken.type !== 'NULL_LITERAL'
    ) {
      throw new Error(
        `Expected a value, but got ${valueToken.type} at position ${valueToken.position}`,
      );
    }

    if (valueToken.type === 'STRING_LITERAL') {
      value = valueToken.value;
    } else if (valueToken.type === 'BOOLEAN_LITERAL') {
      value = valueToken.value === 'true';
    } else if (valueToken.type === 'NUMBER_LITERAL') {
      value = parseFloat(valueToken.value);
    } else if (valueToken.type === 'NULL_LITERAL') {
      value = null;
    } else {
      if (valueToken.value === 'true') {
        value = true;
      } else if (valueToken.value === 'false') {
        value = false;
      } else if (valueToken.value === 'null') {
        value = null;
      } else if (!isNaN(Number(valueToken.value))) {
        value = Number(valueToken.value);
      } else {
        value = valueToken.value;
      }
    }

    // For relational operators, value must be a number
    if (isRelationalOperator && typeof value !== 'number') {
      throw new Error(
        `Operator ${operatorToken.type} requires a numeric value at position ${valueToken.position}`,
      );
    }
  }

  return {
    type: 'Comparison',
    operator: operatorToken.type,
    key: keyToken.value,
    value,
  } as ComparisonNode;
}

// Updated parseArray function to handle NULL_LITERAL
function parseArray(): any[] {
  const values: any[] = [];
  consume('LBRACKET'); // Expect '['

  const nextToken = peek();
  if (nextToken.type === 'RBRACKET') {
    // Empty array
    consume('RBRACKET');
    return values;
  }

  while (true) {
    const valueToken = consume();
    let value: any;

    if (
      valueToken.type === 'STRING_LITERAL' ||
      valueToken.type === 'NUMBER_LITERAL' ||
      valueToken.type === 'BOOLEAN_LITERAL' ||
      valueToken.type === 'NULL_LITERAL'
    ) {
      if (valueToken.type === 'STRING_LITERAL') {
        value = valueToken.value;
      } else if (valueToken.type === 'BOOLEAN_LITERAL') {
        value = valueToken.value === 'true';
      } else if (valueToken.type === 'NUMBER_LITERAL') {
        value = parseFloat(valueToken.value);
      } else if (valueToken.type === 'NULL_LITERAL') {
        value = null;
      }
    } else if (valueToken.type === 'IDENTIFIER') {
      // Handle identifiers as potential booleans or numbers
      if (valueToken.value === 'true') {
        value = true;
      } else if (valueToken.value === 'false') {
        value = false;
      } else if (valueToken.value === 'null') {
        value = null;
      } else if (!isNaN(Number(valueToken.value))) {
        value = Number(valueToken.value);
      } else {
        value = valueToken.value;
      }
    } else {
      throw new Error(
        `Expected a value, but got ${valueToken.type} at position ${valueToken.position}`,
      );
    }

    values.push(value);

    const nextToken = peek();
    if (nextToken.type === 'COMMA') {
      consume('COMMA');
      continue;
    } else if (nextToken.type === 'RBRACKET') {
      consume('RBRACKET');
      break;
    } else {
      throw new Error(
        `Expected ',' or ']', but got ${nextToken.type} at position ${nextToken.position}`,
      );
    }
  }

  return values;
}

// Evaluation function
export function evaluate(node: ASTNode, data: unknown): boolean {
  function areValuesEqual(a: any, b: any): boolean {
    return a === b;
  }

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

    // Only check for undefined; allow null
    if (dataValue === undefined) {
      return false;
    }

    const isRelationalOperator =
      compNode.operator === 'GREATER_THAN' ||
      compNode.operator === 'GREATER_THAN_OR_EQUAL' ||
      compNode.operator === 'LESS_THAN' ||
      compNode.operator === 'LESS_THAN_OR_EQUAL';

    if (isRelationalOperator) {
      // Ensure both sides are numbers
      if (typeof dataValue !== 'number' || typeof compNode.value !== 'number') {
        return false;
      }
    } else if (compNode.operator === 'ANY' || compNode.operator === 'NONE') {
      // For 'ANY' and 'NONE' operators, the value should be an array
      if (!Array.isArray(compNode.value)) {
        return false;
      }
      // If the array is empty, return false
      if ((compNode.value as any[]).length === 0) {
        return false;
      }
    } else {
      // For equality operators, ensure type consistency
      if (typeof dataValue !== typeof compNode.value) {
        // Special case for null comparison
        if (dataValue === null || compNode.value === null) {
          // Allow comparison between null and null
        } else {
          return false;
        }
      }
    }

    switch (compNode.operator) {
      case 'EQUALS':
        return dataValue === compNode.value;
      case 'NOT_EQUALS':
        return dataValue !== compNode.value;
      case 'GREATER_THAN':
        return dataValue > compNode.value;
      case 'GREATER_THAN_OR_EQUAL':
        return dataValue >= compNode.value;
      case 'LESS_THAN':
        return dataValue < compNode.value;
      case 'LESS_THAN_OR_EQUAL':
        return dataValue <= compNode.value;
      case 'ANY':
        if (Array.isArray(dataValue)) {
          // Check if any element in dataValue matches any value in compNode.value
          return dataValue.some((val) =>
            (compNode.value as any[]).some((compVal) =>
              areValuesEqual(val, compVal),
            ),
          );
        } else {
          // Check if dataValue matches any value in compNode.value
          return (compNode.value as any[]).some((compVal) =>
            areValuesEqual(dataValue, compVal),
          );
        }
      case 'NONE':
        if (Array.isArray(dataValue)) {
          // Check if none of the elements in dataValue match any value in compNode.value
          return dataValue.every((val) =>
            (compNode.value as any[]).every(
              (compVal) => !areValuesEqual(val, compVal),
            ),
          );
        } else {
          // Corrected logic for non-array dataValue
          return !(compNode.value as any[]).some((compVal) =>
            areValuesEqual(dataValue, compVal),
          );
        }

      default:
        throw new Error(`Unsupported operator ${compNode.operator}`);
    }
  }
  return false;
}

// Validate function
export function validate(input: string): ValidationResult {
  try {
    const inputTokens = tokenize(input);
    parse(inputTokens);
    return { valid: true };
  } catch (error) {
    if (error instanceof Error) {
      return { valid: false, message: error.message };
    }
    return {
      valid: false,
      message: 'An unknown error occurred during validation.',
    };
  }
}

export function match(input: string, data: unknown): boolean {
  const inputTokens = tokenize(input);
  const ast = parse(inputTokens);
  return evaluate(ast, data);
}
