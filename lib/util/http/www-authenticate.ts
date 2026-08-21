/**
 * Inspired by https://github.com/alexdutton/www-authenticate
 */
import { regEx } from '../regex.ts';

interface Tokenizer {
  type?: 'token' | 'equals' | 'comma';
  matcher: RegExp;
}
interface ValueToken {
  type: 'token' | 'equals' | 'comma';
  value: string;
}

interface PairToken {
  type: 'pair';
  key: string;
  value: string;
}

type Token = ValueToken | PairToken;

interface ChallengeToken {
  scheme: string;
  tokens: Token[];
}

export const BearerScheme = 'bearer' as const;

export interface SimpleChallenge {
  scheme: 'basic';
  params?: string;
}
export interface ParamsChallenge {
  scheme: 'bearer' | 'digest';
  params?: Record<string, string>;
}

export interface UnknownChallenge {
  scheme: string;
  params?: unknown;
}

export type Challenge = SimpleChallenge | ParamsChallenge | UnknownChallenge;

const tokenizer: Tokenizer[] = [
  { type: 'token', matcher: regEx(/^([a-zA-Z0-9!#$%&'*+.^_`|~-]+)/) }, // token
  { type: 'token', matcher: regEx(/^"((?:[^"\\]|\\\\|\\")*)"/) }, // quoted-string
  { matcher: regEx(/^\s+/) }, // whitespace (ignored)
  { type: 'equals', matcher: regEx(/^(=)/) }, // equals
  { type: 'comma', matcher: regEx(/^(,)/) }, // comma
];

function tokenize(input: string): Token[] {
  const result: Token[] = [];
  let remaining = input;

  while (remaining.length > 0) {
    let matched = false;
    for (const t of tokenizer) {
      const match = t.matcher.exec(remaining);
      if (match) {
        matched = true;
        remaining = remaining.slice(match[0].length);
        if (t.type) {
          result.push({ type: t.type, value: match[1] });
        }
        break;
      }
    }
    if (!matched) {
      throw new Error(`Failed to parse value`);
    }
  }

  return result;
}

function groupPairs(tokens: Token[]): Token[] {
  for (let i = 0; i < tokens.length - 2; i++) {
    if (
      tokens[i].type === 'token' &&
      tokens[i + 1].type === 'equals' &&
      tokens[i + 2].type === 'token'
    ) {
      tokens[i] = {
        type: 'pair',
        key: tokens[i].value,
        value: tokens[i + 2].value,
      };
      tokens.splice(i + 1, 2);
    }
  }

  return tokens;
}

function groupChallenges(tokens: Token[]): ChallengeToken[] {
  const result: ChallengeToken[] = [];
  while (tokens.length > 0) {
    let j = 1;
    if (tokens.length === 1) {
      // pass
    } else if (tokens[1].type === 'comma') {
      // pass
    } else if (tokens[1].type === 'token') {
      j = 2;
    } else {
      while (j < tokens.length && tokens[j].type === 'pair') {
        j += 2;
      }
      j--;
    }
    result.push({
      scheme: tokens[0].value,
      tokens: tokens.slice(1, j),
    });
    tokens.splice(0, j + 1);
  }

  return result;
}

export function parse(header: string | string[]): Challenge[] {
  const result: Challenge[] = [];
  for (const h of Array.isArray(header) ? header : [header]) {
    let tokens = tokenize(h);

    if (!tokens.length) {
      continue;
    }

    tokens = groupPairs(tokens);

    for (const c of groupChallenges(tokens)) {
      const args: string[] = [];
      const params: Record<string, string> = {};

      for (const t of c.tokens) {
        switch (t.type) {
          case 'token':
            args.push(t.value);
            break;
          case 'pair':
            params[t.key] = t.value;
            break;
        }
      }

      if (args.length) {
        result.push({ scheme: c.scheme.toLowerCase(), params: args[0] });
      } else if (Object.keys(params).length) {
        result.push({ scheme: c.scheme.toLowerCase(), params });
      } else {
        result.push({ scheme: c.scheme.toLowerCase() });
      }
    }
  }

  return result;
}
