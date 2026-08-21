import { CONFIG_VALIDATION } from '../constants/error-messages.ts';
import { regEx, regexEngineStatus } from './regex.ts';

describe('util/regex', () => {
  describe.skipIf(regexEngineStatus.type !== 'available')('with RE2', () => {
    it('uses RE2', async () => {
      // Import lazily so skipped runtimes never load the incompatible native addon.
      const { default: RE2 } = await import('re2');

      expect(regEx('foo')).toBeInstanceOf(RE2);
    });

    it('reuses flags from regex', () => {
      expect(regEx(/foo/i).flags).toBe('iu');
    });
  });

  it('throws unsafe 2', () => {
    expect(() => regEx(`x++`)).toThrow(CONFIG_VALIDATION);
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
