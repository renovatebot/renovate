import { hash, toSha256 } from './hash';

describe('util/hash', () => {
  test('should hash data with sha256', () => {
    expect(hash('https://example.com/test.txt', 'sha256')).toBe(
      'd1dc63218c42abba594fff6450457dc8c4bfdd7c22acf835a50ca0e5d2693020'
    );
    expect(toSha256('https://example.com/test.txt')).toBe(
      'd1dc63218c42abba594fff6450457dc8c4bfdd7c22acf835a50ca0e5d2693020'
    );
  });

  test('should hash data with sha512', () => {
    expect(hash('https://example.com/test.txt')).toBe(
      '368b1e723aecb5d17e0a69d046f8a7b9eb4e2aa2ee78e307d563c57cde45b8c3755990411aa2626c13214a8d571e0478fa9a19d03e295bb28bc453a88206b484'
    );
  });
});
