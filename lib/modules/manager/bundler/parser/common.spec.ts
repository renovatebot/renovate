import { parseAsync } from '@ast-grep/napi';
import * as astGrep from '../../../../util/ast-grep';
import {
  coerceToString,
  coerceToStringOrSymbol,
  extractKvArgs,
  extractPlainString,
  loadRuby,
  namedChildren,
  resolveIdentifier,
} from './common';

const callPattern = astGrep.rule`
  rule:
    kind: call
`;

const stringPattern = astGrep.rule`
  rule:
    kind: string
`;

const identifierPattern = astGrep.rule`
  rule:
    kind: identifier
`;

const symbolPattern = astGrep.rule`
  rule:
    kind: simple_symbol
`;

const floatPattern = astGrep.rule`
  rule:
    kind: float
`;

const integerPattern = astGrep.rule`
  rule:
    kind: integer
`;

describe('modules/manager/bundler/parser/common', () => {
  beforeAll(() => {
    loadRuby();
  });

  describe('loadRuby', () => {
    it('loads ruby language without error', () => {
      expect(() => loadRuby()).not.toThrow();
    });
  });

  describe('namedChildren', () => {
    it('filters named children from node', async () => {
      const content = 'gem "rails", "~> 7.0"';
      const ast = await parseAsync('ruby', content);
      const root = ast.root();
      const callNode = root.find(callPattern);

      const children = namedChildren(callNode!);
      expect(children.length).toBeGreaterThan(0);
      expect(children.every((child) => child.isNamed())).toBe(true);
    });
  });

  describe('extractPlainString', () => {
    it('extracts simple string content', async () => {
      const content = '"rails"';
      const ast = await parseAsync('ruby', content);
      const stringNode = ast.root().find(stringPattern);

      const result = extractPlainString(stringNode);
      expect(result).toBe('rails');
    });

    it('handles null input', () => {
      const result = extractPlainString(null);
      expect(result).toBeNull();
    });

    it('handles non-string nodes', async () => {
      const content = 'rails';
      const ast = await parseAsync('ruby', content);
      const identifierNode = ast.root().find(identifierPattern);

      const result = extractPlainString(identifierNode);
      expect(result).toBeNull();
    });
  });

  describe('coerceToString', () => {
    it('handles identifier nodes', async () => {
      const content = 'rails';
      const ast = await parseAsync('ruby', content);
      const identifierNode = ast.root().find(identifierPattern);

      const result = coerceToString(identifierNode);
      expect(result).toBe('rails');
    });

    it('handles simple symbol nodes', async () => {
      const content = ':development';
      const ast = await parseAsync('ruby', content);
      const symbolNode = ast.root().find(symbolPattern);

      const result = coerceToString(symbolNode);
      expect(result).toBe('development');
    });

    it('handles string nodes', async () => {
      const content = '"rails"';
      const ast = await parseAsync('ruby', content);
      const stringNode = ast.root().find(stringPattern);

      const result = coerceToString(stringNode);
      expect(result).toBe('rails');
    });

    it('handles float nodes', async () => {
      const content = '3.14';
      const ast = await parseAsync('ruby', content);
      const floatNode = ast.root().find(floatPattern);

      const result = coerceToString(floatNode);
      expect(result).toBe('3.14');
    });

    it('handles integer nodes', async () => {
      const content = '42';
      const ast = await parseAsync('ruby', content);
      const integerNode = ast.root().find(integerPattern);

      const result = coerceToString(integerNode);
      expect(result).toBe('42');
    });

    it('handles null input', () => {
      const result = coerceToString(null);
      expect(result).toBeNull();
    });
  });

  describe('coerceToStringOrSymbol', () => {
    it('returns symbol for identifier nodes', async () => {
      const content = 'rails';
      const ast = await parseAsync('ruby', content);
      const identifierNode = ast.root().find(identifierPattern);

      const result = coerceToStringOrSymbol(identifierNode);
      expect(typeof result).toBe('symbol');
      expect(result?.toString()).toBe('Symbol(rails)');
    });

    it('returns string for other nodes', async () => {
      const content = '"rails"';
      const ast = await parseAsync('ruby', content);
      const stringNode = ast.root().find(stringPattern);

      const result = coerceToStringOrSymbol(stringNode);
      expect(typeof result).toBe('string');
      expect(result).toBe('rails');
    });

    it('handles null input', () => {
      const result = coerceToStringOrSymbol(null);
      expect(result).toBeNull();
    });
  });

  describe('extractKvArgs', () => {
    it('extracts key-value pairs from gem arguments', async () => {
      const content =
        'gem "rails", "~> 7.0", group: :development, source: "https://example.com"';
      const ast = await parseAsync('ruby', content);
      const callNode = ast.root().find(callPattern);

      const result = extractKvArgs(callNode!);
      expect(result.group).toBe('development');
      expect(result.source).toBe('https://example.com');
    });

    it('handles array values', async () => {
      const content = 'gem "rails", group: [:development, :test]';
      const ast = await parseAsync('ruby', content);
      const callNode = ast.root().find(callPattern);

      const result = extractKvArgs(callNode!);
      expect(result.group).toEqual(['development', 'test']);
    });

    it('handles empty arguments', async () => {
      const content = 'gem "rails"';
      const ast = await parseAsync('ruby', content);
      const callNode = ast.root().find(callPattern);

      const result = extractKvArgs(callNode!);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('resolveIdentifier', () => {
    it('resolves identifier from assignment', async () => {
      const content = `
        source_url = "https://example.com"
        gem "rails", source: source_url
      `;
      const ast = await parseAsync('ruby', content);
      const identifierNode = ast
        .root()
        .findAll(identifierPattern)
        .find((node) => node.text() === 'source_url');

      if (identifierNode) {
        const result = resolveIdentifier(identifierNode);
        expect(result).toBe('https://example.com');
      }
    });

    it('handles unresolved identifiers', async () => {
      const content = 'gem "rails", source: unknown_var';
      const ast = await parseAsync('ruby', content);
      const identifierNode = ast
        .root()
        .findAll(identifierPattern)
        .find((node) => node.text() === 'unknown_var');

      if (identifierNode) {
        const result = resolveIdentifier(identifierNode);
        expect(result).toBeNull();
      }
    });

    it('handles variable parameter', async () => {
      const content = `
        my_var = "test"
        gem "rails"
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(callPattern);

      const result = resolveIdentifier(gemNode!, 'my_var');
      expect(result).toBe('test');
    });
  });
});
