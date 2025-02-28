import jsonValidator from 'json-dup-key-validator';
import { parseFileConfig } from './parse';

vi.mock('json-dup-key-validator', { spy: true });

describe('config/parse', () => {
  describe('json', () => {
    it('parses', () => {
      expect(parseFileConfig('config.json', '{}')).toEqual({
        success: true,
        parsedContents: {},
      });
    });

    it('returns error', () => {
      // syntax validation
      expect(parseFileConfig('config.json', '{')).toEqual({
        success: false,
        validationError: 'Invalid JSON (parsing failed)',
        validationMessage: 'Syntax error: unclosed statement near {',
      });

      // duplicate keys
      vi.mocked(jsonValidator).validate.mockReturnValueOnce(undefined);
      expect(parseFileConfig('config.json', '{')).toEqual({
        success: false,
        validationError: 'Duplicate keys in JSON',
        validationMessage: '"Syntax error: unclosed statement near {"',
      });

      // JSON.parse
      vi.mocked(jsonValidator).validate.mockReturnValue(undefined);
      expect(parseFileConfig('config.json', '{')).toEqual({
        success: false,
        validationError: 'Invalid JSON (parsing failed)',
        validationMessage:
          'JSON.parse error:  `JSON5: invalid end of input at 1:2`',
      });
    });
  });

  describe('json5', () => {
    it('parses', () => {
      expect(parseFileConfig('config.json5', '{}')).toEqual({
        success: true,
        parsedContents: {},
      });
    });

    it('returns error', () => {
      expect(parseFileConfig('config.json5', '{')).toEqual({
        success: false,
        validationError: 'Invalid JSON5 (parsing failed)',
        validationMessage:
          'JSON5.parse error: `JSON5: invalid end of input at 1:2`',
      });
    });
  });
});
