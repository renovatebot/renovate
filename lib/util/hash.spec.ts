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
});
