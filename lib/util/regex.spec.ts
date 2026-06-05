import RE2 from 're2';
import { CONFIG_VALIDATION } from '../constants/error-messages.ts';
import { hostnameMatchRegex, regEx } from './regex.ts';

describe('util/regex', () => {
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
    vi.resetModules();
    vi.doMock('../expose.ts', () => ({
      re2: () => {
        throw new Error();
      },
    }));

    const regex = await import('./regex.ts');
    expect(regex.regEx('foo')).toBeInstanceOf(RegExp);
  });

  describe('hostnameMatchRegex', () => {
    it('captures hostname and optional registry port before image path', () => {
      expect(hostnameMatchRegex.exec('ghcr.io/astral-sh/uv')?.groups).toEqual({
        hostname: 'ghcr.io',
      });
      expect(
        hostnameMatchRegex.exec('some-registry.example.com/cache/image')
          ?.groups,
      ).toEqual({
        hostname: 'some-registry.example.com',
      });
      expect(
        hostnameMatchRegex.exec('registry.example.com:5005/ns/img')?.groups,
      ).toEqual({
        hostname: 'registry.example.com',
        port: '5005',
      });
    });
  });
});
