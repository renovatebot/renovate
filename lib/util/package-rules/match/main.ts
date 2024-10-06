import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import * as allVersioning from '../../../modules/versioning';
import type { VersioningApi } from '../../../modules/versioning/types';
import * as memCache from '../../cache/memory';
import { matchRegexOrGlob } from '../../string-match';
import type {
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
    if (c in singleCharTokens) {
      tokens.push({ type: singleCharTokens[c], value: c, position: i });
      i++;
      continue;
    }

    // Operators
    if (c === '=' && input[i + 1] === '=') {
      tokens.push({ type: 'DOUBLE_EQUALS', value: '==', position: i });
      i += 2;
      continue;
    } else if (c === '=' && input[i + 1] !== '=') {
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
  const node = parseExpression();
  if (peek().type !== 'EOF') {
    throw new Error(
      `Unexpected token ${peek().type} at position ${peek().position}`,
    );
  }
  return node;
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
    operatorToken.type !== 'DOUBLE_EQUALS' &&
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
    } else if (valueToken.type === 'IDENTIFIER') {
      // Invalid identifier as value, expecting string literals
      throw new Error(
        `Invalid identifier '${valueToken.value}' at position ${valueToken.position}`,
      );
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

  let done = false;
  while (!done) {
    const valueToken = consume();
    let value: any;

    if (
      valueToken.type === 'STRING_LITERAL' ||
      valueToken.type === 'NUMBER_LITERAL' ||
      valueToken.type === 'BOOLEAN_LITERAL'
    ) {
      if (valueToken.type === 'STRING_LITERAL') {
        value = valueToken.value;
      } else if (valueToken.type === 'BOOLEAN_LITERAL') {
        value = valueToken.value === 'true';
      } else if (valueToken.type === 'NUMBER_LITERAL') {
        value = parseFloat(valueToken.value);
      }
    } else if (valueToken.type === 'IDENTIFIER') {
      // Invalid identifier in array
      throw new Error(
        `Invalid identifier '${valueToken.value}' in array at position ${valueToken.position}`,
      );
    } else {
      throw new Error(
        `Expected a value, but got ${valueToken.type} at position ${valueToken.position}`,
      );
    }

    values.push(value);

    const nextTokenAfterValue = peek();
    if (nextTokenAfterValue.type === 'COMMA') {
      consume('COMMA');
    } else if (nextTokenAfterValue.type === 'RBRACKET') {
      consume('RBRACKET');
      done = true;
    }
  }

  return values;
}

// Evaluation

function areValuesEqual(a: any, b: any): boolean {
  if (is.string(a) && is.string(b)) {
    return matchRegexOrGlob(a, b);
  }
  return a === b;
}

const versionFields = ['currentVersion', 'lockedVersion', 'newVersion'];

function evaluateVersionMatch(compNode: ComparisonNode, data: any): boolean {
  const { key, value: compValue } = compNode;
  const dataValue = data[key];
  if (!is.string(dataValue) || !is.string(compValue)) {
    return false;
  }
  if (!is.string(data.versioning)) {
    return false;
  }
  const versioningApi = allVersioning.get(data.versioning);

  if (!versioningApi.isValid(compValue)) {
    return false;
  }

  if (!versioningApi.isVersion(dataValue)) {
    return false;
  }
  return versioningApi.matches(dataValue, compValue);
}

function evaluateEquals(compKey: string, compValue: any, data: any): boolean {
  const dataValue = data[compKey];
  if (compValue === dataValue) {
    // Exact match
    return true;
  }
  if (versionFields.includes(compKey)) {
    return evaluateVersionMatch(
      { key: compKey, value: compValue, operator: 'EQUALS' } as ComparisonNode,
      data,
    );
  }
  return areValuesEqual(dataValue, compValue);
}

export function evaluate(node: ASTNode, data: unknown): boolean {
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
      case 'DOUBLE_EQUALS':
        return dataValue === compNode.value;
      case 'EQUALS':
        return evaluateEquals(compNode.key, compNode.value, data);
      case 'NOT_EQUALS':
        return !evaluateEquals(compNode.key, compNode.value, data);
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
            evaluateEquals(compNode.key, compVal, data),
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
          // Check if dataValue does not match any value in compNode.value
          return !(compNode.value as any[]).some((compVal) =>
            evaluateEquals(compNode.key, compVal, data),
          );
        }
    }
  }
  // istanbul ignore next: cannot test
  return false;
}

function parseAndTokenize(input: string): ASTNode | Error {
  try {
    const inputTokens = tokenize(input);
    return parse(inputTokens);
  } catch (err) {
    return err;
  }
}

function getMemoizedAst(input: string): ASTNode | Error {
  const cacheKey = `ast-${input}`;
  const cachedAst = memCache.get(cacheKey);
  // istanbul ignore if: cannot test
  if (cachedAst) {
    return cachedAst;
  }

  const res = parseAndTokenize(input);
  if (res instanceof Error) {
    logger.warn({ err: res }, `Invalid match input`);
  }

  memCache.set(cacheKey, res);
  return res;
}

export function validate(input: string): ValidationResult {
  const res = getMemoizedAst(input);
  if (res instanceof Error) {
    return { valid: false, message: res.message };
  }
  return { valid: true };
}

export function match(input: string, data: unknown): boolean {
  const ast = getMemoizedAst(input);
  if (ast instanceof Error) {
    return false;
  }
  return evaluate(ast, data);
}
