import { codeBlock } from 'common-tags';
import jsonValidator from 'json-dup-key-validator';
import { CONFIG_VALIDATION } from '../constants/error-messages.ts';
import { parseFileConfig, safeParseFileConfig } from './parse.ts';

vi.mock('json-dup-key-validator', { spy: true });

describe('config/parse', () => {
  describe('json', () => {
    it('parses', () => {
      expect(safeParseFileConfig('config.json', '{}')).toEqual({
        success: true,
        parsedContents: {},
      });
    });

    it('parses jsonc with trailing comma', () => {
      const content = codeBlock`
        // comment
        {
          "extends": ["config:best-practices"],
        }
      `;
      expect(safeParseFileConfig('config.jsonc', content)).toEqual({
        success: true,
        parsedContents: { extends: ['config:best-practices'] },
      });
    });

    it('keeps commas inside strings', () => {
      const content = codeBlock`
        {
          "foo": "a,]",
          "bar": "b,}",
        }
      `;
      expect(safeParseFileConfig('config.jsonc', content)).toEqual({
        success: true,
        parsedContents: { foo: 'a,]', bar: 'b,}' },
      });
    });

    it('returns error', () => {
      // syntax validation
      expect(safeParseFileConfig('config.json', '{')).toEqual({
        success: false,
        validationError: 'Invalid JSON (parsing failed)',
        validationMessage: 'Syntax error: unclosed statement near {',
      });

      // duplicate keys
      vi.mocked(jsonValidator).validate.mockReturnValueOnce(undefined);
      expect(safeParseFileConfig('config.json', '{')).toEqual({
        success: false,
        validationError: 'Duplicate keys in JSON',
        validationMessage: '"Syntax error: unclosed statement near {"',
      });

      // JSON.parse
      vi.mocked(jsonValidator).validate.mockReturnValue(undefined);
      expect(safeParseFileConfig('config.json', '{')).toEqual({
        success: false,
        validationError: 'Invalid JSON (parsing failed)',
        validationMessage:
          'JSON.parse error:  `JSON5: invalid end of input at 1:2`',
      });
    });
  });

  describe('json5', () => {
    it('parses', () => {
      expect(safeParseFileConfig('config.json5', '{}')).toEqual({
        success: true,
        parsedContents: {},
      });
    });

    it('returns error', () => {
      expect(safeParseFileConfig('config.json5', '{')).toEqual({
        success: false,
        validationError: 'Invalid JSON5 (parsing failed)',
        validationMessage:
          'JSON5.parse error: `JSON5: invalid end of input at 1:2`',
      });
    });
  });

  describe('parseFileConfig', () => {
    it('returns the parsed contents', () => {
      expect(parseFileConfig('config.json', '{"a":1}')).toEqual({ a: 1 });
    });

    it('throws CONFIG_VALIDATION on parse errors', () => {
      expect(() => parseFileConfig('config.json5', '{')).toThrow(
        expect.objectContaining({
          message: CONFIG_VALIDATION,
          validationSource: 'config.json5',
          validationError: 'Invalid JSON5 (parsing failed)',
        }),
      );
    });
  });
});
