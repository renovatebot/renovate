import { buildTestJwt } from '~test/jwt-util.ts';
import { isProbablyJwt } from './jwt.ts';

describe('util/http/jwt', () => {
  describe('isProbablyJwt', () => {
    it('returns true for a valid JWT with typ and alg', () => {
      const token = buildTestJwt(
        { typ: 'JWT', alg: 'RS256' },
        { aud: '499b84ac', sub: 'test' },
        'fake-sig',
      );
      expect(isProbablyJwt(token)).toBeTrue();
    });

    it('returns true for a JWT with only alg in header', () => {
      const token = buildTestJwt({ alg: 'HS256' }, { sub: 'x' }, 'sig');
      expect(isProbablyJwt(token)).toBeTrue();
    });

    it('returns false for a 52-char PAT', () => {
      expect(isProbablyJwt('a'.repeat(52))).toBeFalse();
    });

    it('returns false for an empty string', () => {
      expect(isProbablyJwt('')).toBeFalse();
    });

    it('returns false for invalid base64 segments', () => {
      expect(isProbablyJwt('not.valid.base64!!!')).toBeFalse();
    });

    it('returns false when header JSON has no typ or alg', () => {
      const token = buildTestJwt({ foo: 'bar' }, { sub: 'x' }, 'sig');
      expect(isProbablyJwt(token)).toBeFalse();
    });

    it('returns false for two segments', () => {
      const seg = Buffer.from(
        JSON.stringify({ typ: 'JWT', alg: 'RS256' }),
      ).toString('base64url');
      expect(isProbablyJwt(`${seg}.${seg}`)).toBeFalse();
    });

    it('returns false for four segments', () => {
      const seg = Buffer.from(
        JSON.stringify({ typ: 'JWT', alg: 'RS256' }),
      ).toString('base64url');
      expect(isProbablyJwt(`${seg}.${seg}.${seg}.${seg}`)).toBeFalse();
    });

    it('returns false when header decodes to a non-object', () => {
      const token = buildTestJwt('just a string', { sub: 'x' }, 'sig');
      expect(isProbablyJwt(token)).toBeFalse();
    });

    it('returns false when header decodes to null', () => {
      const token = buildTestJwt(null, { sub: 'x' }, 'sig');
      expect(isProbablyJwt(token)).toBeFalse();
    });
  });
});
