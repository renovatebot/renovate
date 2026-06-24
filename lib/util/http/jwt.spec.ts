import { isProbablyJwt } from './jwt.ts';

describe('util/http/jwt', () => {
  describe('isProbablyJwt', () => {
    it('returns true for a valid JWT with typ and alg', () => {
      const header = Buffer.from(
        JSON.stringify({ typ: 'JWT', alg: 'RS256' }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ aud: '499b84ac', sub: 'test' }),
      ).toString('base64url');
      const sig = Buffer.from('fake-sig').toString('base64url');
      expect(isProbablyJwt(`${header}.${payload}.${sig}`)).toBeTrue();
    });

    it('returns true for a JWT with only alg in header', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
        'base64url',
      );
      const payload = Buffer.from(JSON.stringify({ sub: 'x' })).toString(
        'base64url',
      );
      const sig = Buffer.from('sig').toString('base64url');
      expect(isProbablyJwt(`${header}.${payload}.${sig}`)).toBeTrue();
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
      const header = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
        'base64url',
      );
      const payload = Buffer.from(JSON.stringify({ sub: 'x' })).toString(
        'base64url',
      );
      const sig = Buffer.from('sig').toString('base64url');
      expect(isProbablyJwt(`${header}.${payload}.${sig}`)).toBeFalse();
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
      const header = Buffer.from('"just a string"').toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'x' })).toString(
        'base64url',
      );
      const sig = Buffer.from('sig').toString('base64url');
      expect(isProbablyJwt(`${header}.${payload}.${sig}`)).toBeFalse();
    });

    it('returns false when header decodes to null', () => {
      const header = Buffer.from('null').toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'x' })).toString(
        'base64url',
      );
      const sig = Buffer.from('sig').toString('base64url');
      expect(isProbablyJwt(`${header}.${payload}.${sig}`)).toBeFalse();
    });
  });
});
