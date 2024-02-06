import RE2 from 're2';
import { CONFIG_VALIDATION } from '../constants/error-messages';
import { configRegexPredicate, regEx } from './regex';

describe('util/regex', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('uses RE2', () => {
    expect(regEx('foo')).toBeInstanceOf(RE2);
  });

  it('throws unsafe 2', () => {
    expect(() => regEx(`x++`)).toThrow(CONFIG_VALIDATION);
  });

  it('reuses flags from regex', () => {
    expect(regEx(/foo/i).flags).toBe('iu');
  });

  it('caches non-stateful regex', () => {
    expect(regEx('foo')).toBe(regEx('foo'));
    expect(regEx('foo', 'm')).toBe(regEx('foo', 'm'));
  });

  it('does not cache stateful regex', () => {
    expect(regEx('foo', 'g')).not.toBe(regEx('foo', 'g'));
    expect(regEx(/bar/g)).not.toBe(/bar/g);
  });

  it('Falls back to RegExp', async () => {
    jest.doMock('re2', () => {
      throw new Error();
    });

    const regex = await import('./regex');
    expect(regex.regEx('foo')).toBeInstanceOf(RegExp);
  });

  describe('configRegexPredicate', () => {
    it('allows valid regex pattern', () => {
      expect(configRegexPredicate('/hello/')).not.toBeNull();
    });

    it('invalidates invalid regex pattern', () => {
      expect(configRegexPredicate('/^test\\d+$/m')).toBeNull();
    });

    it('allows the i flag in regex pattern', () => {
      expect(configRegexPredicate('/^test\\d+$/i')).not.toBeNull();
    });

    it('allows negative regex pattern', () => {
      expect(configRegexPredicate('!/^test\\d+$/i')).not.toBeNull();
    });

    it('does not allow non-regex input', () => {
      expect(configRegexPredicate('hello')).toBeNull();
    });
  });
});
