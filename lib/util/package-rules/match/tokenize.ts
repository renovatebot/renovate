import { Token } from './types';

// Tokenizer function
export function tokenize(input: string): Token[] {
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
