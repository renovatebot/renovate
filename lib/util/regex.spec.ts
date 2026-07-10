import { CONFIG_VALIDATION } from '../constants/error-messages.ts';
import { regEx, regexEngineStatus } from './regex.ts';

describe('util/regex', () => {
  it('uses the available regex engine', async () => {
    const regex = regEx('foo');
    // Import RE2 only after Renovate confirms its native addon can be loaded.
    const ExpectedRegExp =
      regexEngineStatus.type === 'available'
        ? (await import('re2')).default
        : RegExp;

    expect(regex).toBeInstanceOf(ExpectedRegExp);
  });

  it('throws unsafe 2', () => {
    expect(() => regEx(`x++`)).toThrow(CONFIG_VALIDATION);
  });

  it('reuses flags from regex', () => {
    const expectedFlags = regexEngineStatus.type === 'available' ? 'iu' : 'i';
    expect(regEx(/foo/i).flags).toBe(expectedFlags);
  });

  it('caches non-stateful regex', () => {
    expect(regEx('foo')).toBe(regEx('foo'));
    expect(regEx('foo', 'm')).toBe(regEx('foo', 'm'));
  });

  it('does not cache stateful regex', () => {
    expect(regEx('foo', 'g')).not.toBe(regEx('foo', 'g'));
    expect(regEx(/bar/g)).not.toBe(/bar/g);
  });

  it('falls back to RegExp', async () => {
    vi.resetModules();
    // Exercise a load failure even if RENOVATE_X_IGNORE_RE2 is set externally.
    vi.doMock('./env.ts', () => ({ getEnv: () => ({}) }));
    vi.doMock('../expose.ts', () => ({
      re2: () => {
        throw new Error();
      },
    }));

    const regex = await import('./regex.ts');
    expect(regex.regexEngineStatus.type).toBe('unavailable');
    expect(regex.regEx('foo')).toBeInstanceOf(RegExp);
  });
});
